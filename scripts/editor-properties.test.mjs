import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const editor = await readFile(new URL('../public/legacy/editor.html', import.meta.url), 'utf8')

assert.match(editor, /class="position-fields"[\s\S]*data-prop="x"[\s\S]*data-prop="y"/, 'the shared property panel must expose X and Y inputs')
assert.match(editor, /aria-label="X 坐标"/, 'the X coordinate input must have an accessible name')
assert.match(editor, /aria-label="Y 坐标"/, 'the Y coordinate input must have an accessible name')
assert.match(editor, /\["x","y"\]\.includes\(p\)\?Math\.round\(\(Number\(box\?\.\[p\]\)\|\|0\)\*100\)\/100/, 'coordinate inputs must reflect the selected visual bounds')
assert.match(editor, /else if\(p==="x"\|\|p==="y"\)[\s\S]*pushHistory\(\);moveRef\(ref,p==="x"\?delta:0,p==="y"\?delta:0\)/, 'coordinate edits must be undoable and move the full selected entity')
assert.match(editor, /moveRef\(ref,dx,dy\)[\s\S]*entityItems\(ref\)\.forEach/, 'component coordinate edits must move every layer in the selected component')

console.log('editor property tests passed')
