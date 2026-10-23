import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(projectRoot, '软装搭配')
const publicRoot = resolve(projectRoot, 'public')
const targetRoot = resolve(publicRoot, 'reference-library')

if (!targetRoot.startsWith(`${publicRoot}${sep}`)) {
  throw new Error('Reference library output path must stay inside public/.')
}

function toWebPath(value) {
  return value.split(sep).join('/')
}

function encodeWebPath(value) {
  return value.split('/').map(encodeURIComponent).join('/')
}

async function collectImages(current = sourceRoot) {
  const entries = await readdir(current, { withFileTypes: true })
  const items = []
  for (const entry of entries) {
    const absolutePath = resolve(current, entry.name)
    if (entry.isDirectory()) {
      items.push(...await collectImages(absolutePath))
      continue
    }
    if (!SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
    const file = await stat(absolutePath)
    const relativePath = toWebPath(relative(sourceRoot, absolutePath))
    const segments = relativePath.split('/')
    items.push({
      id: relativePath,
      name: entry.name,
      category: segments.length > 1 ? segments[0] : '未分类',
      relativePath,
      size: file.size,
      url: `/reference-library/files/${encodeWebPath(relativePath)}`,
      absolutePath
    })
  }
  return items
}

const images = (await collectImages()).sort(
  (a, b) => a.category.localeCompare(b.category, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN')
)

await rm(targetRoot, { recursive: true, force: true })
await mkdir(resolve(targetRoot, 'files'), { recursive: true })

for (const item of images) {
  const target = resolve(targetRoot, 'files', ...item.relativePath.split('/'))
  if (!target.startsWith(`${resolve(targetRoot, 'files')}${sep}`)) {
    throw new Error(`Invalid reference image path: ${item.relativePath}`)
  }
  await mkdir(dirname(target), { recursive: true })
  await copyFile(item.absolutePath, target)
}

const manifestItems = images.map(({ absolutePath, ...item }) => item)
await writeFile(
  resolve(targetRoot, 'manifest.json'),
  `${JSON.stringify({ items: manifestItems, count: manifestItems.length }, null, 2)}\n`,
  'utf8'
)

console.log(`Prepared ${manifestItems.length} reference-library images for deployment.`)
