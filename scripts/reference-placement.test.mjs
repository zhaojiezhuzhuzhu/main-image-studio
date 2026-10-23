import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  createReferenceCanvasPlacement,
  mapReferencePlacementToGenerated
} from '../src/services/referencePlacement.js'

assert.deepEqual(createReferenceCanvasPlacement(1440, 1440), {
  requestWidth: 1440,
  requestHeight: 1440,
  contentX: 0,
  contentY: 0,
  contentWidth: 1440,
  contentHeight: 1440
})

const portrait = createReferenceCanvasPlacement(1080, 1440)
assert.deepEqual(portrait, {
  requestWidth: 1440,
  requestHeight: 1440,
  contentX: 180,
  contentY: 0,
  contentWidth: 1080,
  contentHeight: 1440
})
assert.deepEqual(mapReferencePlacementToGenerated(portrait, 1024, 1024), {
  x: 128,
  y: 0,
  width: 768,
  height: 1024
})

const landscape = createReferenceCanvasPlacement(1600, 900)
assert.deepEqual(landscape, {
  requestWidth: 1600,
  requestHeight: 1600,
  contentX: 0,
  contentY: 350,
  contentWidth: 1600,
  contentHeight: 900
})
assert.deepEqual(mapReferencePlacementToGenerated(landscape, 1024, 1024), {
  x: 0,
  y: 224,
  width: 1024,
  height: 576
})

const source = await readFile(new URL('../src/components/SingleImageMode.vue', import.meta.url), 'utf8')
assert.match(source, /async function createSelectionPayload\(\{[\s\S]*baseImageDataUrl = currentImage\.value,[\s\S]*maskSnapshot = cloneMaskCanvas\(\)/)
assert.match(source, /preserveCanvasGeometry: Boolean\(referenceImageBlob\)/)
assert.match(source, /const generationSnapshot = \{[\s\S]*baseImageDataUrl: currentImage\.value,[\s\S]*area: \{ \.\.\.ensureSelectionGeometry\(\) \},[\s\S]*maskSnapshot: cloneMaskCanvas\(\)/)
assert.match(source, /composition: \{ mode: 'canvas', area, maskSnapshot, placement, baseImageDataUrl \}/)
assert.match(source, /mapReferencePlacementToGenerated\(/)
assert.match(source, /createFeatheredMask\(composition\.maskSnapshot\)/)
assert.match(source, /loadImage\(composition\.baseImageDataUrl\)/)
assert.match(source, /composition: \{ mode: 'selection', area, maskSnapshot, baseImageDataUrl \}/)

console.log('reference placement tests passed')
