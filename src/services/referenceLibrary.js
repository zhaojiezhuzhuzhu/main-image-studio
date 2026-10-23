function localServiceError(error) {
  if (error?.name === 'AbortError') return error
  return new Error('无法读取本地软装搭配素材，请确认项目已启动后重试。')
}

export async function listReferenceLibrary(signal) {
  let response
  try {
    response = await fetch('/api/reference-library', { signal })
  } catch (error) {
    throw localServiceError(error)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || '无法读取本地软装搭配素材。')
  return Array.isArray(payload.items) ? payload.items : []
}

export async function referenceLibraryItemToFile(item, signal) {
  let response
  try {
    response = await fetch(item.url, { signal })
  } catch (error) {
    throw localServiceError(error)
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || '参考图读取失败。')
  }
  const blob = await response.blob()
  return new File([blob], item.name, { type: blob.type || 'image/png' })
}
