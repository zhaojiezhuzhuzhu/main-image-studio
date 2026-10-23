import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'

const IMAGE_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp']
])

function sendJson(response, statusCode, payload) {
  if (response.headersSent) return
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

function toWebPath(value) {
  return value.split(sep).join('/')
}

function resolveLibraryFile(root, requestedPath) {
  const normalized = String(requestedPath || '').replaceAll('\\', '/').replace(/^\/+/, '')
  const absolutePath = resolve(root, normalized)
  const rootPrefix = `${root}${sep}`
  if (!absolutePath.startsWith(rootPrefix)) throw new Error('参考图路径无效。')
  const type = IMAGE_TYPES.get(extname(absolutePath).toLowerCase())
  if (!type) throw new Error('参考图格式不受支持。')
  return { absolutePath, type, normalized: toWebPath(relative(root, absolutePath)) }
}

async function listImages(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true })
  const items = []
  for (const entry of entries) {
    const absolutePath = resolve(current, entry.name)
    if (entry.isDirectory()) {
      items.push(...await listImages(root, absolutePath))
      continue
    }
    const type = IMAGE_TYPES.get(extname(entry.name).toLowerCase())
    if (!type) continue
    const file = await stat(absolutePath)
    const relativePath = toWebPath(relative(root, absolutePath))
    const segments = relativePath.split('/')
    items.push({
      id: relativePath,
      name: entry.name,
      category: segments.length > 1 ? segments[0] : '未分类',
      relativePath,
      size: file.size,
      url: `/api/reference-library/file?path=${encodeURIComponent(relativePath)}`
    })
  }
  return items.sort((a, b) => a.category.localeCompare(b.category, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'))
}

function attachReferenceLibrary(server, root) {
  server.middlewares.use('/api/reference-library', async (request, response, next) => {
    if (request.method !== 'GET') {
      next()
      return
    }
    try {
      const requestUrl = new URL(request.url || '/', 'http://localhost')
      if (requestUrl.pathname === '/file' || requestUrl.pathname.endsWith('/file')) {
        const target = resolveLibraryFile(root, requestUrl.searchParams.get('path'))
        const file = await readFile(target.absolutePath)
        response.statusCode = 200
        response.setHeader('Content-Type', target.type)
        response.setHeader('Content-Length', String(file.length))
        response.setHeader('Cache-Control', 'private, max-age=60')
        response.end(file)
        return
      }
      const items = await listImages(root)
      sendJson(response, 200, { items, count: items.length })
    } catch (error) {
      const code = error?.code === 'ENOENT' ? 404 : 400
      sendJson(response, code, {
        error: error?.code === 'ENOENT'
          ? '本地软装搭配素材目录不存在或图片已移动。'
          : error?.message || '无法读取本地参考图。'
      })
    }
  })
}

export function referenceLibraryPlugin(options = {}) {
  const root = resolve(options.root || process.cwd(), options.directory || '软装搭配')
  return {
    name: 'reference-library',
    configureServer(server) {
      attachReferenceLibrary(server, root)
    },
    configurePreviewServer(server) {
      attachReferenceLibrary(server, root)
    }
  }
}

export const referenceLibraryInternals = { listImages, resolveLibraryFile }
