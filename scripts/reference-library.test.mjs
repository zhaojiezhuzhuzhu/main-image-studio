import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { referenceLibraryInternals } from '../server/reference-library.js'

const fixtureRoot = await mkdtemp(join(tmpdir(), 'main-image-reference-library-'))
try {
  await mkdir(join(fixtureRoot, '抱枕'), { recursive: true })
  await mkdir(join(fixtureRoot, '挂画'), { recursive: true })
  await writeFile(join(fixtureRoot, '抱枕', 'A.png'), Buffer.from('image-a'))
  await writeFile(join(fixtureRoot, '挂画', 'B.webp'), Buffer.from('image-b'))
  await writeFile(join(fixtureRoot, '说明.txt'), 'ignored')

  const items = await referenceLibraryInternals.listImages(fixtureRoot)
  assert.equal(items.length, 2)
  assert.deepEqual(new Set(items.map(item => item.category)), new Set(['抱枕', '挂画']))
  assert.ok(items.every(item => item.url.startsWith('/api/reference-library/file?path=')))

  const selected = referenceLibraryInternals.resolveLibraryFile(fixtureRoot, '抱枕/A.png')
  assert.equal(selected.type, 'image/png')
  assert.throws(
    () => referenceLibraryInternals.resolveLibraryFile(fixtureRoot, '../密钥.txt'),
    /参考图路径无效/
  )

  const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
  const singleMode = await readFile(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')
  assert.match(viteConfig, /referenceLibraryPlugin\(\{ root \}\)/)
  assert.match(viteConfig, /ignored: \['\*\*\/软装搭配\/\*\*'\]/)
  assert.match(singleMode, /@click="openReferenceLibrary"[\s\S]*从本地“软装搭配”素材库选择/)
  assert.match(singleMode, /requestImageEditStatus\(generateController\.signal\)/)

  console.log('reference library tests passed')
} finally {
  await rm(fixtureRoot, { recursive: true, force: true })
}
