export const HIDDEN_PROMPT_CONSTRAINT = '不改变构图和非调整的区域'
export const HIDDEN_REFERENCE_CONSTRAINT = '参考第二张图片的材质、颜色、造型或风格，只修改第一张图片的蒙版区域，严格保持第一张图片原有构图、透视、物体位置和比例'
export const DEFAULT_INSPIRATION_PROMPT = '保持图1产品结构不变，参考图2的场景，生成图1产品的场景，光影融合自然，摄影棚电商风格'
export const HIDDEN_INSPIRATION_CONSTRAINT = '第一张图片是需要保留的商品白底图，保持商品主体的结构、比例、颜色、材质和细节不变；参考第二张图片的场景、构图、光影和氛围生成完整电商主图，只替换第一张图片的白色背景并自然融合商品'
export const MAX_IMAGE_EDIT_REQUEST_BYTES = 4 * 1024 * 1024

function uploadFileName(blob, baseName) {
  if (blob?.type === 'image/jpeg') return `${baseName}.jpg`
  if (blob?.type === 'image/webp') return `${baseName}.webp`
  return `${baseName}.png`
}

async function optimizeReferenceRequestImage(blob, { maxEdge, quality }) {
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
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error('图片压缩失败。')),
        'image/jpeg',
        quality
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
      // Preserve the source dimensions so the PNG mask still aligns exactly,
      // but encode the photo efficiently for Vercel's request body limit.
      optimizeReferenceRequestImage(imageBlob, { maxEdge: Number.POSITIVE_INFINITY, quality: 0.84 }),
      optimizeReferenceRequestImage(referenceImageBlob, { maxEdge: 1024, quality: 0.84 })
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
