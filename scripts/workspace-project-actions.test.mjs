import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')

assert.match(source, /const saveInFlight = ref\(false\)/)
assert.match(source, /async function saveWorkspaceProject\(\)[\s\S]*saveProjectNow\(\{ force: true \}\)[\s\S]*已保存到单图项目/)

const cropHeader = source.match(/<section class="single-canvas-panel crop-canvas-panel"[\s\S]*?<\/section>/)?.[0] || ''
assert.match(cropHeader, /@click="saveWorkspaceProject"/)
assert.match(cropHeader, /'保存到单图项目'/)
assert.match(cropHeader, /@click="showProjects"/)
assert.match(cropHeader, />我的单图项目</)

const generateHeader = source.match(/<div class="canvas-panel-head generate-canvas-head">[\s\S]*?<\/div>\s*<\/div>/)?.[0] || ''
assert.match(generateHeader, /v-if="!embeddedRefine && \(hasImage \|\| hasRawImage\)"/)
assert.match(generateHeader, /@click="saveWorkspaceProject"/)
assert.match(generateHeader, /v-if="!embeddedRefine" class="canvas-projects-button"/)
assert.match(generateHeader, />我的单图项目</)

assert.match(source, /:aria-busy="saveInFlight"/)
assert.match(source, /saveInFlight \? '正在保存…' : '保存到单图项目'/)

console.log('workspace project action tests passed')
