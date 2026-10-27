export const HIDDEN_PROMPT_CONSTRAINT = '不改变构图和非调整的区域'
export const HIDDEN_REFERENCE_CONSTRAINT = '第二张图片只作为用户描述目标物体的外观参考：只提取其中与用户描述对应的主体，完全忽略参考图的背景、白底、墙面、地面、阴影、画布边缘和矩形边界；禁止把第二张图片整体、局部截图或任何矩形贴片复制到第一张图片；仅在第一张图片的蒙版区域内，按照第一张图片原有的构图、透视、尺度、光线和遮挡关系自然重绘目标，严格保持蒙版外像素不变'
export const DEFAULT_INSPIRATION_PROMPT = '保持图1产品结构不变，参考图2的场景，生成图1产品的场景，光影融合自然，摄影棚电商风格'
export const HIDDEN_INSPIRATION_CONSTRAINT = '第一张图片是需要保留的商品白底图，保持商品主体的结构、比例、颜色、材质和细节不变；参考第二张图片的场景、构图、光影和氛围生成完整电商主图，只替换第一张图片的白色背景并自然融合商品；第一张图片的透明或白色画布不是场景，成图中禁止保留矩形白底、灰底、边框或贴片效果'
export const MAX_IMAGE_EDIT_REQUEST_BYTES = 4 * 1024 * 1024

const OBJECT_REFERENCE_MAX_EDGE = 1024
const OBJECT_REFERENCE_MIN_BACKGROUND_RATIO = 0.025
const OBJECT_REFERENCE_PADDING_RATIO = 0.06

function uploadFileName(blob, baseName) {
  if (blob?.type === 'image/jpeg') return `${baseName}.jpg`
  if (blob?.type === 'image/webp') return `${baseName}.webp`
  return `${baseName}.png`
}

async function optimizeReferenceRequestImage(blob, { maxEdge, quality, preserveAlpha = false }) {
  if (!(blob instanceof Blob) || typeof document === 'undefined' || typeof Image === 'undefined') return blob
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const candidate = new Image()
      candidate.onload = () => resolve(candidate)
      candidate.onerror = () => reject(new Error('图片压缩失败。'))
      candidate.src = objectUrl
    })
    const scale = Number.isFinite(maxEdge)
      ? Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
      : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!preserveAlpha) {
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('图片压缩失败。')),
        preserveAlpha ? 'image/webp' : 'image/jpeg',
        quality
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function isReferenceBackgroundPixel(pixels, pixelIndex) {
  const offset = pixelIndex * 4
  const alpha = pixels[offset + 3]
  if (alpha <= 16) return true
  const red = pixels[offset]
  const green = pixels[offset + 1]
  const blue = pixels[offset + 2]
  const minimum = Math.min(red, green, blue)
  const maximum = Math.max(red, green, blue)
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
  return minimum >= 214 && maximum - minimum <= 42 && luminance >= 228
}

export function traceConnectedReferenceBackground(pixels, width, height) {
  const total = width * height
  const background = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const enqueue = (pixelIndex) => {
    if (pixelIndex < 0 || pixelIndex >= total || background[pixelIndex]) return
    if (!isReferenceBackgroundPixel(pixels, pixelIndex)) return
    background[pixelIndex] = 1
    queue[tail++] = pixelIndex
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x)
    enqueue((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width)
    enqueue(y * width + width - 1)
  }

  while (head < tail) {
    const pixelIndex = queue[head++]
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    if (x > 0) enqueue(pixelIndex - 1)
    if (x + 1 < width) enqueue(pixelIndex + 1)
    if (y > 0) enqueue(pixelIndex - width)
    if (y + 1 < height) enqueue(pixelIndex + width)
  }

  return { background, count: tail }
}

function opaqueReferenceBounds(pixels, width, height) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] <= 16) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right >= left && bottom >= top ? { left, top, right, bottom } : null
}

function hasTransparentReferenceBorder(pixels, width, height) {
  let transparent = 0
  let samples = 0
  const sample = (pixelIndex) => {
    samples += 1
    if (pixels[pixelIndex * 4 + 3] <= 16) transparent += 1
  }
  for (let x = 0; x < width; x += 1) {
    sample(x)
    if (height > 1) sample((height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y += 1) {
    sample(y * width)
    if (width > 1) sample(y * width + width - 1)
  }
  return samples > 0 && transparent / samples >= 0.05
}

async function prepareObjectReferenceImage(blob) {
  if (!(blob instanceof Blob) || typeof document === 'undefined' || typeof Image === 'undefined') return blob
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const candidate = new Image()
      candidate.onload = () => resolve(candidate)
      candidate.onerror = () => reject(new Error('参考图片处理失败。'))
      candidate.src = objectUrl
    })
    const scale = Math.min(1, OBJECT_REFERENCE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const alreadyTransparent = hasTransparentReferenceBorder(imageData.data, canvas.width, canvas.height)
    if (!alreadyTransparent) {
      const traced = traceConnectedReferenceBackground(imageData.data, canvas.width, canvas.height)
      if (traced.count / (canvas.width * canvas.height) < OBJECT_REFERENCE_MIN_BACKGROUND_RATIO) {
        return optimizeReferenceRequestImage(blob, { maxEdge: OBJECT_REFERENCE_MAX_EDGE, quality: 0.84 })
      }
      for (let pixelIndex = 0; pixelIndex < traced.background.length; pixelIndex += 1) {
        if (traced.background[pixelIndex]) imageData.data[pixelIndex * 4 + 3] = 0
      }
    }
    const bounds = opaqueReferenceBounds(imageData.data, canvas.width, canvas.height)
    if (!bounds) {
      return optimizeReferenceRequestImage(blob, {
        maxEdge: OBJECT_REFERENCE_MAX_EDGE,
        quality: 0.84,
        preserveAlpha: alreadyTransparent
      })
    }
    context.putImageData(imageData, 0, 0)

    const subjectWidth = bounds.right - bounds.left + 1
    const subjectHeight = bounds.bottom - bounds.top + 1
    const padding = Math.max(4, Math.round(Math.max(subjectWidth, subjectHeight) * OBJECT_REFERENCE_PADDING_RATIO))
    const cropLeft = Math.max(0, bounds.left - padding)
    const cropTop = Math.max(0, bounds.top - padding)
    const cropRight = Math.min(canvas.width - 1, bounds.right + padding)
    const cropBottom = Math.min(canvas.height - 1, bounds.bottom + padding)
    const output = document.createElement('canvas')
    output.width = cropRight - cropLeft + 1
    output.height = cropBottom - cropTop + 1
    output.getContext('2d').drawImage(
      canvas,
      cropLeft,
      cropTop,
      output.width,
      output.height,
      0,
      0,
      output.width,
      output.height
    )
    return await new Promise((resolve, reject) => {
      output.toBlob(
        result => result ? resolve(result) : reject(new Error('参考图片处理失败。')),
        'image/webp',
        0.9
      )
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function appendHiddenPromptConstraint(prompt) {
  const userPrompt = String(prompt || '').trim()
  if (!userPrompt || userPrompt.endsWith(HIDDEN_PROMPT_CONSTRAINT)) {
    return userPrompt || HIDDEN_PROMPT_CONSTRAINT
  }
  const separator = /[，。！？；：,.!?;:]$/.test(userPrompt) ? '' : '，'
  return `${userPrompt}${separator}${HIDDEN_PROMPT_CONSTRAINT}`
}

export function appendReferenceConstraint(prompt, hasReferenceImage = false) {
  const constrainedPrompt = appendHiddenPromptConstraint(prompt)
  if (!hasReferenceImage || constrainedPrompt.includes(HIDDEN_REFERENCE_CONSTRAINT)) {
    return constrainedPrompt
  }
  return `${constrainedPrompt}，${HIDDEN_REFERENCE_CONSTRAINT}`
}

export function appendInspirationConstraint(prompt) {
  const specialRequirement = String(prompt || '').trim()
  const promptWithDefault = specialRequirement
    ? `${specialRequirement}。${DEFAULT_INSPIRATION_PROMPT}`
    : DEFAULT_INSPIRATION_PROMPT
  return `${promptWithDefault}，${HIDDEN_INSPIRATION_CONSTRAINT}`
}

export async function requestImageEditStatus(signal) {
  let response
  try {
    response = await fetch('/api/image-edit/status', { signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('无法连接本地图片服务，请确认项目已启动后重试。')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || '图片服务尚未完成配置。')
  }
  return response.json()
}

export async function requestImageEdit({ imageBlob, maskBlob, referenceImageBlob, prompt, signal, promptMode = 'edit' }) {
  let requestImageBlob = imageBlob
  let requestReferenceImageBlob = referenceImageBlob
  if (referenceImageBlob) {
    [requestImageBlob, requestReferenceImageBlob] = await Promise.all([
      // Inspiration mode depends on a transparent product matte. WebP keeps
      // that alpha channel while remaining small enough for Vercel.
      optimizeReferenceRequestImage(imageBlob, {
        maxEdge: Number.POSITIVE_INFINITY,
        quality: 0.9,
        preserveAlpha: promptMode === 'inspiration'
      }),
      promptMode === 'inspiration'
        ? optimizeReferenceRequestImage(referenceImageBlob, { maxEdge: 1024, quality: 0.84 })
        : prepareObjectReferenceImage(referenceImageBlob)
    ])
  }
  const requestBytes = requestImageBlob.size + maskBlob.size + (requestReferenceImageBlob?.size || 0)
  if (requestBytes > MAX_IMAGE_EDIT_REQUEST_BYTES) {
    throw new Error('图片数据仍然过大，已超过公网服务上传限制。请换用尺寸更小的参考图后重试。')
  }

  const formData = new FormData()
  formData.append('image', requestImageBlob, uploadFileName(requestImageBlob, 'source'))
  formData.append('mask', maskBlob, 'mask.png')
  if (requestReferenceImageBlob) {
    formData.append('reference_image', requestReferenceImageBlob, uploadFileName(requestReferenceImageBlob, 'reference'))
  }
  formData.append('request_mode', promptMode)
  formData.append('prompt', promptMode === 'inspiration'
  ? appendInspirationConstraint(prompt)
  : appendReferenceConstraint(prompt, Boolean(requestReferenceImageBlob)))

  let response
  try {
    response = await fetch('/api/image-edit', {
      method: 'POST',
      body: formData,
      signal
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new Error('无法连接本地图片服务，请确认项目已启动后重试。')
  }

  if (!response.ok) {
    const message = await response.json().catch(() => ({}))
    throw new Error(message.error || '模型服务暂时无法处理请求。')
  }

  return response.json()
}
