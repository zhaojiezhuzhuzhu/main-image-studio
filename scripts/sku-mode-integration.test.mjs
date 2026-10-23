import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/style.css', import.meta.url), 'utf8')
const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
const skuEntry = await readFile(new URL('../sku/index.html', import.meta.url), 'utf8')
const skuApp = await readFile(new URL('../交接打包-sku/01_源码/src/App.tsx', import.meta.url), 'utf8')
const photoshopScript = await readFile(new URL('../交接打包-sku/01_源码/scripts/photoshop-cutout.ps1', import.meta.url), 'utf8')

assert.match(app, /\['batch', 'single', 'inspiration', 'sku'\]/, 'mode 4 must be a persisted global mode')
assert.match(app, /<span>4<\/span>SKU生成/, 'the global switch must expose the numbered SKU mode')
assert.match(app, /v-if="skuMounted"[\s\S]*src="\/sku\/index\.html"/, 'the SKU workbench must lazy-mount from the integrated entry')
assert.match(app, /if \(mode\.value === 'sku'\) skuMounted\.value = true/, 'the SKU workbench must stay mounted after its first visit')
assert.match(styles, /\.sku-surface \{[\s\S]*height: calc\(100vh - 68px\)/, 'SKU mode must fill the space beneath the global header')
assert.match(viteConfig, /sku: resolve\(root, 'sku\/index\.html'\)/, 'the production build must include the SKU entry')
assert.match(viteConfig, /dedupe: \['vue', '@vue\/runtime-core', '@vue\/runtime-dom', '@vue\/reactivity', '@vue\/shared'\]/, 'the integrated dev server must share one Vue runtime with Element Plus')
assert.match(skuEntry, /交接打包-sku\/01_源码\/src\/main\.tsx/, 'the SKU entry must mount the handed-off React application')
assert.doesNotMatch(skuApp, /href=\{`\/\?recent=/, 'new-window links must not escape the integrated SKU route')
assert.match(photoshopScript, /Photoshop\.Application\\CurVer/, 'Photoshop must be discovered from the Windows registration instead of a fixed install path')
assert.match(photoshopScript, /Get-Process Photoshop[\s\S]*runningProgId/, 'an already-running Photoshop version must take priority over another installed version')
assert.doesNotMatch(photoshopScript, /C:\\Program Files\\Adobe\\Adobe Photoshop 2020/, 'Photoshop must not be pinned to the C drive or the 2020 folder')

console.log('SKU mode integration tests passed')
