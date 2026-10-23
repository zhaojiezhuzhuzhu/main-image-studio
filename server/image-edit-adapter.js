import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import https from 'node:https'

const DEFAULT_BASE_URL = 'https://4stoken.com/v1'
const DEFAULT_MODEL = 'gpt-image-2-c'
const DEFAULT_INSPIRATION_MODEL = 'gpt-image-2-c'
const DEFAULT_UPSTREAM_TIMEOUT_MS = 600_000
const TRUSTED_DOH_HOST = 'dns.alidns.com'
const TRUSTED_DOH_IP = '223.5.5.5'
const DNS_CACHE_TTL_MS = 10 * 60 * 1000
const trustedDnsCache = new Map()

function isFakeIpAddress(address) {
  const parts = String(address || '').split('.').map(Number)
  return parts.length === 4 && parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)
}

function requestBuffer(url, options = {}, connectAddress) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const headers = {
      Host: target.host,
      ...options.headers
    }
    if (options.body?.length && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-length')) {
      headers['Content-Length'] = String(options.body.length)
    }
    const request = https.request({
      protocol: 'https:',
      hostname: connectAddress || target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: options.method || 'GET',
      headers,
      servername: target.hostname,
      signal: options.signal
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      response.on('end', () => resolve({
        status: response.statusCode || 0,
        statusText: response.statusMessage || '',
        headers: response.headers,
        body: Buffer.concat(chunks)
      }))
    })
    request.on('error', reject)
    if (options.body?.length) request.write(options.body)
    request.end()
  })
}

async function resolveWithTrustedDns(hostname, signal) {
  const cached = trustedDnsCache.get(hostname)
  if (cached && cached.expiresAt > Date.now()) return cached.address

  const response = await requestBuffer(
    `https://${TRUSTED_DOH_HOST}/resolve?name=${encodeURIComponent(hostname)}&type=A`,
    { headers: { Accept: 'application/dns-json' }, signal },
    TRUSTED_DOH_IP
  )
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Trusted DNS request failed (${response.status}).`)
  }
  const payload = JSON.parse(response.body.toString('utf8'))
  const answer = payload?.Answer?.find((item) => item?.type === 1 && !isFakeIpAddress(item?.data))
  if (!answer?.data) throw new Error(`No public IPv4 address found for ${hostname}.`)

  const ttlMs = Math.max(60, Number(answer.TTL) || 600) * 1000
  trustedDnsCache.set(hostname, {
    address: answer.data,
    expiresAt: Date.now() + Math.min(ttlMs, DNS_CACHE_TTL_MS)
  })
  return answer.data
}

async function needsTrustedDns(hostname) {
  try {
    const addresses = await lookup(hostname, { all: true, family: 4 })
    return addresses.length > 0 && addresses.every(({ address }) => isFakeIpAddress(address))
  } catch {
    return true
  }
}

async function fetchWithDnsFallback(url, options = {}) {
  const target = new URL(url)
  if (target.protocol !== 'https:' || !(await needsTrustedDns(target.hostname))) {
    return fetch(url, options)
  }

  const prepared = new Request(url, options)
  const body = prepared.body ? Buffer.from(await prepared.arrayBuffer()) : undefined
  const address = await resolveWithTrustedDns(target.hostname, options.signal)
  const response = await requestBuffer(url, {
    method: prepared.method,
    headers: Object.fromEntries(prepared.headers),
    body,
    signal: options.signal
  }, address)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}

function sendJson(response, statusCode, payload) {
  if (response.headersSent) return
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
}

async function readRequestBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function parseIncomingForm(request) {
  const contentType = String(request.headers['content-type'] || '')
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new Error('请求格式无效，请重新提交。')
  }
  const body = await readRequestBody(request)
  return new Request('http://localhost/api/image-edit', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body
  }).formData()
}

function upstreamErrorMessage(status, payload) {
  if (status === 401 || status === 403) return '图片服务鉴权失败，请检查服务端 API 密钥。'
  if (status === 429) return '图片服务当前请求过多或额度不足，请稍后重试。'
  const detail = payload?.error?.message || payload?.message
  return typeof detail === 'string' && detail.trim()
    ? `图片服务返回错误：${detail.trim().slice(0, 240)}`
    : `图片服务请求失败（${status}）。`
}

async function readUpstreamPayload(response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 240) }
  }
}

async function resolveImageDataUrl(item, signal) {
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`
  if (!item?.url) throw new Error('图片服务没有返回可用的图片。')

  let imageResponse
  try {
    imageResponse = await fetchWithDnsFallback(item.url, { signal })
  } catch (cause) {
    const error = new Error('无法下载图片服务返回的结果。', { cause })
    error.statusCode = 502
    throw error
  }
  if (!imageResponse.ok) throw new Error('生成结果下载失败，请重试。')
  const contentType = String(imageResponse.headers.get('content-type') || 'image/png').split(';')[0]
  if (!contentType.startsWith('image/')) throw new Error('生成结果格式无效，请重试。')
  const bytes = Buffer.from(await imageResponse.arrayBuffer())
  return `data:${contentType};base64,${bytes.toString('base64')}`
}

export function imageEditAdapterPlugin(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const model = String(options.model || DEFAULT_MODEL).trim()
  const inspirationModel = String(options.inspirationModel || DEFAULT_INSPIRATION_MODEL).trim()
  const apiKey = String(options.apiKey || '').trim()
  const upstreamTimeoutMs = Math.max(30_000, Number(options.timeoutMs) || DEFAULT_UPSTREAM_TIMEOUT_MS)

  return {
    name: 'image-edit-adapter',
    configureServer(server) {
      server.middlewares.use('/api/image-edit', async (request, response, next) => {
        if (request.method === 'GET' && String(request.url || '').endsWith('/status')) {
          sendJson(response, apiKey ? 200 : 503, {
            configured: Boolean(apiKey),
            endpointConfigured: Boolean(baseUrl),
            modelConfigured: Boolean(model),
            ...(!apiKey ? { error: '图片服务尚未配置 API 密钥。' } : {})
          })
          return
        }
        if (request.method !== 'POST') {
          if (request.method === 'OPTIONS') {
            response.statusCode = 204
            response.end()
            return
          }
          next()
          return
        }

        if (!apiKey) {
          sendJson(response, 503, { error: '图片服务尚未配置 API 密钥。' })
          return
        }

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs)
        response.once('close', () => {
          if (!response.writableEnded) controller.abort()
        })

        try {
          const incoming = await parseIncomingForm(request)
          const image = incoming.get('image')
          const mask = incoming.get('mask')
          const referenceImage = incoming.get('reference_image')
          const requestMode = String(incoming.get('request_mode') || 'edit').trim()
          const prompt = String(incoming.get('prompt') || '').trim()
          if (!(image instanceof Blob) || image.size === 0) throw new Error('缺少待编辑图片。')
          if (!(mask instanceof Blob) || mask.size === 0) throw new Error('缺少有效蒙版。')
          if (referenceImage && (!(referenceImage instanceof Blob) || referenceImage.size === 0)) {
            throw new Error('参考图片无效。')
          }
          if (!prompt) throw new Error('请输入修改提示词。')

          const upstreamForm = new FormData()
          upstreamForm.set('model', requestMode === 'inspiration' ? inspirationModel : model)
          upstreamForm.set('prompt', prompt)
          if (referenceImage instanceof Blob) {
            upstreamForm.append('image[]', image, image.name || 'selection.png')
            upstreamForm.append('image[]', referenceImage, referenceImage.name || 'reference.png')
          } else {
            upstreamForm.set('image', image, image.name || 'selection.png')
          }
          upstreamForm.set('mask', mask, mask.name || 'mask.png')
          upstreamForm.set('n', '1')
          upstreamForm.set('size', '1024x1024')
          upstreamForm.set('response_format', 'b64_json')

          let upstream
          try {
            upstream = await fetchWithDnsFallback(`${baseUrl}/images/edits`, {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${apiKey}`
              },
              body: upstreamForm,
              signal: controller.signal
            })
          } catch (cause) {
            if (cause?.name === 'AbortError') throw cause
            const error = new Error('无法连接图片服务，请检查网络或 API 地址。', { cause })
            error.statusCode = 502
            throw error
          }
          const payload = await readUpstreamPayload(upstream)
          if (!upstream.ok) {
            sendJson(response, upstream.status === 429 ? 429 : 502, {
              error: upstreamErrorMessage(upstream.status, payload)
            })
            return
          }

          const imageDataUrl = await resolveImageDataUrl(payload?.data?.[0], controller.signal)
          sendJson(response, 200, {
            requestId: randomUUID(),
            imageDataUrl,
            preserveOutsideMask: true
          })
        } catch (error) {
          const message = error?.name === 'AbortError'
            ? '图片服务处理超过 10 分钟，可能正在排队，请稍后重试。'
            : error?.message || '图片服务请求失败，请重试。'
          sendJson(response, error?.name === 'AbortError' ? 504 : error?.statusCode || 400, { error: message })
        } finally {
          clearTimeout(timeout)
        }
      })
    }
  }
}
