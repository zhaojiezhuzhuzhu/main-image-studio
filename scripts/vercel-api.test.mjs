import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { readFile, stat } from 'node:fs/promises'
import imageEditStatusHandler from '../api/image-edit/status.js'
import referenceLibraryHandler from '../api/reference-library.js'

function listen(handler) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  return once(server, 'listening').then(() => ({ server, port: server.address().port }))
}

function close(server) {
  server.close()
  return once(server, 'close')
}

const statusServer = await listen(imageEditStatusHandler)
const referenceServer = await listen(referenceLibraryHandler)

try {
  const statusResponse = await fetch(`http://127.0.0.1:${statusServer.port}/api/image-edit/status`)
  assert.equal(statusResponse.status, 503)
  const statusPayload = await statusResponse.json()
  assert.equal(statusPayload.configured, false)

  const referenceResponse = await fetch(
    `http://127.0.0.1:${referenceServer.port}/api/reference-library`,
    { redirect: 'manual' }
  )
  assert.equal(referenceResponse.status, 307)
  assert.equal(referenceResponse.headers.get('location'), '/reference-library/manifest.json')

  const manifest = JSON.parse(
    await readFile(new URL('../public/reference-library/manifest.json', import.meta.url), 'utf8')
  )
  assert.equal(manifest.count, 19)
  assert.equal(manifest.items.length, 19)
  assert.ok(manifest.items.every((item) => item.url.startsWith('/reference-library/files/')))
  for (const item of manifest.items) {
    const file = await stat(new URL(`../public${decodeURI(item.url)}`, import.meta.url))
    assert.equal(file.size, item.size)
  }

  console.log('Vercel API and public reference-library tests passed')
} finally {
  await Promise.all([close(statusServer.server), close(referenceServer.server)])
}
