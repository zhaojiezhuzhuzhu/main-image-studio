import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')

assert.match(
  source,
  /function onPreviewKeydown\(event\)[\s\S]*event\.key === 'Delete'[\s\S]*event\.key === 'Backspace'[\s\S]*clearSelection\(\)/,
  'the shared mask canvas must delete the current mask with Delete or Backspace'
)
assert.match(
  source,
  /function onPreviewPointerDown\(event\)[\s\S]*canvas\.focus\(\{ preventScroll: true \}\)/,
  'pointer interaction must focus the mask canvas so the shortcut is available immediately'
)
assert.match(
  source,
  /ref="previewCanvas"[\s\S]*@keydown="onPreviewKeydown"/,
  'the shared mode 2/mode 3 canvas must own the keyboard handler'
)
assert.match(
  source,
  /function clearSelection\(\)[\s\S]*selection\.value = null[\s\S]*clearRect\([\s\S]*activeTool\.value = 'box'[\s\S]*scheduleSave\(\)/,
  'deleting a mask must clear both geometry and pixels, restore box-select mode, and persist the change'
)
assert.match(source, /Delete 删除蒙版/, 'the shortcut must be discoverable in the canvas UI')

console.log('mask delete shortcut tests passed')
