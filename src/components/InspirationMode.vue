<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { ArrowLeft, ArrowRight, Download, EditPen, MagicStick, Picture, RefreshRight, UploadFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { requestImageEdit } from '../services/imageEdit.js'
import SingleImageMode from './SingleImageMode.vue'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const OUTPUT_LONG_EDGE = 1440
const RATIOS = [
  { key: '1:1', value: 1 },
  { key: '3:4', value: 3 / 4 }
]
const IMAGE_COUNTS = [1, 2, 3, 4]

const productInput = ref(null)
const referenceInput = ref(null)
const productImage = ref('')
const productName = ref('')
const productSize = ref(0)
const productWidth = ref(0)
const productHeight = ref(0)
const referenceImage = ref('')
const referenceName = ref('')
const referenceSize = ref(0)
const referenceWidth = ref(0)
const referenceHeight = ref(0)
const specialRequirement = ref('')
const ratioKey = ref('1:1')
const imageCount = ref(1)
const results = ref([])
const activeResultIndex = ref(0)
const generationProgress = ref(0)
const productError = ref('')
const referenceError = ref('')
const generateError = ref('')
const isGenerating = ref(false)
const isPreparingLocalEdit = ref(false)
const draggingTarget = ref('')
const workspaceStage = ref('generate')
const refineSeed = ref(null)

let generateController = null

const activeRatio = computed(() => RATIOS.find(item => item.key === ratioKey.value) || RATIOS[0])
const outputSize = computed(() => {
  const ratio = activeRatio.value.value
  return ratio >= 1
    ? { width: OUTPUT_LONG_EDGE, height: Math.round(OUTPUT_LONG_EDGE / ratio) }
    : { width: Math.round(OUTPUT_LONG_EDGE * ratio), height: OUTPUT_LONG_EDGE }
})
const activeResult = computed(() => results.value[activeResultIndex.value] || null)
const canGenerate = computed(() => Boolean(
  productImage.value && referenceImage.value && !isGenerating.value
))

function clearResults() {
  results.value = []
  activeResultIndex.value = 0
  generationProgress.value = 0
  workspaceStage.value = 'generate'
  refineSeed.value = null
}

async function startRefiningActiveResult() {
  if (!activeResult.value?.imageDataUrl || isGenerating.value || isPreparingLocalEdit.value) return
  isPreparingLocalEdit.value = true
  try {
    const resultIndex = activeResultIndex.value
    const result = activeResult.value
    const targetWidth = result.width || outputSize.value.width
    const targetHeight = result.height || outputSize.value.height
    const imageDataUrl = await resizeImageWithoutCropping(result.imageDataUrl, targetWidth, targetHeight)
    results.value = results.value.map((item, index) => index === resultIndex
      ? { ...item, imageDataUrl, width: targetWidth, height: targetHeight, ratioKey: result.ratioKey || ratioKey.value }
      : item)
    refineSeed.value = {
      resultIndex,
      imageDataUrl,
      width: targetWidth,
      height: targetHeight,
      ratioKey: result.ratioKey || ratioKey.value,
      fileName: `灵感成图-${String(resultIndex + 1).padStart(2, '0')}.png`
    }
    workspaceStage.value = 'refine'
  } catch (error) {
    ElMessage.error(error?.message || '无法打开这张灵感图。')
  } finally {
    isPreparingLocalEdit.value = false
  }
}

function exitRefining() {
  workspaceStage.value = 'generate'
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败。')), type, quality)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败，请换一张图片重试。'))
    image.src = src
  })
}

async function resizeImageWithoutCropping(src, width, height) {
  const image = await loadImage(src)
  if (image.naturalWidth === width && image.naturalHeight === height) return src
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片读取失败，请重试。'))
    reader.readAsDataURL(file)
  })
}

async function decodeFile(file) {
  const dataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(dataUrl)
  return { dataUrl, width: image.naturalWidth, height: image.naturalHeight }
}

async function acceptImage(kind, file) {
  const error = kind === 'product' ? productError : referenceError
  error.value = ''
  if (!file) return
  if (!ACCEPTED_TYPES.has(file.type)) {
    error.value = '仅支持 JPG、PNG 或 WebP 图片。'
    return
  }
  if (file.size === 0) {
    error.value = '图片文件为空。'
    return
  }
  try {
    const decoded = await decodeFile(file)
    if (kind === 'product') {
      productImage.value = decoded.dataUrl
      productName.value = file.name
      productSize.value = file.size
      productWidth.value = decoded.width
      productHeight.value = decoded.height
    } else {
      referenceImage.value = decoded.dataUrl
      referenceName.value = file.name
      referenceSize.value = file.size
      referenceWidth.value = decoded.width
      referenceHeight.value = decoded.height
    }
    clearResults()
  } catch (uploadFailure) {
    error.value = uploadFailure?.message || '图片读取失败，请重试。'
  } finally {
    if (kind === 'product' && productInput.value) productInput.value.value = ''
    if (kind === 'reference' && referenceInput.value) referenceInput.value.value = ''
  }
}

function handleDrop(kind, event) {
  event.preventDefault()
  draggingTarget.value = ''
  acceptImage(kind, event.dataTransfer.files?.[0])
}

function removeImage(kind) {
  if (kind === 'product') {
    productImage.value = ''
    productName.value = ''
    productSize.value = 0
    productWidth.value = 0
    productHeight.value = 0
    productError.value = ''
  } else {
    referenceImage.value = ''
    referenceName.value = ''
    referenceSize.value = 0
    referenceWidth.value = 0
    referenceHeight.value = 0
    referenceError.value = ''
  }
  clearResults()
}

function setRatio(key) {
  ratioKey.value = key
  clearResults()
}

function setImageCount(count) {
  imageCount.value = count
  clearResults()
}

async function createInspirationPayload() {
  const source = await loadImage(productImage.value)
  const reference = await loadImage(referenceImage.value)
  const { width, height } = outputSize.value
  const imageCanvas = createCanvas(width, height)
  const imageContext = imageCanvas.getContext('2d', { willReadFrequently: true })
  imageContext.fillStyle = '#fff'
  imageContext.fillRect(0, 0, width, height)

  const inset = Math.round(Math.min(width, height) * 0.045)
  const scale = Math.min((width - inset * 2) / source.naturalWidth, (height - inset * 2) / source.naturalHeight)
  const drawWidth = Math.max(1, Math.round(source.naturalWidth * scale))
  const drawHeight = Math.max(1, Math.round(source.naturalHeight * scale))
  const drawX = Math.round((width - drawWidth) / 2)
  const drawY = Math.round((height - drawHeight) / 2)
  imageContext.drawImage(source, drawX, drawY, drawWidth, drawHeight)

  const pixels = imageContext.getImageData(0, 0, width, height)
  const maskCanvas = createCanvas(width, height)
  const maskContext = maskCanvas.getContext('2d')
  const mask = maskContext.createImageData(width, height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index]
    const green = pixels.data[index + 1]
    const blue = pixels.data[index + 2]
    const distanceFromWhite = Math.hypot(255 - red, 255 - green, 255 - blue)
    const protection = Math.max(0, Math.min(255, Math.round((distanceFromWhite - 14) * 8)))
    mask.data[index] = 255
    mask.data[index + 1] = 255
    mask.data[index + 2] = 255
    mask.data[index + 3] = protection
    // Use the same matte for the source image itself. This prevents the
    // image model from treating the original white canvas as a rectangular
    // object when more than one result is requested.
    pixels.data[index + 3] = protection
  }
  imageContext.putImageData(pixels, 0, 0)
  maskContext.putImageData(mask, 0, 0)

  const referenceScale = Math.min(1, OUTPUT_LONG_EDGE / Math.max(reference.naturalWidth, reference.naturalHeight))
  const referenceCanvas = createCanvas(
    Math.max(1, Math.round(reference.naturalWidth * referenceScale)),
    Math.max(1, Math.round(reference.naturalHeight * referenceScale))
  )
  referenceCanvas.getContext('2d').drawImage(reference, 0, 0, referenceCanvas.width, referenceCanvas.height)

  const [imageBlob, maskBlob, referenceImageBlob] = await Promise.all([
    canvasToBlob(imageCanvas),
    canvasToBlob(maskCanvas),
    canvasToBlob(referenceCanvas, 'image/jpeg', 0.9)
  ])
  return { imageBlob, maskBlob, referenceImageBlob }
}

function validateGenerate() {
  productError.value = productImage.value ? '' : '请先上传商品白底图。'
  referenceError.value = referenceImage.value ? '' : '请先上传参考图。'
  generateError.value = ''
  return !productError.value && !referenceError.value
}

async function generateInspiration() {
  if (!validateGenerate()) return
  isGenerating.value = true
  generateError.value = ''
  clearResults()
  generateController = new AbortController()
  try {
    const targetCount = imageCount.value
    const requirement = specialRequirement.value.trim()
    const payload = await createInspirationPayload()
    for (let index = 0; index < targetCount; index += 1) {
      const response = await requestImageEdit({
        ...payload,
        prompt: requirement,
        promptMode: 'inspiration',
        signal: generateController.signal
      })
      if (!response.imageDataUrl) throw new Error('图片服务没有返回生成结果。')
      const resultSize = { ...outputSize.value }
      const imageDataUrl = await resizeImageWithoutCropping(response.imageDataUrl, resultSize.width, resultSize.height)
      results.value.push({
        id: response.requestId || `${Date.now()}-${index}`,
        imageDataUrl,
        width: resultSize.width,
        height: resultSize.height,
        ratioKey: ratioKey.value
      })
      generationProgress.value = index + 1
    }
    ElMessage.success(`${targetCount} 张灵感图已生成`)
  } catch (error) {
    if (error?.name !== 'AbortError') {
      const prefix = results.value.length ? `已完成 ${results.value.length} 张，后续生成失败：` : ''
      generateError.value = `${prefix}${error?.message || '生成失败，请重试。'}`
    }
  } finally {
    isGenerating.value = false
    generateController = null
  }
}

function cancelGenerate() {
  generateController?.abort()
}

async function downloadResult(result = activeResult.value, index = activeResultIndex.value) {
  if (!result?.imageDataUrl) return
  const response = await fetch(result.imageDataUrl)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `灵感图-${ratioKey.value.replace(':', 'x')}-${String(index + 1).padStart(2, '0')}.png`
  link.click()
  URL.revokeObjectURL(url)
}

onUnmounted(() => generateController?.abort())
</script>

<template>
  <SingleImageMode
    v-if="workspaceStage === 'refine' && refineSeed"
    embedded-refine
    :refine-image="refineSeed.imageDataUrl"
    :refine-file-name="refineSeed.fileName"
    :refine-width="refineSeed.width"
    :refine-height="refineSeed.height"
    :refine-ratio="refineSeed.ratioKey"
    @exit-refine="exitRefining"
  />
  <main v-else class="inspiration-workspace">
    <aside class="inspiration-controls">
      <div class="inspiration-heading">
        <span>01</span>
        <div><strong>准备灵感素材</strong><small>商品白底图 + 场景参考图</small></div>
      </div>

      <section class="inspiration-upload-section" aria-labelledby="product-upload-label">
        <div class="upload-title-row">
          <div><strong id="product-upload-label">商品白底图</strong><span>保留商品主体</span></div>
          <button v-if="productImage" type="button" @click="removeImage('product')">移除</button>
        </div>
        <div
          v-if="!productImage"
          class="inspiration-drop-zone"
          :class="{ dragging: draggingTarget === 'product' }"
          role="button"
          tabindex="0"
          aria-label="上传商品白底图"
          @click="productInput?.click()"
          @keydown.enter.prevent="productInput?.click()"
          @keydown.space.prevent="productInput?.click()"
          @dragover.prevent="draggingTarget = 'product'"
          @dragleave.prevent="draggingTarget = ''"
          @drop="handleDrop('product', $event)"
        >
          <UploadFilled aria-hidden="true" />
          <strong>上传白底商品图</strong>
          <span>拖放到此处，或点击选择</span>
          <small>JPG、PNG、WebP · 不限制文件大小</small>
        </div>
        <div v-else class="inspiration-file-card">
          <img :src="productImage" alt="商品白底图预览" />
          <div><strong>{{ productName }}</strong><span>{{ productWidth }} × {{ productHeight }} px · {{ formatBytes(productSize) }}</span></div>
          <button type="button" @click="productInput?.click()">更换</button>
        </div>
        <input ref="productInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="acceptImage('product', $event.target.files?.[0])" />
        <p v-if="productError" class="inspiration-field-error" role="alert">{{ productError }}</p>
      </section>

      <section class="inspiration-upload-section" aria-labelledby="reference-upload-label">
        <div class="upload-title-row">
          <div><strong id="reference-upload-label">参考图</strong><span>参考场景、构图与光影</span></div>
          <button v-if="referenceImage" type="button" @click="removeImage('reference')">移除</button>
        </div>
        <div
          v-if="!referenceImage"
          class="inspiration-drop-zone compact"
          :class="{ dragging: draggingTarget === 'reference' }"
          role="button"
          tabindex="0"
          aria-label="上传参考图"
          @click="referenceInput?.click()"
          @keydown.enter.prevent="referenceInput?.click()"
          @keydown.space.prevent="referenceInput?.click()"
          @dragover.prevent="draggingTarget = 'reference'"
          @dragleave.prevent="draggingTarget = ''"
          @drop="handleDrop('reference', $event)"
        >
          <Picture aria-hidden="true" />
          <strong>上传参考图</strong>
          <small>JPG、PNG、WebP · 不限制文件大小</small>
        </div>
        <div v-else class="inspiration-file-card">
          <img :src="referenceImage" alt="参考图预览" />
          <div><strong>{{ referenceName }}</strong><span>{{ referenceWidth }} × {{ referenceHeight }} px · {{ formatBytes(referenceSize) }}</span></div>
          <button type="button" @click="referenceInput?.click()">更换</button>
        </div>
        <input ref="referenceInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="acceptImage('reference', $event.target.files?.[0])" />
        <p v-if="referenceError" class="inspiration-field-error" role="alert">{{ referenceError }}</p>
      </section>

      <form class="inspiration-form" novalidate @submit.prevent="generateInspiration">
        <label for="inspiration-prompt">特殊要求 <small>选填</small></label>
        <textarea
          id="inspiration-prompt"
          v-model="specialRequirement"
          class="resize-none"
          rows="4"
          maxlength="500"
          placeholder="例如：使用午后暖光，增加绿植点缀"
          aria-describedby="inspiration-prompt-help"
        />
        <div class="inspiration-prompt-meta"><span id="inspiration-prompt-help">不填写也会按默认要求生成</span><span>{{ specialRequirement.length }}/500</span></div>

        <div class="inspiration-ratio-field">
          <span>成图比例</span>
          <div class="inspiration-ratios" role="radiogroup" aria-label="成图比例">
            <button
              v-for="ratio in RATIOS"
              :key="ratio.key"
              type="button"
              role="radio"
              :class="{ active: ratioKey === ratio.key }"
              :aria-checked="ratioKey === ratio.key"
              :disabled="isGenerating"
              @click="setRatio(ratio.key)"
            >{{ ratio.key }}</button>
          </div>
        </div>

        <div class="inspiration-count-field">
          <span>生成张数</span>
          <div class="inspiration-counts" role="radiogroup" aria-label="生成张数">
            <button
              v-for="count in IMAGE_COUNTS"
              :key="count"
              type="button"
              role="radio"
              :class="{ active: imageCount === count }"
              :aria-checked="imageCount === count"
              :disabled="isGenerating"
              @click="setImageCount(count)"
            >{{ count }} 张</button>
          </div>
        </div>

        <div v-if="generateError" class="inspiration-inline-error" role="alert">
          <span>{{ generateError }}</span>
          <button type="button" @click="generateInspiration">重试</button>
        </div>
        <button class="inspiration-generate-button" type="submit" :disabled="!canGenerate" :aria-busy="isGenerating">
          <MagicStick aria-hidden="true" />
          <span>{{ isGenerating ? `正在生成 ${generationProgress}/${imageCount} 张…` : `生成 ${imageCount} 张灵感图` }}</span>
        </button>
        <button v-if="isGenerating" class="inspiration-cancel-button" type="button" @click="cancelGenerate">取消生成</button>
      </form>
    </aside>

    <section class="inspiration-canvas-panel" aria-label="灵感图生成结果">
      <div class="inspiration-canvas-head">
        <div><span class="inspiration-live-dot" aria-hidden="true"></span><strong>{{ activeResult ? `灵感成图 ${activeResultIndex + 1}/${results.length}` : '等待生成' }}</strong><span>{{ ratioKey }} · {{ outputSize.width }}×{{ outputSize.height }}</span></div>
        <div v-if="activeResult" class="inspiration-result-actions">
          <button v-if="results.length > 1" type="button" class="inspiration-result-nav" aria-label="查看上一张灵感图" @click="activeResultIndex = (activeResultIndex - 1 + results.length) % results.length"><ArrowLeft /></button>
          <button v-if="results.length > 1" type="button" class="inspiration-result-nav" aria-label="查看下一张灵感图" @click="activeResultIndex = (activeResultIndex + 1) % results.length"><ArrowRight /></button>
          <button type="button" class="inspiration-refine-button" aria-label="进入局部编辑" :disabled="isPreparingLocalEdit" :aria-busy="isPreparingLocalEdit" @click="startRefiningActiveResult"><EditPen /><span>{{ isPreparingLocalEdit ? '正在打开…' : '进入局部编辑' }}</span></button>
          <button type="button" class="inspiration-regenerate-button" aria-label="按当前设置重新生成" :disabled="isGenerating" @click="generateInspiration"><RefreshRight /><span>重新生成</span></button>
          <button type="button" class="inspiration-download-button" aria-label="下载当前图片" @click="downloadResult()"><Download /><span>下载当前图片</span></button>
        </div>
      </div>
      <div class="inspiration-canvas-stage" :class="{ empty: !activeResult }">
        <div v-if="!activeResult" class="inspiration-placeholder">
          <span><MagicStick aria-hidden="true" /></span>
          <strong>上传两张图片并生成灵感图</strong>
          <p>白底图决定商品主体，参考图提供场景、构图与光影方向。</p>
        </div>
        <img v-else :src="activeResult.imageDataUrl" :alt="`生成的灵感图 ${activeResultIndex + 1}`" />
        <div v-if="isGenerating" class="inspiration-generating" role="status" aria-live="polite">
          <span class="inspiration-spinner" aria-hidden="true"></span>
          <strong>正在生成第 {{ Math.min(generationProgress + 1, imageCount) }}/{{ imageCount }} 张</strong>
          <small>已完成 {{ generationProgress }} 张，中转生成通常需要数分钟，请勿刷新页面</small>
        </div>
      </div>
      <div class="inspiration-canvas-footer" aria-live="polite">
        <span>{{ activeResult ? `已生成 ${results.length} 张，可切换查看并下载` : '商品主体会被自动保护' }}</span>
        <span>{{ outputSize.width }} × {{ outputSize.height }} px</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.inspiration-workspace { min-height: calc(100vh - 68px); display: grid; grid-template-columns: 360px minmax(0, 1fr); background: var(--menu-studio); color: #eaf6f5; }
.inspiration-controls { min-width: 0; padding: 22px; background: var(--menu-studio); overflow-y: auto; scrollbar-gutter: stable; }
.inspiration-controls { border-right: 1px solid var(--menu-studio-line); }
.inspiration-heading { display: flex; align-items: flex-start; gap: 12px; }
.inspiration-heading > span { display: inline-grid; place-items: center; min-width: 31px; height: 23px; border-radius: 5px; background: var(--accent-bright); color: #123d3b; font: 700 11px/1 Montserrat, sans-serif; }
.inspiration-heading div { display: grid; gap: 3px; }
.inspiration-heading strong { font-size: 14px; line-height: 1.4; }
.inspiration-heading small { color: #9eb2b8; font-size: 11px; line-height: 1.5; }
.inspiration-heading.small { margin-bottom: 18px; }
.inspiration-upload-section { margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--menu-studio-line); }
.upload-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.upload-title-row > div { display: grid; gap: 3px; }
.upload-title-row strong, .inspiration-form > label, .inspiration-ratio-field > span, .inspiration-count-field > span { color: #f1f9f8; font-size: 12px; font-weight: 600; }
.inspiration-form > label small { margin-left: 4px; color: #82999f; font-size: 10px; font-weight: 400; }
.upload-title-row span { color: #8fa5aa; font-size: 10px; }
.upload-title-row button, .inspiration-file-card button { padding: 0; border: 0; background: transparent; color: var(--accent-bright); font-size: 11px; cursor: pointer; }
.upload-title-row button:focus-visible, .inspiration-file-card button:focus-visible, .inspiration-inline-error button:focus-visible { outline: 2px solid #c9fff6; outline-offset: 2px; }
.inspiration-drop-zone { min-height: 122px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 16px; border: 1px dashed #55707a; border-radius: 7px; background: #22313d; color: #c5d4d7; text-align: center; cursor: pointer; transition: border-color .16s ease, background-color .16s ease; }
.inspiration-drop-zone.compact { min-height: 92px; }
.inspiration-drop-zone:hover, .inspiration-drop-zone:focus-visible, .inspiration-drop-zone.dragging { border-color: var(--accent-bright); background: #243b45; outline: none; }
.inspiration-drop-zone > svg { width: 24px; height: 24px; color: var(--accent-bright); }
.inspiration-drop-zone strong { font-size: 12px; }
.inspiration-drop-zone span, .inspiration-drop-zone small { color: #91a7ac; font-size: 10px; line-height: 1.5; }
.inspiration-file-card { min-height: 72px; display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px; border: 1px solid #46606a; border-radius: 7px; background: #22313d; }
.inspiration-file-card img { display: block; width: 58px; height: 58px; object-fit: cover; border-radius: 5px; background: #fff; }
.inspiration-file-card > div { min-width: 0; display: grid; gap: 5px; }
.inspiration-file-card strong { overflow: hidden; color: #edf7f6; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.inspiration-file-card span { color: #8fa5aa; font: 10px/1.4 Montserrat, sans-serif; }
.inspiration-form { display: grid; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--menu-studio-line); }
.inspiration-form textarea { min-height: 106px; margin-top: 9px; padding: 11px; resize: none; border: 1px solid #4c6570; border-radius: 7px; outline: none; background: #23323f; color: #eef8f7; font: inherit; font-size: 12px; line-height: 1.65; }
.inspiration-form textarea::placeholder { color: #768d94; }
.inspiration-form textarea:focus { border-color: var(--accent-bright); box-shadow: 0 0 0 2px rgba(58, 239, 208, .12); }
.inspiration-prompt-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; color: #839aa0; font-size: 10px; }
.inspiration-ratio-field, .inspiration-count-field { margin-top: 18px; }
.inspiration-ratios, .inspiration-counts { display: grid; gap: 6px; margin-top: 9px; }
.inspiration-ratios { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.inspiration-counts { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.inspiration-ratios button, .inspiration-counts button { height: 31px; border: 1px solid #405866; border-radius: 5px; background: #263745; color: #d6e3e5; font: 600 10px/1 Montserrat, sans-serif; cursor: pointer; }
.inspiration-ratios button:hover:not(:disabled), .inspiration-counts button:hover:not(:disabled) { border-color: #73928f; }
.inspiration-ratios button.active, .inspiration-counts button.active { border-color: var(--accent-bright); background: #183f42; color: var(--accent-bright); }
.inspiration-ratios button:disabled, .inspiration-counts button:disabled { cursor: not-allowed; opacity: .48; }
.inspiration-ratios button:focus-visible, .inspiration-counts button:focus-visible, .inspiration-generate-button:focus-visible, .inspiration-cancel-button:focus-visible, .inspiration-download-button:focus-visible, .inspiration-result-nav:focus-visible, .inspiration-refine-button:focus-visible, .inspiration-regenerate-button:focus-visible { outline: 2px solid #c9fff6; outline-offset: 2px; }
.inspiration-field-error { margin: 8px 0 0; color: #ffaaa1; font-size: 11px; line-height: 1.5; }
.inspiration-inline-error { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-top: 14px; padding: 10px; border: 1px solid rgba(255, 115, 95, .45); border-radius: 6px; background: rgba(179, 49, 45, .15); color: #ffc0b8; font-size: 11px; line-height: 1.5; }
.inspiration-inline-error button { border: 0; background: transparent; color: #fff; cursor: pointer; text-decoration: underline; }
.inspiration-generate-button, .inspiration-cancel-button { width: 100%; height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border-radius: 6px; cursor: pointer; }
.inspiration-generate-button { margin-top: 16px; border: 0; background: #2e8b82; color: #f4fffd; font-weight: 600; }
.inspiration-generate-button:hover:not(:disabled) { background: #35a197; }
.inspiration-generate-button:disabled { cursor: not-allowed; opacity: .48; }
.inspiration-generate-button svg, .inspiration-download-button svg, .inspiration-refine-button svg, .inspiration-regenerate-button svg { width: 16px; height: 16px; }
.inspiration-cancel-button { margin-top: 8px; border: 1px solid #4c6570; background: transparent; color: #c9d8da; }
.inspiration-canvas-panel { min-width: 0; min-height: 0; display: grid; grid-template-rows: 52px minmax(0, 1fr) 36px; background-color: var(--canvas-work); background-image: radial-gradient(var(--canvas-dot) 1px, transparent 1px); background-size: 18px 18px; color: var(--ink); }
.inspiration-canvas-head, .inspiration-canvas-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 18px; background: var(--menu-studio); color: #dce8e9; }
.inspiration-canvas-head { border-bottom: 1px solid var(--menu-studio-line); }
.inspiration-canvas-head > div { display: flex; align-items: center; gap: 9px; min-width: 0; }
.inspiration-canvas-head strong { font-size: 12px; }
.inspiration-canvas-head span:not(.inspiration-live-dot) { color: #8fa5aa; font-size: 10px; }
.inspiration-live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-bright); box-shadow: 0 0 0 3px rgba(58, 239, 208, .12); }
.inspiration-result-actions { display: inline-flex; align-items: center; gap: 6px; }
.inspiration-download-button, .inspiration-refine-button, .inspiration-regenerate-button, .inspiration-result-nav { height: 32px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #4c6570; border-radius: 5px; background: #22313d; color: #e4f1f0; cursor: pointer; }
.inspiration-download-button, .inspiration-refine-button, .inspiration-regenerate-button { gap: 6px; padding: 0 11px; }
.inspiration-refine-button { border-color: var(--accent-bright); color: var(--accent-bright); }
.inspiration-refine-button:hover { background: #183f42; }
.inspiration-regenerate-button:hover:not(:disabled) { border-color: var(--accent-bright); color: var(--accent-bright); }
.inspiration-regenerate-button:disabled { cursor: not-allowed; opacity: .5; }
.inspiration-result-nav { width: 32px; padding: 0; }
.inspiration-result-nav svg { width: 14px; height: 14px; }
.inspiration-canvas-stage { position: relative; min-height: 0; display: grid; place-items: center; padding: 38px; overflow: auto; scrollbar-gutter: stable; }
.inspiration-canvas-stage > img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; border: 1px solid #d4dfe3; background: #fff; box-shadow: 0 18px 48px rgba(20, 34, 42, .18); }
.inspiration-placeholder { max-width: 390px; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #6b7c84; text-align: center; }
.inspiration-placeholder > span { width: 62px; height: 62px; display: grid; place-items: center; border: 1px dashed #afc0c7; border-radius: 12px; background: rgba(255, 255, 255, .76); color: #6a9b95; }
.inspiration-placeholder svg { width: 27px; height: 27px; }
.inspiration-placeholder strong { color: #33464d; font-size: 15px; }
.inspiration-placeholder p { margin: 0; font-size: 12px; line-height: 1.7; }
.inspiration-generating { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; background: rgba(247, 249, 252, .88); backdrop-filter: blur(2px); color: #31464b; }
.inspiration-generating strong { font-size: 13px; }
.inspiration-generating small { color: #73858b; font-size: 11px; }
.inspiration-spinner { width: 28px; height: 28px; border: 3px solid #bfd6d3; border-top-color: var(--accent-strong); border-radius: 50%; animation: inspiration-spin .8s linear infinite; }
.inspiration-canvas-footer { border-top: 1px solid var(--menu-studio-line); color: #8fa5aa; font-size: 10px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@keyframes inspiration-spin { to { transform: rotate(360deg); } }

@media (max-width: 1180px) {
  .inspiration-workspace { grid-template-columns: 340px minmax(0, 1fr); }
  .inspiration-download-button, .inspiration-refine-button, .inspiration-regenerate-button { width: 32px; padding: 0; }
  .inspiration-download-button span, .inspiration-refine-button span, .inspiration-regenerate-button span { display: none; }
}

@media (max-width: 760px) {
  .inspiration-workspace { display: block; min-height: calc(100vh - 60px); }
  .inspiration-controls { overflow: visible; }
  .inspiration-controls { border-right: 0; border-bottom: 1px solid var(--menu-studio-line); }
  .inspiration-canvas-panel { min-height: 620px; grid-template-rows: 52px 1fr 36px; }
  .inspiration-canvas-stage { min-height: 520px; padding: 18px; }
  .inspiration-canvas-head { gap: 8px; padding: 0 12px; }
  .inspiration-canvas-head > div:first-child { gap: 6px; }
  .inspiration-canvas-head > div:first-child > span:last-child { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .inspiration-drop-zone { transition: none; }
  .inspiration-spinner { animation-duration: 1.8s; }
}
</style>
