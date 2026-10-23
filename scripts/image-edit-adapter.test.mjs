import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { imageEditAdapterPlugin } from '../server/image-edit-adapter.js'

const ONE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xmy2WQAAAABJRU5ErkJggg=='

function listen(server) {
  server.listen(0, '127.0.0.1')
  return once(server, 'listening').then(() => server.address().port)
}

function close(server) {
  server.close()
  return once(server, 'close')
}

let upstreamReceived = false
const upstream = createServer(async (request, response) => {
  assert.equal(request.url, '/v1/images/edits')
  assert.equal(request.headers.authorization, 'Bearer test-key')
  const body = Buffer.concat(await Array.fromAsync(request))
  const form = await new Request('http://stub/v1/images/edits', {
    method: 'POST',
    headers: { 'Content-Type': request.headers['content-type'] },
    body
  }).formData()
  assert.equal(form.get('model'), 'gpt-image-2-c')
  assert.equal(form.get('prompt'), 'change the color')
  assert.equal(form.get('response_format'), 'b64_json')
  assert.equal(form.get('image'), null)
  assert.equal(form.getAll('image[]').length, 2)
  assert.ok(form.getAll('image[]').every(image => image instanceof Blob))
  assert.ok(form.get('mask') instanceof Blob)
  upstreamReceived = true
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify({ data: [{ b64_json: ONE_PIXEL_PNG }] }))
})

const upstreamPort = await listen(upstream)
let adapterHandler
imageEditAdapterPlugin({
  baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
  apiKey: 'test-key',
  model: 'gpt-image-2-c',
  inspirationModel: 'gpt-image-2-c'
}).configureServer({
  middlewares: {
    use(path, handler) {
      assert.equal(path, '/api/image-edit')
      adapterHandler = handler
    }
  }
})

const adapter = createServer((request, response) => {
  adapterHandler(request, response, () => {
    response.statusCode = 404
    response.end()
  })
})
const adapterPort = await listen(adapter)

try {
  const statusResponse = await fetch(`http://127.0.0.1:${adapterPort}/api/image-edit/status`)
  assert.equal(statusResponse.status, 200)
  const statusPayload = await statusResponse.json()
  assert.deepEqual(statusPayload, {
    configured: true,
    endpointConfigured: true,
    modelConfigured: true
  })

  const form = new FormData()
  form.set('image', new Blob(['image'], { type: 'image/png' }), 'selection.png')
  form.set('mask', new Blob(['mask'], { type: 'image/png' }), 'mask.png')
  form.set('reference_image', new Blob(['reference'], { type: 'image/png' }), 'reference.png')
  form.set('request_mode', 'inspiration')
  form.set('prompt', 'change the color')
  const response = await fetch(`http://127.0.0.1:${adapterPort}/api/image-edit`, {
    method: 'POST',
    body: form
  })
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert.equal(upstreamReceived, true)
  assert.equal(payload.preserveOutsideMask, true)
  assert.equal(payload.imageDataUrl, `data:image/png;base64,${ONE_PIXEL_PNG}`)
  console.log('image-edit adapter tests passed')
} finally {
  await Promise.all([close(adapter), close(upstream)])
}
