export const HIDDEN_PROMPT_CONSTRAINT = '不改变构图和非调整的区域'
export const HIDDEN_REFERENCE_CONSTRAINT = '参考第二张图片的材质、颜色、造型或风格，只修改第一张图片的蒙版区域，严格保持第一张图片原有构图、透视、物体位置和比例'
export const DEFAULT_INSPIRATION_PROMPT = '保持图1产品结构不变，参考图2的场景，生成图1产品的场景，光影融合自然，摄影棚电商风格'
export const HIDDEN_INSPIRATION_CONSTRAINT = '第一张图片是需要保留的商品白底图，保持商品主体的结构、比例、颜色、材质和细节不变；参考第二张图片的场景、构图、光影和氛围生成完整电商主图，只替换第一张图片的白色背景并自然融合商品'

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
  const formData = new FormData()
  formData.append('image', imageBlob, 'source.png')
  formData.append('mask', maskBlob, 'mask.png')
  if (referenceImageBlob) formData.append('reference_image', referenceImageBlob, 'reference.png')
  formData.append('request_mode', promptMode)
  formData.append('prompt', promptMode === 'inspiration'
  ? appendInspirationConstraint(prompt)
  : appendReferenceConstraint(prompt, Boolean(referenceImageBlob)))

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
