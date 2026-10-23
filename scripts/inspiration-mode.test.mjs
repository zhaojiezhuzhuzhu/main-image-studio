import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
const inspiration = await readFile(new URL('../src/components/InspirationMode.vue', import.meta.url), 'utf8')
const singleMode = await readFile(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')
const imageEdit = await readFile(new URL('../src/services/imageEdit.js', import.meta.url), 'utf8')

assert.match(app, /<span>3<\/span>灵感模式/, 'the global mode switch must expose inspiration mode')
assert.match(app, /<InspirationMode\s*\/>/, 'the inspiration workspace must stay mounted with the other modes')
assert.match(inspiration, /promptMode: 'inspiration'/, 'inspiration generation must use the existing image-edit API with its dedicated prompt contract')
assert.match(inspiration, /form class="inspiration-form" novalidate/, 'the product form must own validation')
assert.match(inspiration, /role="radiogroup" aria-label="成图比例"/, 'ratio choices must be exposed as one accessible group')
assert.match(inspiration, /role="radiogroup" aria-label="生成张数"/, 'image count choices must be exposed as one accessible group')
assert.match(inspiration, /<label for="inspiration-prompt">特殊要求/, 'the visible prompt field must be labeled as special requirements')
assert.match(inspiration, /const IMAGE_COUNTS = \[1, 2, 3, 4\]/, 'the workspace must offer one through four images')
assert.match(inspiration, /@click="downloadResult\(\)"/, 'the active generated result must expose a download action')
assert.match(inspiration, /activeResultIndex = \(activeResultIndex [+-] 1/, 'multiple results must remain switchable from the canvas header')
assert.doesNotMatch(inspiration, /inspiration-results|result-preview|result-download/, 'the duplicate generated-result strip must not be rendered')
assert.match(inspiration, /<SingleImageMode[\s\S]*embedded-refine[\s\S]*@exit-refine="exitRefining"/, 'mode 3 must reuse the mode-2 mask refinement workspace')
assert.match(inspiration, /进入局部编辑/, 'the selected inspiration result must expose a local-edit entry action')
assert.match(inspiration, /resizeImageWithoutCropping[\s\S]*drawImage\(image, 0, 0, width, height\)/, 'mode 3 must normalize the full image to the chosen output size without a crop step')
assert.match(inspiration, /width: resultSize\.width,[\s\S]*height: resultSize\.height,[\s\S]*ratioKey: ratioKey\.value/, 'generated results must retain the chosen ratio and canonical dimensions')
assert.match(inspiration, /:refine-width="refineSeed\.width"[\s\S]*:refine-height="refineSeed\.height"[\s\S]*:refine-ratio="refineSeed\.ratioKey"/, 'the local editor must receive the mode-3 output ratio and dimensions')
assert.doesNotMatch(inspiration, /confirmRefinedResult|@confirm-refine/, 'mode-3 refinement must finish through direct download instead of replacing the inspiration result')
assert.match(singleMode, /embeddedRefine/, 'the shared single-image workspace must expose an embedded refinement variant')
assert.match(singleMode, /refineWidth[\s\S]*refineHeight[\s\S]*refineRatio/, 'the shared local editor must accept the mode-3 canvas geometry')
assert.match(singleMode, /targetWidth = props\.refineWidth[\s\S]*drawImage\(image, 0, 0, targetWidth, targetHeight\)/, 'the local editor must defensively preserve the requested canvas size')
assert.match(singleMode, /async function downloadEmbeddedRefine\(\)[\s\S]*canvasToBlob\(canvas, 'image\/png'\)[\s\S]*anchor\.download/, 'the embedded refinement variant must download the current image as PNG')
assert.match(singleMode, /v-if="embeddedRefine"[\s\S]*@click="downloadEmbeddedRefine"[\s\S]*'下载图片'/, 'the embedded refinement variant must expose direct download as its final action')
assert.match(singleMode, /embeddedRefine \? '下载局部编辑结果' : '确认生成结果'/, 'the mode-3 result panel heading must describe the download outcome')
assert.match(singleMode, /<template v-else>[\s\S]*进入编辑模式/, 'the ordinary mode-2 workflow must retain its editor entry')
assert.match(singleMode, /async function initializeEditor\(resetState = true\)[\s\S]*if \(props\.embeddedRefine \|\| !currentImage\.value\) return/, 'the embedded refinement variant must never enter the canvas editor')
assert.match(imageEdit, /保持图1产品结构不变，参考图2的场景，生成图1产品的场景，光影融合自然，摄影棚电商风格/, 'the hidden default inspiration prompt must be applied by the service')

for (const ratio of ['1:1', '3:4']) {
  assert.match(inspiration, new RegExp(`key: '${ratio.replace(':', '\\:')}'`), `missing ${ratio} inspiration ratio`)
}
for (const ratio of ['3:2', '2:3', '4:3', '9:16', '16:9']) {
  assert.doesNotMatch(inspiration, new RegExp(`key: '${ratio.replace(':', '\\:')}'`), `unexpected ${ratio} inspiration ratio`)
}

assert.match(inspiration, /distanceFromWhite/, 'the white background must be converted into an editable API mask')
assert.match(inspiration, /generateController = new AbortController\(\)/, 'generation must be cancellable')

console.log('inspiration mode tests passed')
