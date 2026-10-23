import { defineConfig, loadEnv } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { imageEditAdapterPlugin } from './server/image-edit-adapter.js'
import { referenceLibraryPlugin } from './server/reference-library.js'
import skuWorkbenchConfig from './交接打包-sku/01_源码/vite.config.ts'

function loadImageCredentials(root) {
  try {
    const text = readFileSync(resolve(root, '密钥.txt'), 'utf8')
    const baseUrl = text.match(/(?:地址|API\s*地址)\s*[：:]\s*(https?:\/\/\S+)/i)?.[1]?.trim()
    const apiKey = text.match(/(?:密钥|秘钥|API\s*KEY)\s*[：:]\s*(sk-[A-Za-z0-9_-]+)/i)?.[1]?.trim()
    const normalizedBaseUrl = baseUrl?.replace(/\/+$/, '') || ''
    return {
      baseUrl: normalizedBaseUrl && !normalizedBaseUrl.endsWith('/v1')
        ? `${normalizedBaseUrl}/v1`
        : normalizedBaseUrl,
      apiKey: apiKey || ''
    }
  } catch {
    return { baseUrl: '', apiKey: '' }
  }
}

export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root, '')
  const credentials = loadImageCredentials(root)
  return {
    plugins: [
      vue(),
      ...skuWorkbenchConfig.plugins,
      imageEditAdapterPlugin({
        baseUrl: env.IMAGE_EDIT_API_BASE_URL || credentials.baseUrl,
        apiKey: env.IMAGE_EDIT_API_KEY || credentials.apiKey,
        model: env.IMAGE_EDIT_API_MODEL,
        inspirationModel: env.IMAGE_INSPIRATION_API_MODEL,
        timeoutMs: env.IMAGE_EDIT_TIMEOUT_MS
      }),
      referenceLibraryPlugin({ root })
    ],
    resolve: {
      // pnpm's peer-dependency layout can otherwise make Element Plus and the
      // app resolve separate Vue runtimes once the SKU React app is integrated.
      // A shared runtime is required for slots such as ElTooltip to render.
      dedupe: ['vue', '@vue/runtime-core', '@vue/runtime-dom', '@vue/reactivity', '@vue/shared']
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          sku: resolve(root, 'sku/index.html')
        }
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      watch: { ignored: ['**/软装搭配/**'] }
    },
    preview: { host: '0.0.0.0', port: 4173 }
  }
})
