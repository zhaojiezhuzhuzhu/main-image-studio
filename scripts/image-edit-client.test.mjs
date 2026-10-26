import assert from 'node:assert/strict'
import {
  appendHiddenPromptConstraint,
  appendInspirationConstraint,
  appendReferenceConstraint,
  DEFAULT_INSPIRATION_PROMPT,
  HIDDEN_INSPIRATION_CONSTRAINT,
  HIDDEN_PROMPT_CONSTRAINT,
  HIDDEN_REFERENCE_CONSTRAINT,
  MAX_IMAGE_EDIT_REQUEST_BYTES
} from '../src/services/imageEdit.js'

assert.equal(MAX_IMAGE_EDIT_REQUEST_BYTES, 4 * 1024 * 1024)
assert.match(HIDDEN_INSPIRATION_CONSTRAINT, /禁止保留矩形白底、灰底、边框或贴片效果/)

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
