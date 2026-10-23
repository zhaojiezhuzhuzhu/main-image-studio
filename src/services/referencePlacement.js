function positiveDimension(value) {
  return Math.max(1, Number(value) || 1)
}

export function createReferenceCanvasPlacement(width, height) {
  const contentWidth = positiveDimension(width)
  const contentHeight = positiveDimension(height)
  const requestSize = Math.max(contentWidth, contentHeight)
  return {
    requestWidth: requestSize,
    requestHeight: requestSize,
    contentX: (requestSize - contentWidth) / 2,
    contentY: (requestSize - contentHeight) / 2,
    contentWidth,
    contentHeight
  }
}

export function mapReferencePlacementToGenerated(placement, generatedWidth, generatedHeight) {
  const width = positiveDimension(generatedWidth)
  const height = positiveDimension(generatedHeight)
  const scaleX = width / positiveDimension(placement?.requestWidth)
  const scaleY = height / positiveDimension(placement?.requestHeight)
  return {
    x: (Number(placement?.contentX) || 0) * scaleX,
    y: (Number(placement?.contentY) || 0) * scaleY,
    width: positiveDimension(placement?.contentWidth) * scaleX,
    height: positiveDimension(placement?.contentHeight) * scaleY
  }
}
