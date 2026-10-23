import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')

for (const ratio of ['1:1', '3:2', '2:3', '4:3', '3:4', '9:16', '16:9']) {
  assert.match(source, new RegExp(`key: '${ratio.replace(':', '\\:')}'`), `missing ${ratio} selection ratio`)
}

assert.match(source, /role="radiogroup" aria-label="框选比例"/, 'ratio controls must be exposed as one accessible choice group')
assert.match(source, /function makeAspectSelection\(/, 'new selections must follow the chosen ratio')
assert.match(source, /function setSelectionRatio\(/, 'existing selections must react to ratio changes')
assert.match(source, /function ensureSelectionGeometry\(\)/, 'legacy in-memory square selections must be migrated before pointer interaction')
assert.match(source, /watch\(activeTool,[\s\S]*ensureSelectionGeometry\(\)[\s\S]*renderGenerateCanvas\(\)[\s\S]*immediate: true/, 'switching to move/scale and hot reload must migrate geometry and redraw corner handles immediately')
assert.match(source, /const minScale = Math\.max\(1, MIN_SELECTION_SIZE \/ normalized\.width, MIN_SELECTION_SIZE \/ normalized\.height\)/, 'moving an existing selection must preserve its size instead of shrinking it to the minimum')
assert.match(source, /const threshold = Math\.max\(8 \* canvasScale, SELECTION_HANDLE_HIT_RADIUS_CSS \* point\.scale\)/, 'corner resize hit targets must track the visible handles instead of swallowing the movable selection interior')
assert.match(source, /pointerState\.type === 'box'[\s\S]*activeTool\.value = 'transform'/, 'finishing a new selection must automatically enable move and proportional resize')
assert.doesNotMatch(source, />移动缩放<\/button>/, 'move and scale must not require a separate toolbar button')
assert.match(source, /createCanvas\(width, height\)/, 'the API payload must preserve rectangular selection dimensions')
assert.match(source, /drawImage\(generated, area\.x, area\.y, area\.width, area\.height\)/, 'generated pixels must be composed back into the rectangular selection')
assert.doesNotMatch(source, /selection\.value\.size/, 'mask selection rendering must not remain square-only')

console.log('selection aspect ratio tests passed')
