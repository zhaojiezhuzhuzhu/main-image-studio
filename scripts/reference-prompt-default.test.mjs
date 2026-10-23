import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')

assert.match(
  source,
  /const REFERENCE_PROMPT_DEFAULT = '将选区的【抱枕】替换为参考图的【抱枕】，其他不变'/
)
assert.match(
  source,
  /watch\(referenceImage,[\s\S]*nextReference && !prompt\.value\.trim\(\)[\s\S]*prompt\.value = REFERENCE_PROMPT_DEFAULT/
)
assert.match(
  source,
  /!nextReference && previousReference && prompt\.value === REFERENCE_PROMPT_DEFAULT[\s\S]*prompt\.value = ''/
)

console.log('reference prompt default tests passed')
