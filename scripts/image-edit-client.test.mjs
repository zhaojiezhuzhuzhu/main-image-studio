import assert from 'node:assert/strict'
import {
  appendHiddenPromptConstraint,
  appendInspirationConstraint,
  appendReferenceConstraint,
  DEFAULT_INSPIRATION_PROMPT,
  HIDDEN_INSPIRATION_CONSTRAINT,
  HIDDEN_PROMPT_CONSTRAINT,
  HIDDEN_REFERENCE_CONSTRAINT,
  isReferenceBackgroundPixel,
  MAX_IMAGE_EDIT_REQUEST_BYTES,
  traceConnectedReferenceBackground
} from '../src/services/imageEdit.js'

assert.equal(MAX_IMAGE_EDIT_REQUEST_BYTES, 4 * 1024 * 1024)
assert.match(HIDDEN_INSPIRATION_CONSTRAINT, /禁止保留矩形白底、灰底、边框或贴片效果/)
assert.match(HIDDEN_REFERENCE_CONSTRAINT, /完全忽略参考图的背景、白底、墙面、地面、阴影、画布边缘和矩形边界/)
assert.match(HIDDEN_REFERENCE_CONSTRAINT, /禁止把第二张图片整体、局部截图或任何矩形贴片复制到第一张图片/)

const referencePixels = new Uint8ClampedArray([
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 20, 24, 28, 255, 255, 255, 255, 255,
  255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
])
assert.equal(isReferenceBackgroundPixel(referencePixels, 0), true)
assert.equal(isReferenceBackgroundPixel(referencePixels, 4), false)
const tracedReference = traceConnectedReferenceBackground(referencePixels, 3, 3)
assert.equal(tracedReference.count, 8)
assert.equal(tracedReference.background[4], 0)

assert.equal(
  appendHiddenPromptConstraint('改柜子'),
  `改柜子，${HIDDEN_PROMPT_CONSTRAINT}`
)

assert.equal(
  appendHiddenPromptConstraint('  改柜子。  '),
  `改柜子。${HIDDEN_PROMPT_CONSTRAINT}`
)

assert.equal(
  appendHiddenPromptConstraint(`改柜子，${HIDDEN_PROMPT_CONSTRAINT}`),
  `改柜子，${HIDDEN_PROMPT_CONSTRAINT}`
)

assert.equal(
  appendReferenceConstraint('改柜子', true),
  `改柜子，${HIDDEN_PROMPT_CONSTRAINT}，${HIDDEN_REFERENCE_CONSTRAINT}`
)

assert.equal(
  appendReferenceConstraint('改柜子', false),
  `改柜子，${HIDDEN_PROMPT_CONSTRAINT}`
)

assert.equal(
  appendInspirationConstraint('温暖的奶油风客厅'),
  `温暖的奶油风客厅。${DEFAULT_INSPIRATION_PROMPT}，${HIDDEN_INSPIRATION_CONSTRAINT}`
)

assert.equal(
  appendInspirationConstraint(''),
  `${DEFAULT_INSPIRATION_PROMPT}，${HIDDEN_INSPIRATION_CONSTRAINT}`
)

console.log('image-edit client prompt tests passed')
