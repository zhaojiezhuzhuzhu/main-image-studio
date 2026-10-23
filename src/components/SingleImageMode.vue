<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import {
  Back,
  CirclePlus,
  Crop,
  Delete,
  Download,
  FolderOpened,
  MagicStick,
  Picture,
  Plus,
  Rank,
  RefreshLeft,
  Right,
  UploadFilled
} from '@element-plus/icons-vue'
import { requestImageEdit, requestImageEditStatus } from '../services/imageEdit.js'
import { createReferenceCanvasPlacement, mapReferencePlacementToGenerated } from '../services/referencePlacement.js'
import { listReferenceLibrary, referenceLibraryItemToFile } from '../services/referenceLibrary.js'
import {
  createProjectId,
  deleteSingleProject,
  listSingleProjects,
  loadSingleProject,
  saveSingleProject
} from '../services/singleProjectStore.js'

const props = defineProps({
  embeddedRefine: { type: Boolean, default: false },
  refineImage: { type: String, default: '' },
  refineFileName: { type: String, default: '灵感成图' },
  refineWidth: { type: Number, default: 0 },
  refineHeight: { type: Number, default: 0 },
  refineRatio: { type: String, default: '1:1' }
})

const emit = defineEmits(['exit-refine'])

const MAX_HISTORY = 10
const EXPORT_MAX_BYTES = 1_000_000
const CANVAS_SIZE = 1440
const MIN_SELECTION_SIZE = 32
const SELECTION_HANDLE_HIT_RADIUS_CSS = 7
const SAVE_SUCCESS_VISIBLE_MS = 1400
const REFERENCE_PROMPT_DEFAULT = '将选区的【抱枕】替换为参考图的【抱枕】，其他不变'
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const SELECTION_RATIOS = [
  { key: '1:1', value: 1 },
  { key: '3:2', value: 3 / 2 },
  { key: '2:3', value: 2 / 3 },
  { key: '4:3', value: 4 / 3 },
  { key: '3:4', value: 3 / 4 },
  { key: '9:16', value: 9 / 16 },
  { key: '16:9', value: 16 / 9 }
]

const view = ref('workspace')
const stage = ref('generate')
const projectId = ref('')
const projectName = ref('')
const sourceFileName = ref('')
const rawImage = ref('')
const rawWidth = ref(0)
const rawHeight = ref(0)
const sourceImage = ref('')
const currentImage = ref('')
const sourceWidth = ref(0)
const sourceHeight = ref(0)
const prompt = ref('')
const referenceImage = ref('')
const referenceFileName = ref('')
const referenceWidth = ref(0)
const referenceHeight = ref(0)
const referenceLibraryOpen = ref(false)
const referenceLibraryItems = ref([])
const referenceLibraryLoading = ref(false)
const referenceLibraryError = ref('')
const selectingReferenceId = ref('')
const selection = ref(null)
const selectionRatioKey = ref('1:1')
const activeTool = ref('box')
const history = ref([])
const isDragOver = ref(false)
const isGenerating = ref(false)
const generateError = ref('')
const promptError = ref('')
const uploadError = ref('')
const referenceUploadError = ref('')
const cropError = ref('')
const cropBusy = ref(false)
const refineDownloadBusy = ref(false)
const cropSelection = ref(null)
const saveStatus = ref('')
const projects = ref([])
const projectsLoading = ref(false)
const projectsError = ref('')
const cropCanvas = ref(null)
const previewCanvas = ref(null)
const fileInput = ref(null)
const referenceInput = ref(null)
const promptInput = ref(null)
const componentInput = ref(null)
const editorCanvas = ref(null)
const legacyEditorFrame = ref(null)
const editorTool = ref('select')
const activeLayerId = ref('')
const layers = ref([])
const background = ref({ x: 0, y: 0, zoom: 1 })
const exportBytes = ref(0)
const exportBusy = ref(false)
const undoStack = ref([])
const redoStack = ref([])
const legacyEditorState = ref(null)
const legacyEditorPreview = ref('')
const hasUnsavedChanges = ref(false)

let workingImageElement = null
let cropImageElement = null
let cropPointerState = null
let maskCanvas = null
let maskOverlayCanvas = null
let pointerState = null
let editorPointerState = null
let editorBackgroundImage = null
let saveStatusTimer = 0
let estimateTimer = 0
let generateController = null
let referenceLibraryController = null
let propertyEditSnapshot = ''
let saveRevision = 0
let lastSavedRevision = -1
const saveInFlight = ref(false)
let isHydratingProject = false
const componentImageCache = new Map()

const hasImage = computed(() => Boolean(currentImage.value))
const hasRawImage = computed(() => Boolean(rawImage.value))
const hasSelection = computed(() => Boolean(selection.value))
const selectionAspect = computed(() => SELECTION_RATIOS.find(item => item.key === selectionRatioKey.value)?.value || 1)
const canGenerate = computed(() => hasImage.value && hasSelection.value && prompt.value.trim() && !isGenerating.value)
const activeLayer = computed(() => layers.value.find(layer => layer.id === activeLayerId.value) || null)
const cropMaxSize = computed(() => Math.max(1, Math.min(rawWidth.value, rawHeight.value)))
const cropMaxX = computed(() => Math.max(0, rawWidth.value - (cropSelection.value?.size || 0)))
const cropMaxY = computed(() => Math.max(0, rawHeight.value - (cropSelection.value?.size || 0)))
const exportSizeLabel = computed(() => exportBytes.value ? formatBytes(exportBytes.value) : '正在估算')
const legacyEditorUrl = computed(() => `/legacy/editor.html?template=custom&single=1&project=${encodeURIComponent(projectId.value || 'new')}`)
const promptFieldId = computed(() => props.embeddedRefine ? 'inspiration-refine-prompt' : 'edit-prompt')
const promptHelpId = computed(() => `${promptFieldId.value}-help`)
const promptErrorId = computed(() => `${promptFieldId.value}-error`)

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return '0 KB'
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

function formatUpdatedAt(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date)
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败，请换一张图片重试。'))
    image.src = src
  })
}

function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败。')), type, quality)
  })
}

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)),
    scale: canvas.width / rect.width
  }
}

function defaultCropSelection() {
  const size = Math.min(rawWidth.value, rawHeight.value)
  return {
    x: Math.round((rawWidth.value - size) / 2),
    y: Math.round((rawHeight.value - size) / 2),
    size
  }
}

function clampCropSelection(area) {
  const size = Math.max(1, Math.min(Number(area.size) || 1, cropMaxSize.value))
  return {
    x: Math.max(0, Math.min(Number(area.x) || 0, rawWidth.value - size)),
    y: Math.max(0, Math.min(Number(area.y) || 0, rawHeight.value - size)),
    size
  }
}

async function setCropSource(src, savedSelection = null) {
  cropImageElement = await loadImage(src)
  rawWidth.value = cropImageElement.naturalWidth
  rawHeight.value = cropImageElement.naturalHeight
  cropSelection.value = clampCropSelection(savedSelection || defaultCropSelection())
  await nextTick()
  const canvas = cropCanvas.value
  if (!canvas) return
  canvas.width = rawWidth.value
  canvas.height = rawHeight.value
  renderCropCanvas()
}

function renderCropCanvas() {
  const canvas = cropCanvas.value
  const area = cropSelection.value
  if (!canvas || !cropImageElement || !area) return
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(cropImageElement, 0, 0, canvas.width, canvas.height)

  context.save()
  context.fillStyle = 'rgba(9, 24, 29, .62)'
  context.beginPath()
  context.rect(0, 0, canvas.width, canvas.height)
  context.rect(area.x, area.y, area.size, area.size)
  context.fill('evenodd')
  const scale = Math.max(1, canvas.width / 900)
  context.strokeStyle = '#7fcfc1'
  context.lineWidth = 3 * scale
  context.setLineDash([10 * scale, 7 * scale])
  context.strokeRect(area.x, area.y, area.size, area.size)
  context.setLineDash([])
  const handleSize = 13 * scale
  context.fillStyle = '#ffffff'
  context.strokeStyle = '#176f6d'
  context.lineWidth = 2 * scale
  ;[
    [area.x, area.y],
    [area.x + area.size, area.y],
    [area.x, area.y + area.size],
    [area.x + area.size, area.y + area.size]
  ].forEach(([x, y]) => {
    context.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    context.strokeRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
  })
  context.restore()
}

function cropContains(point) {
  const area = cropSelection.value
  return area && point.x >= area.x && point.x <= area.x + area.size && point.y >= area.y && point.y <= area.y + area.size
}

function cropHandleAt(point) {
  const area = cropSelection.value
  if (!area || !cropCanvas.value) return ''
  const radius = Math.max(18, cropCanvas.value.width / cropCanvas.value.getBoundingClientRect().width * 14)
  const handles = {
    nw: [area.x, area.y],
    ne: [area.x + area.size, area.y],
    sw: [area.x, area.y + area.size],
    se: [area.x + area.size, area.y + area.size]
  }
  return Object.entries(handles).find(([, [x, y]]) => Math.hypot(point.x - x, point.y - y) <= radius)?.[0] || ''
}

function onCropPointerDown(event) {
  if (!cropImageElement) return
  const canvas = cropCanvas.value
  const point = getCanvasPoint(event, canvas)
  const handle = cropHandleAt(point)
  canvas.setPointerCapture(event.pointerId)
  if (handle) {
    cropPointerState = { type: 'resize', handle, pointerId: event.pointerId, origin: { ...cropSelection.value } }
  } else if (cropContains(point)) {
    cropPointerState = {
      type: 'move',
      pointerId: event.pointerId,
      start: point,
      origin: { ...cropSelection.value }
    }
  } else {
    cropPointerState = { type: 'create', pointerId: event.pointerId, start: point }
    cropSelection.value = { x: point.x, y: point.y, size: 1 }
  }
}

function cropFromDrag(start, point) {
  const directionX = point.x >= start.x ? 1 : -1
  const directionY = point.y >= start.y ? 1 : -1
  const maxX = directionX > 0 ? rawWidth.value - start.x : start.x
  const maxY = directionY > 0 ? rawHeight.value - start.y : start.y
  const size = Math.max(1, Math.min(Math.max(Math.abs(point.x - start.x), Math.abs(point.y - start.y)), maxX, maxY))
  return {
    x: directionX > 0 ? start.x : start.x - size,
    y: directionY > 0 ? start.y : start.y - size,
    size
  }
}

function resizeCropFromHandle(point) {
  const { handle, origin } = cropPointerState
  const anchorX = handle.includes('w') ? origin.x + origin.size : origin.x
  const anchorY = handle.includes('n') ? origin.y + origin.size : origin.y
  return cropFromDrag({ x: anchorX, y: anchorY }, point)
}

function onCropPointerMove(event) {
  if (!cropPointerState || cropPointerState.pointerId !== event.pointerId) return
  const point = getCanvasPoint(event, cropCanvas.value)
  if (cropPointerState.type === 'move') {
    const dx = point.x - cropPointerState.start.x
    const dy = point.y - cropPointerState.start.y
    cropSelection.value = clampCropSelection({
      ...cropPointerState.origin,
      x: cropPointerState.origin.x + dx,
      y: cropPointerState.origin.y + dy
    })
  } else if (cropPointerState.type === 'resize') {
    cropSelection.value = clampCropSelection(resizeCropFromHandle(point))
  } else {
    cropSelection.value = clampCropSelection(cropFromDrag(cropPointerState.start, point))
  }
  renderCropCanvas()
}

function onCropPointerUp(event) {
  if (!cropPointerState || cropPointerState.pointerId !== event.pointerId) return
  cropPointerState = null
  cropCanvas.value?.releasePointerCapture?.(event.pointerId)
  renderCropCanvas()
  scheduleSave()
}

function updateCropSize(value) {
  const previous = cropSelection.value
  if (!previous) return
  const size = Number(value)
  cropSelection.value = clampCropSelection({
    x: previous.x + (previous.size - size) / 2,
    y: previous.y + (previous.size - size) / 2,
    size
  })
  renderCropCanvas()
  scheduleSave()
}

function updateCropPosition(axis, value) {
  if (!cropSelection.value) return
  cropSelection.value = clampCropSelection({ ...cropSelection.value, [axis]: Number(value) })
  renderCropCanvas()
  scheduleSave()
}

function resetCropSelection() {
  cropSelection.value = defaultCropSelection()
  renderCropCanvas()
  scheduleSave()
}

function onCropKeydown(event) {
  if (!cropSelection.value) return
  const step = event.shiftKey ? 10 : 1
  const movement = {
    ArrowLeft: ['x', -step],
    ArrowRight: ['x', step],
    ArrowUp: ['y', -step],
    ArrowDown: ['y', step]
  }[event.key]
  if (movement) {
    event.preventDefault()
    updateCropPosition(movement[0], cropSelection.value[movement[0]] + movement[1])
    return
  }
  if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    updateCropSize(cropSelection.value.size + step)
  } else if (event.key === '-' || event.key === '_') {
    event.preventDefault()
    updateCropSize(cropSelection.value.size - step)
  }
}

async function confirmCrop() {
  if (!rawImage.value || !cropSelection.value || cropBusy.value) return
  cropBusy.value = true
  cropError.value = ''
  try {
    const image = await loadImage(rawImage.value)
    const area = cropSelection.value
    const output = createCanvas(CANVAS_SIZE, CANVAS_SIZE)
    output.getContext('2d').drawImage(
      image,
      area.x,
      area.y,
      area.size,
      area.size,
      0,
      0,
      CANVAS_SIZE,
      CANVAS_SIZE
    )
    const cropped = output.toDataURL('image/png')
    sourceImage.value = cropped
    currentImage.value = cropped
    sourceWidth.value = CANVAS_SIZE
    sourceHeight.value = CANVAS_SIZE
    selection.value = null
    activeTool.value = 'box'
    history.value = []
    prompt.value = ''
    stage.value = 'generate'
    await nextTick()
    await setWorkingImage(cropped, { resetMask: true })
    scheduleSave()
    ElMessage.success('裁图完成，已生成 1440×1440 基础图')
  } catch (error) {
    cropError.value = error?.message || '裁图失败，请重新选择裁剪区域。'
  } finally {
    cropBusy.value = false
  }
}

async function returnToCrop() {
  if (!rawImage.value || cropBusy.value || isGenerating.value) return
  cropError.value = ''
  stage.value = 'crop'
  await nextTick()
  try {
    await setCropSource(rawImage.value, cropSelection.value)
    scheduleSave()
  } catch (error) {
    stage.value = 'generate'
    cropError.value = error?.message || '无法重新打开原图，请更换图片后重试。'
    ElMessage.error(cropError.value)
  }
}

function selectionContains(point) {
  const area = ensureSelectionGeometry()
  return area && point.x >= area.x && point.x <= area.x + area.width && point.y >= area.y && point.y <= area.y + area.height
}

function normalizeSelectionArea(area) {
  if (!area) return null
  const width = Math.max(1, Number(area.width ?? area.size) || 1)
  const height = Math.max(1, Number(area.height ?? area.size) || 1)
  return { x: Number(area.x) || 0, y: Number(area.y) || 0, width, height }
}

function ensureSelectionGeometry() {
  const area = selection.value
  if (!area) return null
  if (Number.isFinite(area.width) && Number.isFinite(area.height)) return area
  const normalized = normalizeSelectionArea(area)
  selection.value = normalized
  selectionRatioKey.value = inferSelectionRatio(normalized)
  return normalized
}

function inferSelectionRatio(area) {
  const normalized = normalizeSelectionArea(area)
  if (!normalized) return '1:1'
  const ratio = normalized.width / normalized.height
  return SELECTION_RATIOS.reduce((closest, item) => (
    Math.abs(item.value - ratio) < Math.abs(closest.value - ratio) ? item : closest
  ), SELECTION_RATIOS[0]).key
}

function cloneMaskCanvas() {
  if (!maskCanvas) return null
  const snapshot = createCanvas(maskCanvas.width, maskCanvas.height)
  snapshot.getContext('2d').drawImage(maskCanvas, 0, 0)
  return snapshot
}

function clampSelection(area) {
  const width = previewCanvas.value?.width || sourceWidth.value || CANVAS_SIZE
  const height = previewCanvas.value?.height || sourceHeight.value || CANVAS_SIZE
  const normalized = normalizeSelectionArea(area)
  const minScale = Math.max(1, MIN_SELECTION_SIZE / normalized.width, MIN_SELECTION_SIZE / normalized.height)
  let areaWidth = normalized.width * minScale
  let areaHeight = normalized.height * minScale
  const fitScale = Math.min(1, width / areaWidth, height / areaHeight)
  areaWidth = Math.max(1, Math.round(areaWidth * fitScale))
  areaHeight = Math.max(1, Math.round(areaHeight * fitScale))
  return {
    x: Math.round(Math.max(0, Math.min(normalized.x, width - areaWidth))),
    y: Math.round(Math.max(0, Math.min(normalized.y, height - areaHeight))),
    width: areaWidth,
    height: areaHeight
  }
}

function transformSelectionMask(nextArea, originArea = null, maskSnapshot = cloneMaskCanvas()) {
  const origin = normalizeSelectionArea(originArea || ensureSelectionGeometry())
  if (!origin || !maskCanvas || !maskSnapshot) return
  const next = clampSelection(nextArea)
  const context = maskCanvas.getContext('2d')
  context.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    maskSnapshot,
    origin.x,
    origin.y,
    origin.width,
    origin.height,
    next.x,
    next.y,
    next.width,
    next.height
  )
  selection.value = next
  renderGenerateCanvas()
}

function selectionHandleAt(point) {
  const area = ensureSelectionGeometry()
  if (!area) return ''
  const canvasScale = Math.max(1, (previewCanvas.value?.width || CANVAS_SIZE) / 900)
  const threshold = Math.max(8 * canvasScale, SELECTION_HANDLE_HIT_RADIUS_CSS * point.scale)
  const corners = {
    nw: { x: area.x, y: area.y },
    ne: { x: area.x + area.width, y: area.y },
    sw: { x: area.x, y: area.y + area.height },
    se: { x: area.x + area.width, y: area.y + area.height }
  }
  return Object.entries(corners).find(([, corner]) => Math.hypot(point.x - corner.x, point.y - corner.y) <= threshold)?.[0] || ''
}

function resizeSelectionFromHandle(handle, point, origin) {
  const width = previewCanvas.value.width
  const height = previewCanvas.value.height
  const ratio = selectionAspect.value
  const anchors = {
    nw: { x: origin.x + origin.width, y: origin.y + origin.height },
    ne: { x: origin.x, y: origin.y + origin.height },
    sw: { x: origin.x + origin.width, y: origin.y },
    se: { x: origin.x, y: origin.y }
  }
  const anchor = anchors[handle]
  const direction = {
    nw: { x: -1, y: -1 },
    ne: { x: 1, y: -1 },
    sw: { x: -1, y: 1 },
    se: { x: 1, y: 1 }
  }[handle]
  const maxHorizontal = direction.x > 0 ? width - anchor.x : anchor.x
  const maxVertical = direction.y > 0 ? height - anchor.y : anchor.y
  const maxWidth = Math.max(1, Math.min(maxHorizontal, maxVertical * ratio))
  const requestedWidth = Math.max(Math.abs(point.x - anchor.x), Math.abs(point.y - anchor.y) * ratio)
  const minWidth = Math.min(maxWidth, ratio >= 1 ? MIN_SELECTION_SIZE * ratio : MIN_SELECTION_SIZE)
  const areaWidth = Math.max(minWidth, Math.min(requestedWidth, maxWidth))
  const areaHeight = areaWidth / ratio
  return {
    x: handle.includes('w') ? anchor.x - areaWidth : anchor.x,
    y: handle.includes('n') ? anchor.y - areaHeight : anchor.y,
    width: areaWidth,
    height: areaHeight
  }
}

function onPreviewKeydown(event) {
  const area = ensureSelectionGeometry()
  if (!area) return
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    event.stopPropagation()
    clearSelection()
    return
  }
  if (activeTool.value !== 'transform') return
  const step = event.shiftKey ? 10 : 1
  const movement = {
    ArrowLeft: ['x', -step],
    ArrowRight: ['x', step],
    ArrowUp: ['y', -step],
    ArrowDown: ['y', step]
  }[event.key]
  if (movement) {
    event.preventDefault()
    transformSelectionMask({ ...area, [movement[0]]: area[movement[0]] + movement[1] })
    scheduleSave()
    return
  }
  if (event.key !== '+' && event.key !== '=' && event.key !== '-' && event.key !== '_') return
  event.preventDefault()
  const delta = event.key === '+' || event.key === '=' ? step : -step
  const ratio = selectionAspect.value
  const centerX = area.x + area.width / 2
  const centerY = area.y + area.height / 2
  const widthDelta = delta * (ratio >= 1 ? ratio : 1)
  const areaWidth = area.width + widthDelta
  const areaHeight = areaWidth / ratio
  transformSelectionMask({ x: centerX - areaWidth / 2, y: centerY - areaHeight / 2, width: areaWidth, height: areaHeight })
  scheduleSave()
}

function setSelectionRatio(key) {
  const nextRatio = SELECTION_RATIOS.find(item => item.key === key)
  if (!nextRatio || selectionRatioKey.value === key) return
  selectionRatioKey.value = key
  const area = ensureSelectionGeometry()
  if (area) {
    const centerX = area.x + area.width / 2
    const centerY = area.y + area.height / 2
    const areaPixels = area.width * area.height
    let width = Math.sqrt(areaPixels * nextRatio.value)
    let height = width / nextRatio.value
    const maxWidth = Math.max(1, 2 * Math.min(centerX, (previewCanvas.value?.width || CANVAS_SIZE) - centerX))
    const maxHeight = Math.max(1, 2 * Math.min(centerY, (previewCanvas.value?.height || CANVAS_SIZE) - centerY))
    const scale = Math.min(1, maxWidth / width, maxHeight / height)
    width *= scale
    height *= scale
    transformSelectionMask({ x: centerX - width / 2, y: centerY - height / 2, width, height })
    activeTool.value = 'transform'
  } else {
    activeTool.value = 'box'
  }
  scheduleSave()
}

async function setWorkingImage(src, { resetMask = false, maskData = '' } = {}) {
  workingImageElement = await loadImage(src)
  currentImage.value = src
  await nextTick()
  const canvas = previewCanvas.value
  if (!canvas) return
  canvas.width = workingImageElement.naturalWidth
  canvas.height = workingImageElement.naturalHeight

  if (!maskCanvas || resetMask || maskCanvas.width !== canvas.width || maskCanvas.height !== canvas.height) {
    maskCanvas = createCanvas(canvas.width, canvas.height)
    maskOverlayCanvas = createCanvas(canvas.width, canvas.height)
  }
  if (maskData) {
    const maskImage = await loadImage(maskData)
    const context = maskCanvas.getContext('2d')
    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    context.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height)
  }
  renderGenerateCanvas()
}

async function hydrateEmbeddedRefine(src = props.refineImage) {
  if (!props.embeddedRefine || !src) return
  isHydratingProject = true
  try {
    const image = await loadImage(src)
    const targetWidth = props.refineWidth || image.naturalWidth
    const targetHeight = props.refineHeight || image.naturalHeight
    let canonicalSrc = src
    if (image.naturalWidth !== targetWidth || image.naturalHeight !== targetHeight) {
      const canvas = createCanvas(targetWidth, targetHeight)
      canvas.getContext('2d').drawImage(image, 0, 0, targetWidth, targetHeight)
      canonicalSrc = canvas.toDataURL('image/png')
    }
    projectId.value = ''
    projectName.value = props.refineFileName || '灵感成图'
    sourceFileName.value = props.refineFileName || '灵感成图'
    rawImage.value = ''
    rawWidth.value = 0
    rawHeight.value = 0
    cropSelection.value = null
    sourceImage.value = canonicalSrc
    currentImage.value = canonicalSrc
    sourceWidth.value = targetWidth
    sourceHeight.value = targetHeight
    prompt.value = ''
    promptError.value = ''
    referenceImage.value = ''
    referenceFileName.value = ''
    referenceWidth.value = 0
    referenceHeight.value = 0
    referenceUploadError.value = ''
    selection.value = null
    selectionRatioKey.value = '1:1'
    activeTool.value = 'box'
    history.value = []
    generateError.value = ''
    stage.value = 'generate'
    view.value = 'workspace'
    saveStatus.value = ''
    saveRevision = 0
    lastSavedRevision = 0
    hasUnsavedChanges.value = false
    await nextTick()
    await setWorkingImage(canonicalSrc, { resetMask: true })
  } catch (error) {
    ElMessage.error(error?.message || '无法打开这张灵感图。')
    emit('exit-refine')
  } finally {
    isHydratingProject = false
  }
}

function leaveGenerateStage() {
  if (props.embeddedRefine) {
    emit('exit-refine')
    return
  }
  returnToCrop()
}

async function downloadEmbeddedRefine() {
  if (!props.embeddedRefine || !currentImage.value || isGenerating.value || refineDownloadBusy.value) return
  refineDownloadBusy.value = true
  try {
    const image = await loadImage(currentImage.value)
    const canvas = createCanvas(image.naturalWidth, image.naturalHeight)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await canvasToBlob(canvas, 'image/png')
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const baseName = (props.refineFileName || '灵感成图').replace(/\.[^.]+$/, '')
    anchor.href = url
    anchor.download = `${baseName}-局部编辑-${props.refineRatio.replace(':', 'x')}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    ElMessage.success('图片已下载')
  } catch (error) {
    ElMessage.error(error?.message || '图片下载失败，请重试。')
  } finally {
    refineDownloadBusy.value = false
  }
}

function renderGenerateCanvas() {
  const canvas = previewCanvas.value
  if (!canvas || !workingImageElement) return
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(workingImageElement, 0, 0, canvas.width, canvas.height)

  const area = ensureSelectionGeometry()
  if (maskCanvas && area) {
    const overlayContext = maskOverlayCanvas.getContext('2d')
    overlayContext.clearRect(0, 0, canvas.width, canvas.height)
    overlayContext.fillStyle = 'rgba(255, 98, 78, .42)'
    overlayContext.fillRect(0, 0, canvas.width, canvas.height)
    overlayContext.globalCompositeOperation = 'destination-in'
    overlayContext.drawImage(maskCanvas, 0, 0)
    overlayContext.globalCompositeOperation = 'source-over'
    context.drawImage(maskOverlayCanvas, 0, 0)

    const scale = Math.max(1, canvas.width / 900)
    context.save()
    context.strokeStyle = '#ff624e'
    context.lineWidth = 3 * scale
    context.setLineDash([10 * scale, 7 * scale])
    context.strokeRect(area.x, area.y, area.width, area.height)
    context.setLineDash([])
    if (activeTool.value === 'transform') {
      const handleSize = 16 * scale
      const half = handleSize / 2
      const corners = [
        [area.x, area.y],
        [area.x + area.width, area.y],
        [area.x, area.y + area.height],
        [area.x + area.width, area.y + area.height]
      ]
      context.fillStyle = '#fff'
      context.lineWidth = 2 * scale
      corners.forEach(([x, y]) => {
        context.fillRect(x - half, y - half, handleSize, handleSize)
        context.strokeRect(x - half, y - half, handleSize, handleSize)
      })
    }
    context.restore()
  }
}

function makeAspectSelection(start, point) {
  const width = previewCanvas.value.width
  const height = previewCanvas.value.height
  const ratio = selectionAspect.value
  const directionX = point.x >= start.x ? 1 : -1
  const directionY = point.y >= start.y ? 1 : -1
  const maxHorizontal = directionX > 0 ? width - start.x : start.x
  const maxVertical = directionY > 0 ? height - start.y : start.y
  const maxWidth = Math.max(1, Math.min(maxHorizontal, maxVertical * ratio))
  const requestedWidth = Math.max(Math.abs(point.x - start.x), Math.abs(point.y - start.y) * ratio)
  const areaWidth = Math.max(2, Math.min(requestedWidth, maxWidth))
  const areaHeight = areaWidth / ratio
  return {
    x: directionX > 0 ? start.x : start.x - areaWidth,
    y: directionY > 0 ? start.y : start.y - areaHeight,
    width: areaWidth,
    height: areaHeight
  }
}

function initializeSelectionMask() {
  const area = ensureSelectionGeometry()
  if (!area || !maskCanvas) return
  const context = maskCanvas.getContext('2d')
  context.clearRect(0, 0, maskCanvas.width, maskCanvas.height)
  context.fillStyle = '#fff'
  const { x, y, width, height } = area
  context.fillRect(x, y, width, height)
}

function onPreviewPointerDown(event) {
  if (!workingImageElement) return
  const canvas = previewCanvas.value
  canvas.focus({ preventScroll: true })
  const point = getCanvasPoint(event, canvas)
  if (activeTool.value === 'box') {
    canvas.setPointerCapture(event.pointerId)
    pointerState = { type: 'box', pointerId: event.pointerId, start: point }
    selection.value = makeAspectSelection(point, { x: point.x + 2, y: point.y + 2 })
    maskCanvas?.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height)
    renderGenerateCanvas()
    return
  }
  if (activeTool.value === 'transform') {
    const area = ensureSelectionGeometry()
    if (!area) return
    const handle = selectionHandleAt(point)
    if (!handle && !selectionContains(point)) return
    canvas.setPointerCapture(event.pointerId)
    pointerState = {
      type: handle ? 'resize-selection' : 'move-selection',
      pointerId: event.pointerId,
      start: point,
      handle,
      origin: { ...area },
      maskSnapshot: cloneMaskCanvas()
    }
    return
  }
}

function onPreviewPointerMove(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) return
  const point = getCanvasPoint(event, previewCanvas.value)
  if (pointerState.type === 'box') {
    selection.value = makeAspectSelection(pointerState.start, point)
    renderGenerateCanvas()
  } else if (pointerState.type === 'move-selection') {
    transformSelectionMask({
      ...pointerState.origin,
      x: pointerState.origin.x + point.x - pointerState.start.x,
      y: pointerState.origin.y + point.y - pointerState.start.y
    }, pointerState.origin, pointerState.maskSnapshot)
  } else if (pointerState.type === 'resize-selection') {
    transformSelectionMask(
      resizeSelectionFromHandle(pointerState.handle, point, pointerState.origin),
      pointerState.origin,
      pointerState.maskSnapshot
    )
  }
}

function onPreviewPointerUp(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) return
  if (pointerState.type === 'box') {
    initializeSelectionMask()
    activeTool.value = 'transform'
  }
  pointerState = null
  previewCanvas.value?.releasePointerCapture?.(event.pointerId)
  renderGenerateCanvas()
  scheduleSave()
}

function clearSelection() {
  selection.value = null
  maskCanvas?.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height)
  activeTool.value = 'box'
  renderGenerateCanvas()
  scheduleSave()
}

async function imageFileToPng(file) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const objectUrl = URL.createObjectURL(file)
    try {
      bitmap = await loadImage(objectUrl)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }
  const width = bitmap.width || bitmap.naturalWidth
  const height = bitmap.height || bitmap.naturalHeight
  if (!width || !height) throw new Error('无法读取图片尺寸。')
  const canvas = createCanvas(width, height)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}

async function acceptFile(file) {
  uploadError.value = ''
  if (!file) return
  if (!ACCEPTED_TYPES.has(file.type)) {
    uploadError.value = '仅支持 JPG、PNG 或 WebP 图片。'
    return
  }
  if (file.size === 0) {
    uploadError.value = '图片文件为空。'
    return
  }
  try {
    const decoded = await imageFileToPng(file)
    projectId.value = createProjectId()
    projectName.value = file.name.replace(/\.[^.]+$/, '').slice(0, 80) || '未命名单图'
    sourceFileName.value = file.name
    rawImage.value = decoded.dataUrl
    rawWidth.value = decoded.width
    rawHeight.value = decoded.height
    sourceImage.value = ''
    currentImage.value = ''
    sourceWidth.value = decoded.width
    sourceHeight.value = decoded.height
    cropSelection.value = null
  selection.value = null
  selectionRatioKey.value = '1:1'
    history.value = []
    prompt.value = ''
    stage.value = 'crop'
    layers.value = []
    background.value = { x: 0, y: 0, zoom: 1 }
    await setCropSource(decoded.dataUrl)
    scheduleSave()
    ElMessage.success('图片已载入，请先完成 1:1 裁图')
  } catch (error) {
    uploadError.value = error?.message || '图片读取失败。'
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onFileChange(event) {
  acceptFile(event.target.files?.[0])
}

function onDrop(event) {
  event.preventDefault()
  isDragOver.value = false
  acceptFile(event.dataTransfer.files?.[0])
}

async function acceptReferenceFile(file) {
  referenceUploadError.value = ''
  if (!file) return false
  if (!ACCEPTED_TYPES.has(file.type)) {
    referenceUploadError.value = '参考图仅支持 JPG、PNG 或 WebP。'
    return false
  }
  if (file.size === 0) {
    referenceUploadError.value = '参考图片文件为空。'
    return false
  }
  try {
    const decoded = await imageFileToPng(file)
    referenceImage.value = decoded.dataUrl
    referenceFileName.value = file.name
    referenceWidth.value = decoded.width
    referenceHeight.value = decoded.height
    scheduleSave()
    return true
  } catch (error) {
    referenceUploadError.value = error?.message || '参考图片读取失败。'
    return false
  } finally {
    if (referenceInput.value) referenceInput.value.value = ''
  }
}

async function loadReferenceLibrary() {
  referenceLibraryController?.abort()
  referenceLibraryController = new AbortController()
  referenceLibraryLoading.value = true
  referenceLibraryError.value = ''
  try {
    referenceLibraryItems.value = await listReferenceLibrary(referenceLibraryController.signal)
  } catch (error) {
    if (error?.name !== 'AbortError') referenceLibraryError.value = error?.message || '无法读取本地参考图。'
  } finally {
    referenceLibraryLoading.value = false
  }
}

function openReferenceLibrary() {
  referenceLibraryOpen.value = true
  if (!referenceLibraryItems.value.length && !referenceLibraryLoading.value) loadReferenceLibrary()
}

async function chooseReferenceLibraryItem(item) {
  if (!item?.url || selectingReferenceId.value) return
  selectingReferenceId.value = item.id
  referenceLibraryError.value = ''
  try {
    const file = await referenceLibraryItemToFile(item)
    const accepted = await acceptReferenceFile(file)
    if (accepted) {
      referenceLibraryOpen.value = false
      ElMessage.success(`已选择参考图：${item.name}`)
    }
  } catch (error) {
    referenceLibraryError.value = error?.message || '参考图读取失败。'
  } finally {
    selectingReferenceId.value = ''
  }
}

function chooseReferenceFromComputer() {
  referenceLibraryOpen.value = false
  nextTick(() => referenceInput.value?.click())
}

function onReferenceFileChange(event) {
  acceptReferenceFile(event.target.files?.[0])
}

function removeReferenceImage() {
  referenceImage.value = ''
  referenceFileName.value = ''
  referenceWidth.value = 0
  referenceHeight.value = 0
  referenceUploadError.value = ''
  if (referenceInput.value) referenceInput.value.value = ''
  scheduleSave()
}

function validateGenerate() {
  generateError.value = ''
  promptError.value = ''
  if (!currentImage.value) {
    generateError.value = '请先上传一张图片。'
    return false
  }
  if (!selection.value) {
    generateError.value = `请先在图片上拖动创建 ${selectionRatioKey.value} 选区。`
    return false
  }
  if (!prompt.value.trim()) {
    promptError.value = '请输入想要修改的内容。'
    promptInput.value?.focus()
    return false
  }
  return true
}

function createFeatheredMask(sourceMask = maskCanvas) {
  const feathered = createCanvas(sourceMask.width, sourceMask.height)
  const context = feathered.getContext('2d')
  const feather = Math.max(3, Math.round(Math.min(sourceMask.width, sourceMask.height) / 800 * 4))
  context.filter = `blur(${feather}px)`
  context.drawImage(sourceMask, 0, 0)
  context.filter = 'none'
  context.globalCompositeOperation = 'destination-in'
  context.drawImage(sourceMask, 0, 0)
  context.globalCompositeOperation = 'source-over'
  return feathered
}

async function createSelectionPayload({
  preserveCanvasGeometry = false,
  baseImageDataUrl = currentImage.value,
  area = { ...ensureSelectionGeometry() },
  maskSnapshot = cloneMaskCanvas()
} = {}) {
  const base = await loadImage(baseImageDataUrl)

  if (preserveCanvasGeometry) {
    const placement = createReferenceCanvasPlacement(base.naturalWidth, base.naturalHeight)
    const requestImage = createCanvas(placement.requestWidth, placement.requestHeight)
    requestImage.getContext('2d').drawImage(base, placement.contentX, placement.contentY)

    const requestMask = createCanvas(placement.requestWidth, placement.requestHeight)
    const requestMaskContext = requestMask.getContext('2d')
    requestMaskContext.fillStyle = '#fff'
    requestMaskContext.fillRect(0, 0, requestMask.width, requestMask.height)
    requestMaskContext.globalCompositeOperation = 'destination-out'
    requestMaskContext.drawImage(maskSnapshot, placement.contentX, placement.contentY)
    requestMaskContext.globalCompositeOperation = 'source-over'

    const [imageBlob, maskBlob] = await Promise.all([
      canvasToBlob(requestImage),
      canvasToBlob(requestMask)
    ])
    return {
      imageBlob,
      maskBlob,
      composition: { mode: 'canvas', area, maskSnapshot, placement, baseImageDataUrl }
    }
  }

  const width = Math.max(2, Math.round(area.width))
  const height = Math.max(2, Math.round(area.height))
  const selectionImage = createCanvas(width, height)
  selectionImage.getContext('2d').drawImage(
    base,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    width,
    height
  )

  const apiMask = createCanvas(width, height)
  const maskContext = apiMask.getContext('2d')
  maskContext.fillStyle = '#fff'
  maskContext.fillRect(0, 0, width, height)
  maskContext.globalCompositeOperation = 'destination-out'
  maskContext.drawImage(
    maskSnapshot,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    width,
    height
  )
  maskContext.globalCompositeOperation = 'source-over'

  const [imageBlob, maskBlob] = await Promise.all([
    canvasToBlob(selectionImage),
    canvasToBlob(apiMask)
  ])
  return {
    imageBlob,
    maskBlob,
    composition: { mode: 'selection', area, maskSnapshot, baseImageDataUrl }
  }
}

async function composeGeneratedResult(generatedImage, composition) {
  const [base, generated] = await Promise.all([
    loadImage(composition.baseImageDataUrl),
    loadImage(generatedImage)
  ])
  const result = createCanvas(base.naturalWidth, base.naturalHeight)
  const resultContext = result.getContext('2d')
  resultContext.drawImage(base, 0, 0)

  const edit = createCanvas(result.width, result.height)
  const editContext = edit.getContext('2d')
  const area = composition.area
  if (composition.mode === 'canvas') {
    const source = mapReferencePlacementToGenerated(
      composition.placement,
      generated.naturalWidth,
      generated.naturalHeight
    )
    editContext.drawImage(
      generated,
      source.x,
      source.y,
      source.width,
      source.height,
      0,
      0,
      result.width,
      result.height
    )
  } else {
    editContext.drawImage(generated, area.x, area.y, area.width, area.height)
  }
  editContext.globalCompositeOperation = 'destination-in'
  editContext.drawImage(createFeatheredMask(composition.maskSnapshot), 0, 0)
  editContext.globalCompositeOperation = 'source-over'
  resultContext.drawImage(edit, 0, 0)
  return result.toDataURL('image/png')
}

async function generateImage() {
  if (!validateGenerate()) return
  const generationSnapshot = {
    baseImageDataUrl: currentImage.value,
    referenceImageDataUrl: referenceImage.value,
    prompt: prompt.value.trim(),
    area: { ...ensureSelectionGeometry() },
    maskSnapshot: cloneMaskCanvas()
  }
  isGenerating.value = true
  generateError.value = ''
  generateController = new AbortController()
  try {
    await requestImageEditStatus(generateController.signal)
    const referenceImageBlob = generationSnapshot.referenceImageDataUrl
      ? await fetch(generationSnapshot.referenceImageDataUrl).then(response => response.blob())
      : undefined
    const { imageBlob, maskBlob, composition } = await createSelectionPayload({
      preserveCanvasGeometry: Boolean(referenceImageBlob),
      baseImageDataUrl: generationSnapshot.baseImageDataUrl,
      area: generationSnapshot.area,
      maskSnapshot: generationSnapshot.maskSnapshot
    })
    const response = await requestImageEdit({
      imageBlob,
      maskBlob,
      referenceImageBlob,
      prompt: generationSnapshot.prompt,
      signal: generateController.signal
    })
    if (!response.imageDataUrl) throw new Error('图片服务没有返回生成结果。')
    const resultData = await composeGeneratedResult(response.imageDataUrl, composition)
    const version = {
      id: window.crypto?.randomUUID?.() || `version-${Date.now()}`,
      dataUrl: resultData,
      prompt: generationSnapshot.prompt,
      createdAt: new Date().toISOString()
    }
    history.value = [...history.value, version].slice(-MAX_HISTORY)
    await setWorkingImage(resultData)
    scheduleSave()
    ElMessage.success('生成结果已完成，选区外像素保持不变')
  } catch (error) {
    if (error?.name !== 'AbortError') generateError.value = error?.message || '生成失败，请重试。'
  } finally {
    isGenerating.value = false
    generateController = null
  }
}

function cancelGenerate() {
  generateController?.abort()
}

async function restoreVersion(version) {
  await setWorkingImage(version?.dataUrl || sourceImage.value)
  scheduleSave()
}

async function removeVersion(version) {
  history.value = history.value.filter(item => item.id !== version.id)
  if (currentImage.value === version.dataUrl) {
    const fallback = history.value.at(-1)?.dataUrl || sourceImage.value
    await setWorkingImage(fallback)
  }
  scheduleSave()
}

function serializeMask() {
  if (!maskCanvas || !selection.value) return ''
  return maskCanvas.toDataURL('image/png')
}

function projectSnapshot() {
  return {
    projectId: projectId.value,
    name: projectName.value,
    sourceFileName: sourceFileName.value,
    rawImage: rawImage.value,
    rawWidth: rawWidth.value,
    rawHeight: rawHeight.value,
    cropSelection: cropSelection.value,
    sourceImage: sourceImage.value,
    currentImage: currentImage.value,
    sourceWidth: sourceWidth.value,
    sourceHeight: sourceHeight.value,
    prompt: prompt.value,
    referenceImage: referenceImage.value,
    referenceFileName: referenceFileName.value,
    referenceWidth: referenceWidth.value,
    referenceHeight: referenceHeight.value,
    selection: selection.value,
    selectionRatio: selectionRatioKey.value,
    maskImage: serializeMask(),
    history: history.value.slice(-MAX_HISTORY),
    stage: stage.value,
    editState: {
      background: background.value,
      layers: layers.value,
      legacyState: legacyEditorState.value,
      previewImage: legacyEditorPreview.value
    }
  }
}

function setSaveStatus(message, clearAfter = 0) {
  window.clearTimeout(saveStatusTimer)
  saveStatus.value = message
  if (clearAfter) {
    saveStatusTimer = window.setTimeout(() => {
      if (saveStatus.value === message) saveStatus.value = ''
    }, clearAfter)
  }
}

async function saveProjectNow({ force = true } = {}) {
  if (!projectId.value || (!rawImage.value && !sourceImage.value)) return
  if (!force && saveRevision === lastSavedRevision) return
  if (saveInFlight.value) return
  const revision = saveRevision
  saveInFlight.value = true
  setSaveStatus('正在保存到单图项目…')
  try {
    const saved = await saveSingleProject(projectSnapshot())
    projectId.value = saved.projectId
    lastSavedRevision = Math.max(lastSavedRevision, revision)
    hasUnsavedChanges.value = saveRevision !== revision
    if (saveRevision === revision) setSaveStatus('已保存到单图项目', SAVE_SUCCESS_VISIBLE_MS)
    else setSaveStatus('有未保存的更改')
    await refreshProjects()
    return saved
  } catch (error) {
    setSaveStatus(error?.message || '保存到单图项目失败')
    throw error
  } finally {
    saveInFlight.value = false
  }
}

async function saveWorkspaceProject() {
  if (saveInFlight.value) return
  try {
    const saved = await saveProjectNow({ force: true })
    if (saved) ElMessage.success('已保存到单图项目')
  } catch (error) {
    ElMessage.error(error?.message || '保存到单图项目失败，请重试。')
  }
}

function scheduleSave() {
  saveRevision += 1
  hasUnsavedChanges.value = true
  setSaveStatus('有未保存的更改')
}

function resetWorkspace() {
  projectId.value = ''
  projectName.value = ''
  sourceFileName.value = ''
  rawImage.value = ''
  rawWidth.value = 0
  rawHeight.value = 0
  cropSelection.value = null
  sourceImage.value = ''
  currentImage.value = ''
  sourceWidth.value = 0
  sourceHeight.value = 0
  referenceImage.value = ''
  referenceFileName.value = ''
  referenceWidth.value = 0
  referenceHeight.value = 0
  referenceUploadError.value = ''
  selection.value = null
  selectionRatioKey.value = '1:1'
  activeTool.value = 'box'
  history.value = []
  prompt.value = ''
  stage.value = 'generate'
  layers.value = []
  background.value = { x: 0, y: 0, zoom: 1 }
  saveStatus.value = ''
  window.clearTimeout(saveStatusTimer)
  saveRevision = 0
  lastSavedRevision = -1
  saveInFlight.value = false
  hasUnsavedChanges.value = false
  legacyEditorState.value = null
  legacyEditorPreview.value = ''
  workingImageElement = null
  cropImageElement = null
  maskCanvas = null
  cropCanvas.value?.getContext('2d').clearRect(0, 0, cropCanvas.value.width, cropCanvas.value.height)
  const canvas = previewCanvas.value
  canvas?.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  view.value = 'workspace'
}

async function showProjects() {
  if (!await confirmDiscardUnsaved()) return
  view.value = 'projects'
  await refreshProjects()
}

async function refreshProjects() {
  projectsLoading.value = true
  projectsError.value = ''
  try {
    projects.value = await listSingleProjects()
  } catch (error) {
    projectsError.value = error?.message || '无法读取单图项目。'
  } finally {
    projectsLoading.value = false
  }
}

async function openProject(item) {
  isHydratingProject = true
  try {
    const project = await loadSingleProject(item.projectId)
    if (!project) throw new Error('项目不存在或已被删除。')
    projectId.value = project.projectId
    projectName.value = project.name
    sourceFileName.value = project.sourceFileName || project.name
    rawImage.value = project.rawImage || project.sourceImage
    rawWidth.value = project.rawWidth || project.sourceWidth || 0
    rawHeight.value = project.rawHeight || project.sourceHeight || 0
    cropSelection.value = project.cropSelection || null
    sourceImage.value = project.sourceImage
    currentImage.value = project.currentImage || project.sourceImage
    sourceWidth.value = project.sourceWidth || 0
    sourceHeight.value = project.sourceHeight || 0
    prompt.value = project.prompt || ''
    referenceImage.value = project.referenceImage || ''
    referenceFileName.value = project.referenceFileName || ''
    referenceWidth.value = project.referenceWidth || 0
    referenceHeight.value = project.referenceHeight || 0
    referenceUploadError.value = ''
    selectionRatioKey.value = SELECTION_RATIOS.some(item => item.key === project.selectionRatio)
      ? project.selectionRatio
      : inferSelectionRatio(project.selection)
    selection.value = normalizeSelectionArea(project.selection)
    activeTool.value = project.selection ? 'transform' : 'box'
    history.value = project.history || []
    stage.value = project.stage || 'generate'
    background.value = project.editState?.background || { x: 0, y: 0, zoom: 1 }
    layers.value = project.editState?.layers || []
    legacyEditorState.value = project.editState?.legacyState || null
    legacyEditorPreview.value = project.editState?.previewImage || ''
    view.value = 'workspace'
    if (stage.value === 'edit') await initializeEditor(false)
    else if (stage.value === 'crop') await setCropSource(rawImage.value, cropSelection.value)
    else await setWorkingImage(currentImage.value, { resetMask: true, maskData: project.maskImage || '' })
    saveRevision = 0
    lastSavedRevision = 0
    hasUnsavedChanges.value = false
    setSaveStatus('')
  } catch (error) {
    ElMessage.error(error?.message || '项目打开失败。')
  } finally {
    isHydratingProject = false
  }
}

async function confirmDeleteProject(item) {
  try {
    await ElMessageBox.confirm(`删除后无法恢复，确定删除“${item.name}”吗？`, '删除单图项目', {
      type: 'warning',
      confirmButtonText: '删除项目',
      cancelButtonText: '保留项目',
      confirmButtonClass: 'danger-confirm'
    })
    await deleteSingleProject(item.projectId)
    if (projectId.value === item.projectId) resetWorkspace()
    await refreshProjects()
    ElMessage.success('单图项目已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除失败。')
  }
}

function legacyStateForInit() {
  if (legacyEditorState.value) return legacyEditorState.value
  const extras = layers.value.map(layer => {
    const common = {
      id: layer.id,
      x: layer.x,
      y: layer.y,
      w: layer.width || Math.max(120, (layer.text?.length || 2) * (layer.fontSize || 72)),
      h: layer.height || Math.round((layer.fontSize || 72) * 1.35),
      rotation: 0,
      locked: false,
      style: {
        color: layer.color || '#1c2d33',
        opacity: layer.opacity ?? 1,
        stroke: 0,
        font: 'default',
        size: layer.fontSize || 72,
        weight: String(layer.weight || 600),
        align: 'left',
        lineHeight: Math.round((layer.fontSize || 72) * 1.28),
        letterSpacing: 0
      }
    }
    if (layer.type === 'text') return { ...common, kind: 'text', text: layer.text || '文字', autoTextBounds: true }
    if (layer.type === 'image') return { ...common, kind: 'image', image: { __imageSrc: layer.dataUrl } }
    const circleNodes = [
      { a: [.5, 0], in: [.224, 0], out: [.776, 0] },
      { a: [1, .5], in: [1, .224], out: [1, .776] },
      { a: [.5, 1], in: [.776, 1], out: [.224, 1] },
      { a: [0, .5], in: [0, .776], out: [0, .224] }
    ]
    const rectNodes = [
      { a: [0, 0], in: [0, 0], out: [0, 0] },
      { a: [1, 0], in: [1, 0], out: [1, 0] },
      { a: [1, 1], in: [1, 1], out: [1, 1] },
      { a: [0, 1], in: [0, 1], out: [0, 1] }
    ]
    return { ...common, kind: 'path', closed: true, nodes: layer.type === 'circle' ? circleNodes : rectNodes, sourceNodes: layer.type === 'circle' ? circleNodes : rectNodes, pathEdited: true }
  })
  return {
    sourceKey: 'square',
    name: '单图方图',
    w: CANVAS_SIZE,
    h: CANVAS_SIZE,
    kind: 'square',
    fit: 'cover',
    image: { __imageSrc: currentImage.value },
    x: background.value.x || 0,
    y: background.value.y || 0,
    zoom: background.value.zoom || 1,
    maxZoom: 3,
    text1: '',
    text2: '',
    textStyles: { title: {}, sub: {} },
    textOffsets: { title: { x: 0, y: 0 }, sub: { x: 0, y: 0 } },
    extra: extras,
    photoPanels: null,
    activePanel: 'top',
    collage: null
  }
}

function postLegacyEditorInit() {
  const target = legacyEditorFrame.value?.contentWindow
  if (!target || stage.value !== 'edit') return
  const editorState = JSON.parse(JSON.stringify(legacyStateForInit()))
  target.postMessage({
    type: 'single-editor-init',
    projectId: projectId.value,
    projectName: projectName.value,
    image: currentImage.value,
    state: editorState,
    saved: !hasUnsavedChanges.value && lastSavedRevision >= 0,
    projectCount: projects.value.length
  }, window.location.origin)
}

async function confirmDiscardUnsaved(message = '当前修改尚未保存到单图项目，离开后会丢失。') {
  if (!hasUnsavedChanges.value) return true
  try {
    await ElMessageBox.confirm(message, '尚未保存', {
      type: 'warning',
      confirmButtonText: '放弃修改',
      cancelButtonText: '继续编辑',
      confirmButtonClass: 'danger-confirm'
    })
    hasUnsavedChanges.value = false
    return true
  } catch (error) {
    if (error === 'cancel' || error === 'close') return false
    throw error
  }
}

async function handleLegacyEditorMessage(event) {
  if (event.origin !== window.location.origin || event.source !== legacyEditorFrame.value?.contentWindow) return
  const message = event.data || {}
  if (message.type === 'single-editor-ready') {
    postLegacyEditorInit()
    return
  }
  if (message.type === 'single-editor-dirty') {
    scheduleSave()
    return
  }
  if (message.type === 'single-editor-back') {
    if (await confirmDiscardUnsaved()) await returnToGenerate()
    return
  }
  if (message.type === 'single-editor-show-workspace') {
    view.value = 'workspace'
    return
  }
  if (message.type === 'single-editor-show-projects') {
    await showProjects()
    return
  }
  if (message.type !== 'single-project-save-request') return

  try {
    legacyEditorState.value = message.state || null
    legacyEditorPreview.value = message.previewImage || ''
    scheduleSave()
    await saveProjectNow({ force: true })
    event.source?.postMessage({ type: 'single-project-save-result', requestId: message.requestId, ok: true, projectCount: projects.value.length }, event.origin)
    ElMessage.success('已保存到单图项目')
  } catch (error) {
    event.source?.postMessage({
      type: 'single-project-save-result',
      requestId: message.requestId,
      ok: false,
      error: error?.message || '保存到单图项目失败，请重试。'
    }, event.origin)
  }
}

function onBeforeUnload(event) {
  if (props.embeddedRefine || !hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

function snapshotEditor() {
  return JSON.stringify({ background: background.value, layers: layers.value })
}

function pushUndo() {
  undoStack.value = [...undoStack.value, snapshotEditor()].slice(-30)
  redoStack.value = []
}

function applyEditorSnapshot(snapshot) {
  const state = JSON.parse(snapshot)
  background.value = state.background
  layers.value = state.layers
  activeLayerId.value = ''
  renderEditorCanvas()
  scheduleSave()
}

function undoEditor() {
  const snapshot = undoStack.value.at(-1)
  if (!snapshot) return
  redoStack.value = [...redoStack.value, snapshotEditor()].slice(-30)
  undoStack.value = undoStack.value.slice(0, -1)
  applyEditorSnapshot(snapshot)
}

function redoEditor() {
  const snapshot = redoStack.value.at(-1)
  if (!snapshot) return
  undoStack.value = [...undoStack.value, snapshotEditor()].slice(-30)
  redoStack.value = redoStack.value.slice(0, -1)
  applyEditorSnapshot(snapshot)
}

async function initializeEditor(resetState = true) {
  if (props.embeddedRefine || !currentImage.value) return
  stage.value = 'edit'
  if (resetState) {
    legacyEditorState.value = null
    legacyEditorPreview.value = ''
    scheduleSave()
  }
  await nextTick()
  postLegacyEditorInit()
}

function baseImageGeometry() {
  if (!editorBackgroundImage) return null
  const width = editorBackgroundImage.naturalWidth
  const height = editorBackgroundImage.naturalHeight
  const coverScale = Math.max(CANVAS_SIZE / width, CANVAS_SIZE / height)
  const scale = coverScale * background.value.zoom
  const drawWidth = width * scale
  const drawHeight = height * scale
  return {
    x: (CANVAS_SIZE - drawWidth) / 2 + background.value.x,
    y: (CANVAS_SIZE - drawHeight) / 2 + background.value.y,
    width: drawWidth,
    height: drawHeight
  }
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(Math.max(0, radius), width / 2, height / 2)
  context.beginPath()
  context.roundRect(x, y, width, height, safeRadius)
}

function getComponentImage(layer) {
  if (!layer?.dataUrl) return null
  if (componentImageCache.has(layer.dataUrl)) return componentImageCache.get(layer.dataUrl)
  loadImage(layer.dataUrl).then(image => {
    componentImageCache.set(layer.dataUrl, image)
    renderEditorCanvas()
  }).catch(() => {})
  return null
}

function drawLayer(context, layer) {
  context.save()
  context.globalAlpha = layer.opacity ?? 1
  if (layer.type === 'text') {
    context.fillStyle = layer.color
    context.font = `${layer.weight || 600} ${layer.fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`
    context.textBaseline = 'top'
    String(layer.text || '文字').split('\n').forEach((line, index) => {
      context.fillText(line, layer.x, layer.y + index * layer.fontSize * 1.28)
    })
  } else if (layer.type === 'rect') {
    context.fillStyle = layer.color
    roundedRect(context, layer.x, layer.y, layer.width, layer.height, layer.radius || 0)
    context.fill()
  } else if (layer.type === 'circle') {
    context.fillStyle = layer.color
    context.beginPath()
    context.arc(layer.x + layer.width / 2, layer.y + layer.height / 2, Math.min(layer.width, layer.height) / 2, 0, Math.PI * 2)
    context.fill()
  } else if (layer.type === 'image') {
    const image = getComponentImage(layer)
    if (image) context.drawImage(image, layer.x, layer.y, layer.width, layer.height)
  }
  context.restore()
}

function layerBounds(layer, context) {
  if (layer.type === 'text') {
    context.save()
    context.font = `${layer.weight || 600} ${layer.fontSize}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`
    const lines = String(layer.text || '文字').split('\n')
    const width = Math.max(...lines.map(line => context.measureText(line).width), layer.fontSize)
    context.restore()
    return { x: layer.x, y: layer.y, width, height: lines.length * layer.fontSize * 1.28 }
  }
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height }
}

function renderEditorCanvas() {
  const canvas = editorCanvas.value
  if (!canvas || !editorBackgroundImage) return
  const context = canvas.getContext('2d')
  context.save()
  context.fillStyle = '#fff'
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  const geometry = baseImageGeometry()
  context.drawImage(editorBackgroundImage, geometry.x, geometry.y, geometry.width, geometry.height)
  layers.value.forEach(layer => drawLayer(context, layer))

  const selected = activeLayer.value
  if (selected) {
    const bounds = layerBounds(selected, context)
    context.strokeStyle = '#ff624e'
    context.lineWidth = 4
    context.setLineDash([12, 8])
    context.strokeRect(bounds.x - 8, bounds.y - 8, bounds.width + 16, bounds.height + 16)
    context.setLineDash([])
  }
  context.restore()
}

function addLayer(type) {
  pushUndo()
  const id = window.crypto?.randomUUID?.() || `layer-${Date.now()}`
  let layer
  if (type === 'text') {
    layer = { id, type, text: '双击右侧文本进行编辑', x: 160, y: 170, fontSize: 72, weight: 600, color: '#1c2d33', opacity: 1 }
  } else if (type === 'circle') {
    layer = { id, type, x: 210, y: 210, width: 260, height: 260, color: '#7fcfc1', opacity: .92 }
  } else {
    layer = { id, type: 'rect', x: 190, y: 210, width: 430, height: 190, radius: 24, color: '#20323a', opacity: .92 }
  }
  layers.value = [...layers.value, layer]
  activeLayerId.value = id
  renderEditorCanvas()
  scheduleEditorPersist()
}

async function addImageLayer(file) {
  if (!file) return
  if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    ElMessage.error('组件支持 PNG、SVG、JPG 或 WebP，且不超过 10MB。')
    return
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('组件读取失败。'))
    reader.readAsDataURL(file)
  })
  const image = await loadImage(dataUrl)
  componentImageCache.set(dataUrl, image)
  const maxSide = 360
  const ratio = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight, 1)
  pushUndo()
  const id = window.crypto?.randomUUID?.() || `layer-${Date.now()}`
  layers.value = [...layers.value, {
    id,
    type: 'image',
    dataUrl,
    x: 180,
    y: 180,
    width: image.naturalWidth * ratio,
    height: image.naturalHeight * ratio,
    opacity: 1
  }]
  activeLayerId.value = id
  renderEditorCanvas()
  scheduleEditorPersist()
  if (componentInput.value) componentInput.value.value = ''
}

function hitLayer(point) {
  const context = editorCanvas.value.getContext('2d')
  return [...layers.value].reverse().find(layer => {
    const bounds = layerBounds(layer, context)
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height
  })
}

function onEditorPointerDown(event) {
  if (!editorBackgroundImage) return
  const canvas = editorCanvas.value
  const point = getCanvasPoint(event, canvas)
  canvas.setPointerCapture(event.pointerId)
  if (editorTool.value === 'background') {
    pushUndo()
    editorPointerState = { pointerId: event.pointerId, type: 'background', start: point, originX: background.value.x, originY: background.value.y }
    return
  }
  const layer = hitLayer(point)
  if (!layer) {
    activeLayerId.value = ''
    renderEditorCanvas()
    return
  }
  pushUndo()
  activeLayerId.value = layer.id
  editorPointerState = { pointerId: event.pointerId, type: 'layer', start: point, layerId: layer.id, originX: layer.x, originY: layer.y }
  renderEditorCanvas()
}

function onEditorPointerMove(event) {
  if (!editorPointerState || editorPointerState.pointerId !== event.pointerId) return
  const point = getCanvasPoint(event, editorCanvas.value)
  const dx = point.x - editorPointerState.start.x
  const dy = point.y - editorPointerState.start.y
  if (editorPointerState.type === 'background') {
    background.value = { ...background.value, x: editorPointerState.originX + dx, y: editorPointerState.originY + dy }
  } else {
    const layer = layers.value.find(item => item.id === editorPointerState.layerId)
    if (layer) {
      layer.x = editorPointerState.originX + dx
      layer.y = editorPointerState.originY + dy
    }
  }
  renderEditorCanvas()
}

function onEditorPointerUp(event) {
  if (!editorPointerState || editorPointerState.pointerId !== event.pointerId) return
  editorPointerState = null
  editorCanvas.value?.releasePointerCapture?.(event.pointerId)
  scheduleEditorPersist()
}

function scheduleEditorPersist() {
  renderEditorCanvas()
  scheduleSave()
  scheduleExportEstimate()
}

function commitLayerChange() {
  if (propertyEditSnapshot) {
    undoStack.value = [...undoStack.value, propertyEditSnapshot].slice(-30)
    redoStack.value = []
    propertyEditSnapshot = ''
  }
  scheduleEditorPersist()
}

function beginPropertyEdit() {
  propertyEditSnapshot = snapshotEditor()
}

function removeActiveLayer() {
  if (!activeLayer.value) return
  pushUndo()
  layers.value = layers.value.filter(layer => layer.id !== activeLayerId.value)
  activeLayerId.value = ''
  scheduleEditorPersist()
}

function moveLayer(direction) {
  const index = layers.value.findIndex(layer => layer.id === activeLayerId.value)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= layers.value.length) return
  pushUndo()
  const next = [...layers.value]
  ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
  layers.value = next
  scheduleEditorPersist()
}

function changeBackgroundZoom(value) {
  pushUndo()
  background.value = { ...background.value, zoom: Number(value) }
  scheduleEditorPersist()
}

async function compressJpeg(canvas) {
  let low = .05
  let high = .96
  let best = await canvasToBlob(canvas, 'image/jpeg', low)
  if (best.size > EXPORT_MAX_BYTES) {
    throw new Error('当前图片细节过于复杂，无法在保持 1440×1440 的同时压缩到 1MB 以下。')
  }
  for (let index = 0; index < 8; index += 1) {
    const quality = (low + high) / 2
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    if (blob.size <= EXPORT_MAX_BYTES) {
      best = blob
      low = quality
    } else {
      high = quality
    }
  }
  return best
}

function scheduleExportEstimate() {
  window.clearTimeout(estimateTimer)
  estimateTimer = window.setTimeout(async () => {
    if (!editorCanvas.value || stage.value !== 'edit') return
    const selected = activeLayerId.value
    activeLayerId.value = ''
    renderEditorCanvas()
    try {
      const blob = await compressJpeg(editorCanvas.value)
      exportBytes.value = blob.size
    } finally {
      activeLayerId.value = selected
      renderEditorCanvas()
    }
  }, 650)
}

async function exportJpeg() {
  if (!editorCanvas.value || exportBusy.value) return
  exportBusy.value = true
  const selected = activeLayerId.value
  activeLayerId.value = ''
  renderEditorCanvas()
  try {
    const blob = await compressJpeg(editorCanvas.value)
    exportBytes.value = blob.size
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${projectName.value || '单图项目'}-1440x1440.jpg`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    ElMessage.success(`已导出 1440×1440 JPG（${formatBytes(blob.size)}）`)
  } catch (error) {
    ElMessage.error(error?.message || '导出失败。')
  } finally {
    activeLayerId.value = selected
    renderEditorCanvas()
    exportBusy.value = false
  }
}

async function returnToGenerate() {
  stage.value = 'generate'
  await nextTick()
  await setWorkingImage(currentImage.value, { maskData: serializeMask() })
  scheduleSave()
}

watch(prompt, () => {
  if (promptError.value && prompt.value.trim()) promptError.value = ''
  if (!isHydratingProject && projectId.value) scheduleSave()
})

watch(referenceImage, (nextReference, previousReference) => {
  if (nextReference && !prompt.value.trim()) {
    prompt.value = REFERENCE_PROMPT_DEFAULT
    return
  }
  if (!nextReference && previousReference && prompt.value === REFERENCE_PROMPT_DEFAULT) {
    prompt.value = ''
  }
})

watch(activeTool, () => {
  window.requestAnimationFrame(() => {
    ensureSelectionGeometry()
    renderGenerateCanvas()
  })
}, { immediate: true, flush: 'post' })

watch([background, layers], () => {
  if (stage.value === 'edit') renderEditorCanvas()
}, { deep: true })

onMounted(() => {
  if (props.embeddedRefine) hydrateEmbeddedRefine()
  else {
    refreshProjects()
    window.addEventListener('message', handleLegacyEditorMessage)
    window.addEventListener('beforeunload', onBeforeUnload)
  }
})

watch(() => props.refineImage, (nextImage, previousImage) => {
  if (props.embeddedRefine && nextImage && nextImage !== previousImage) hydrateEmbeddedRefine(nextImage)
})

onUnmounted(() => {
  window.clearTimeout(saveStatusTimer)
  window.clearTimeout(estimateTimer)
  generateController?.abort()
  referenceLibraryController?.abort()
  if (!props.embeddedRefine) {
    window.removeEventListener('message', handleLegacyEditorMessage)
    window.removeEventListener('beforeunload', onBeforeUnload)
  }
})
</script>

<template>
  <section class="single-mode" :aria-label="embeddedRefine ? '灵感图局部编辑' : '单图编辑模式'">
    <main v-if="view === 'projects'" class="single-projects-page">
      <div class="single-page-head">
        <div>
          <span class="eyebrow">手动保存</span>
          <h1>我的单图项目</h1>
          <p>仅在编辑器中点击“保存到单图项目”后，项目才会写入当前浏览器。</p>
        </div>
        <button class="primary-button" type="button" @click="resetWorkspace"><Plus />新建单图项目</button>
      </div>

      <div v-if="projectsLoading" class="single-empty-state" aria-live="polite">正在读取本地项目…</div>
      <div v-else-if="projectsError" class="single-empty-state error-panel" role="alert">
        <strong>无法读取项目</strong>
        <span>{{ projectsError }}</span>
        <button type="button" @click="refreshProjects">重试</button>
      </div>
      <div v-else-if="!projects.length" class="single-empty-state">
        <FolderOpened aria-hidden="true" />
        <strong>还没有单图项目</strong>
        <span>完成修图并进入编辑器后，点击“保存到单图项目”创建项目。</span>
        <button type="button" @click="resetWorkspace">开始第一个项目</button>
      </div>
      <section v-else class="single-project-grid" aria-label="单图项目列表">
        <article v-for="item in projects" :key="item.projectId" class="single-project-card">
          <button type="button" class="single-project-preview" :aria-label="`继续编辑${item.name}`" @click="openProject(item)">
            <img v-if="item.thumbnail" :src="item.thumbnail" :alt="`${item.name}预览`" />
            <span v-else><Picture aria-hidden="true" />无预览图</span>
            <em>{{ item.stage === 'crop' ? '等待裁图' : item.stage === 'edit' ? '1440 编辑中' : '精准修图中' }}</em>
          </button>
          <div class="single-project-card-body">
            <h2>{{ item.name }}</h2>
            <p>{{ item.sourceWidth }}×{{ item.sourceHeight }} px · {{ item.historyCount }} 个生成版本</p>
            <time :datetime="item.updatedAt">最近保存 {{ formatUpdatedAt(item.updatedAt) }}</time>
            <div class="single-project-actions">
              <button type="button" class="primary-card-button" @click="openProject(item)">继续编辑</button>
              <button type="button" class="danger-icon-button" :aria-label="`删除${item.name}`" @click="confirmDeleteProject(item)"><Delete /></button>
            </div>
          </div>
        </article>
      </section>
    </main>

    <main v-else-if="stage === 'crop'" class="single-crop-page">
      <aside class="single-crop-controls">
        <div class="step-heading">
          <span>01</span>
          <div><strong>裁成 1:1 方图</strong><small>先确定进入修改环节的完整画面</small></div>
        </div>

        <div class="source-summary">
          <Picture aria-hidden="true" />
          <div><strong>{{ sourceFileName }}</strong><span>{{ rawWidth }} × {{ rawHeight }} px</span></div>
          <button type="button" @click="fileInput?.click()">更换</button>
        </div>
        <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="onFileChange" />

        <div class="crop-control-group">
          <label class="range-field" for="crop-size">
            <span>裁剪范围 <b>{{ Math.round(cropSelection?.size || 0) }} px</b></span>
            <input
              id="crop-size"
              :value="cropSelection?.size || 1"
              type="range"
              :min="Math.min(40, cropMaxSize)"
              :max="cropMaxSize"
              step="1"
              @input="updateCropSize($event.target.value)"
            />
          </label>
          <label class="range-field" for="crop-x">
            <span>水平位置 <b>{{ Math.round(cropSelection?.x || 0) }}</b></span>
            <input id="crop-x" :value="cropSelection?.x || 0" type="range" min="0" :max="cropMaxX" step="1" @input="updateCropPosition('x', $event.target.value)" />
          </label>
          <label class="range-field" for="crop-y">
            <span>垂直位置 <b>{{ Math.round(cropSelection?.y || 0) }}</b></span>
            <input id="crop-y" :value="cropSelection?.y || 0" type="range" min="0" :max="cropMaxY" step="1" @input="updateCropPosition('y', $event.target.value)" />
          </label>
          <button class="crop-reset-button" type="button" @click="resetCropSelection">恢复居中最大方图</button>
        </div>

        <p class="crop-help">可拖动方框调整位置，拖动四角改变大小；聚焦画布后可用方向键微调。</p>
        <p v-if="cropError" class="field-error" role="alert">{{ cropError }}</p>
        <button class="confirm-crop-button" type="button" :disabled="!hasRawImage || cropBusy" :aria-busy="cropBusy" @click="confirmCrop">
          <Crop aria-hidden="true" />
          <span>{{ cropBusy ? '正在处理裁图…' : '确认裁图并进入修改' }}</span>
        </button>
        <small class="crop-output-note">确认后将等比例输出为 1440×1440 px，再进入 API 修改环节。</small>
      </aside>

      <section class="single-canvas-panel crop-canvas-panel" aria-label="1:1 裁图画布">
        <div class="canvas-panel-head">
          <div><span class="live-dot" aria-hidden="true"></span><strong>裁图预览</strong><span>固定 1:1 比例</span></div>
          <div class="canvas-panel-actions">
            <button
              class="canvas-save-button"
              type="button"
              :disabled="saveInFlight || !projectId || (!rawImage && !sourceImage)"
              :aria-busy="saveInFlight"
              @click="saveWorkspaceProject"
            >
              <span>{{ saveInFlight ? '正在保存…' : '保存到单图项目' }}</span>
            </button>
            <button class="canvas-projects-button" type="button" @click="showProjects">
              <FolderOpened aria-hidden="true" />
              <span>我的单图项目</span>
              <em v-if="projects.length" class="project-count">{{ projects.length }}</em>
            </button>
            <span class="result-badge">输出 1440×1440</span>
          </div>
        </div>
        <div class="single-canvas-stage crop-canvas-stage">
          <canvas
            ref="cropCanvas"
            tabindex="0"
            aria-label="1:1 裁图画布，可拖动裁剪框，方向键移动，减号和加号缩放"
            @pointerdown="onCropPointerDown"
            @pointermove="onCropPointerMove"
            @pointerup="onCropPointerUp"
            @pointercancel="onCropPointerUp"
            @keydown="onCropKeydown"
          />
        </div>
        <div class="canvas-footer-status" aria-live="polite">
          <span>{{ saveStatus || '完成编辑后点击“保存到单图项目”' }}</span>
          <span>{{ Math.round(cropSelection?.size || 0) }} × {{ Math.round(cropSelection?.size || 0) }} px → 1440 × 1440 px</span>
        </div>
      </section>

      <aside class="crop-flow-panel">
        <span class="tool-label">当前流程</span>
        <ol class="crop-flow-list">
          <li class="active"><span>01</span><div><strong>裁成方图</strong><small>保留商品主体和需要的构图</small></div></li>
          <li><span>02</span><div><strong>框选修改区域</strong><small>输入提示词并调用图片服务</small></div></li>
          <li><span>03</span><div><strong>确认生成结果</strong><small>选区外像素保持不变</small></div></li>
          <li><span>04</span><div><strong>进入编辑模式</strong><small>添加文字、形状和图片组件</small></div></li>
        </ol>
        <div class="crop-spec-card">
          <span>裁图输出</span>
          <strong>1440 × 1440 px</strong>
          <small>PNG 基础图 · 后续编辑画布同尺寸</small>
        </div>
      </aside>
    </main>

    <main v-else-if="stage === 'generate'" class="single-workspace">
      <aside class="single-control-panel">
        <div class="step-heading">
          <span>{{ hasImage ? '02' : '01' }}</span>
          <div><strong>{{ embeddedRefine ? '定义局部编辑区域' : hasImage ? '定义修改区域' : '上传商品图' }}</strong><small>{{ hasImage ? '选区外像素将被强制保留' : '上传后先完成 1:1 裁图' }}</small></div>
        </div>

        <div
          v-if="!hasImage && !embeddedRefine"
          class="single-upload-zone"
          :class="{ dragging: isDragOver }"
          role="button"
          tabindex="0"
          aria-label="上传单张图片"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @keydown.space.prevent="fileInput?.click()"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop="onDrop"
        >
          <UploadFilled aria-hidden="true" />
          <strong>上传一张商品图</strong>
          <span>拖放到此处，或点击选择文件</span>
          <small>JPG、PNG、WebP · 不限制文件大小</small>
        </div>
        <input v-if="!embeddedRefine" ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" @change="onFileChange" />
        <p v-if="uploadError" class="field-error" role="alert">{{ uploadError }}</p>

        <div v-if="hasImage" class="source-summary">
          <Picture aria-hidden="true" />
          <div><strong>{{ sourceFileName }}</strong><span>{{ sourceWidth }} × {{ sourceHeight }} px</span></div>
          <button v-if="!embeddedRefine" type="button" @click="fileInput?.click()">更换</button>
        </div>

        <div v-if="hasImage" class="tool-section">
          <span class="tool-label">蒙版工具</span>
          <div class="mask-tools" role="toolbar" aria-label="蒙版工具">
            <button type="button" :class="{ active: activeTool === 'box' }" :aria-pressed="activeTool === 'box'" @click="activeTool = 'box'"><Crop />{{ hasSelection ? '重新框选' : `${selectionRatioKey} 框选` }}</button>
          </div>
          <div class="aspect-ratio-field">
            <span>框选比例</span>
            <div class="aspect-ratio-picker" role="radiogroup" aria-label="框选比例">
              <button
                v-for="ratio in SELECTION_RATIOS"
                :key="ratio.key"
                type="button"
                role="radio"
                :class="{ active: selectionRatioKey === ratio.key }"
                :aria-checked="selectionRatioKey === ratio.key"
                @click="setSelectionRatio(ratio.key)"
              >{{ ratio.key }}</button>
            </div>
          </div>
          <button class="text-button" type="button" :disabled="!hasSelection" @click="clearSelection">清除选区并重新框选</button>
        </div>

        <form class="prompt-form" novalidate @submit.prevent="generateImage">
          <section class="reference-upload-field" aria-labelledby="reference-image-label">
            <div class="reference-field-head">
              <div>
                <strong id="reference-image-label">参考图片</strong>
                <span>可选 · 用于参考材质、颜色或造型</span>
              </div>
              <div class="reference-field-actions">
                <button type="button" @click="referenceInput?.click()">从电脑上传</button>
                <button v-if="referenceImage" class="remove" type="button" @click="removeReferenceImage">移除</button>
              </div>
            </div>
            <button
              v-if="!referenceImage"
              class="reference-upload-button"
              type="button"
              @click="openReferenceLibrary"
            >
              <Picture aria-hidden="true" />
              <span><strong>上传参考图片</strong><small>从本地“软装搭配”素材库选择</small></span>
            </button>
            <div v-else class="reference-image-summary">
              <img :src="referenceImage" alt="参考图片预览" />
              <div>
                <strong>{{ referenceFileName }}</strong>
                <span>{{ referenceWidth }} × {{ referenceHeight }} px</span>
              </div>
              <button type="button" @click="openReferenceLibrary">更换</button>
            </div>
            <input
              ref="referenceInput"
              class="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="onReferenceFileChange"
            />
            <p v-if="referenceUploadError" class="field-error" role="alert">{{ referenceUploadError }}</p>
          </section>
          <label :for="promptFieldId">修改提示词</label>
          <textarea
            :id="promptFieldId"
            ref="promptInput"
            v-model="prompt"
            class="resize-none"
            rows="5"
            maxlength="500"
            placeholder="例如：将选区内的面料改为米白色羊羔绒，保持光影和褪皱"
            :aria-invalid="Boolean(promptError)"
            :aria-describedby="promptError ? promptErrorId : promptHelpId"
          />
          <div class="prompt-meta"><span :id="promptHelpId">发送选区、蒙版{{ referenceImage ? '和参考图' : '' }}</span><span>{{ prompt.length }}/500</span></div>
          <p v-if="promptError" :id="promptErrorId" class="field-error" role="alert">{{ promptError }}</p>
          <div v-if="generateError" class="inline-error" role="alert">
            <span>{{ generateError }}</span>
            <button type="button" @click="generateImage">重试</button>
          </div>
          <button class="generate-button" type="submit" :disabled="!canGenerate" :aria-busy="isGenerating">
            <MagicStick aria-hidden="true" />
            <span>{{ isGenerating ? '正在精准修改…' : '生成选区结果' }}</span>
          </button>
          <button v-if="isGenerating" class="cancel-generate" type="button" @click="cancelGenerate">取消生成</button>
        </form>
      </aside>

      <section class="single-canvas-panel" aria-label="精准修图画布">
        <div class="canvas-panel-head generate-canvas-head">
          <div class="canvas-status-group">
            <span class="live-dot" aria-hidden="true"></span>
            <strong>{{ hasImage ? '精准选区' : '等待图片' }}</strong>
            <span v-if="hasImage">{{ embeddedRefine ? `灵感成图 · ${refineRatio}` : '裁图基础图' }} · {{ sourceWidth }}×{{ sourceHeight }}</span>
            <button
              v-if="hasImage"
              class="canvas-back-button"
              type="button"
              :disabled="isGenerating || (!embeddedRefine && !hasRawImage)"
              @click="leaveGenerateStage"
            >
              <Back aria-hidden="true" />
              <span>{{ embeddedRefine ? '返回灵感成图' : '返回上一步' }}</span>
            </button>
          </div>
          <div class="canvas-panel-actions">
            <span v-if="history.length" class="result-badge">生成结果</span>
            <button
              v-if="!embeddedRefine && (hasImage || hasRawImage)"
              class="canvas-save-button"
              type="button"
              :disabled="saveInFlight || !projectId"
              :aria-busy="saveInFlight"
              @click="saveWorkspaceProject"
            >
              <span>{{ saveInFlight ? '正在保存…' : '保存到单图项目' }}</span>
            </button>
            <button v-if="!embeddedRefine" class="canvas-projects-button" type="button" @click="showProjects">
              <FolderOpened aria-hidden="true" />
              <span>我的单图项目</span>
              <em v-if="projects.length" class="project-count">{{ projects.length }}</em>
            </button>
          </div>
        </div>
        <div class="single-canvas-stage" :class="{ empty: !hasImage, transforming: activeTool === 'transform' }">
          <div v-if="!hasImage" class="canvas-placeholder">
            <span class="placeholder-square"><Picture /></span>
            <strong>图片将以原始比例显示在这里</strong>
            <p>上传后选择比例并拖动框选，再直接移动或等比例缩放。</p>
          </div>
          <canvas
            v-show="hasImage"
            ref="previewCanvas"
            :aria-label="activeTool === 'box' ? `拖动创建 ${selectionRatioKey} 选区` : '移动或等比例缩放选区蒙版，按 Delete 删除蒙版'"
            tabindex="0"
            @pointerdown="onPreviewPointerDown"
            @pointermove="onPreviewPointerMove"
            @pointerup="onPreviewPointerUp"
            @pointercancel="onPreviewPointerUp"
            @keydown="onPreviewKeydown"
          />
        </div>
        <div class="canvas-footer-status" aria-live="polite">
          <span>{{ embeddedRefine ? '模式 3 局部编辑草稿' : saveStatus || '当前修改尚未保存' }}</span>
          <span v-if="selection">{{ selectionRatioKey }} · 选区 {{ Math.round(selection.width) }}×{{ Math.round(selection.height) }} px · Delete 删除蒙版</span>
        </div>
      </section>

      <aside class="single-history-panel">
        <div class="step-heading compact">
          <span>03</span>
          <div><strong>{{ embeddedRefine ? '下载局部编辑结果' : '确认生成结果' }}</strong><small>保留最近 {{ MAX_HISTORY }} 个版本</small></div>
        </div>
        <div class="history-list">
          <button v-if="sourceImage" type="button" class="history-item" :class="{ active: currentImage === sourceImage }" @click="restoreVersion(null)">
            <img :src="sourceImage" alt="最初原图" />
            <span><strong>{{ embeddedRefine ? '选定灵感图' : '最初原图' }}</strong><small>始终保留</small></span>
          </button>
          <div v-for="(version, index) in [...history].reverse()" :key="version.id" class="history-version">
            <button type="button" class="history-item" :class="{ active: currentImage === version.dataUrl }" @click="restoreVersion(version)">
              <img :src="version.dataUrl" :alt="`生成版本 ${history.length - index}`" />
              <span><strong>版本 {{ String(history.length - index).padStart(2, '0') }}</strong><small>{{ version.prompt }}</small></span>
            </button>
            <button type="button" class="history-delete" :aria-label="`删除版本${history.length - index}`" @click="removeVersion(version)"><Delete /></button>
          </div>
          <div v-if="!history.length" class="history-empty">
            <MagicStick aria-hidden="true" />
            <strong>还没有生成结果</strong>
            <span>完成选区和提示词后，新版本会出现在这里。</span>
          </div>
        </div>
        <div class="enter-editor-block">
          <template v-if="embeddedRefine">
            <span>完成局部修改后直接下载当前图片</span>
            <button
              class="enter-editor-button"
              type="button"
              :disabled="!hasImage || isGenerating || refineDownloadBusy"
              :aria-busy="refineDownloadBusy"
              @click="downloadEmbeddedRefine"
            >
              <span>{{ refineDownloadBusy ? '正在准备下载…' : '下载图片' }}<small>{{ refineRatio }} · PNG</small></span><Download />
            </button>
          </template>
          <template v-else>
            <span>当前图片将等比铺满方形画布</span>
            <button class="enter-editor-button" type="button" :disabled="!hasImage || isGenerating" @click="initializeEditor(true)">
              <span>进入编辑模式<small>1440×1440 方图</small></span><Right />
            </button>
          </template>
        </div>
      </aside>
    </main>

    <main v-else-if="false" class="single-editor-page" aria-hidden="true">
      <aside class="editor-tools-panel">
        <button class="back-to-mask" type="button" @click="returnToGenerate"><Back />返回精准修图</button>
        <div class="step-heading">
          <span>04</span>
          <div><strong>方图编辑</strong><small>编辑文字、形状与图片组件</small></div>
        </div>
        <div class="editor-tool-group">
          <span class="tool-label">画布操作</span>
          <div class="editor-tool-grid">
            <button type="button" :class="{ active: editorTool === 'select' }" @click="editorTool = 'select'"><Rank />选择图层</button>
            <button type="button" :class="{ active: editorTool === 'background' }" @click="editorTool = 'background'"><Picture />移动底图</button>
          </div>
          <label class="range-field" for="background-zoom">
            <span>底图缩放 <b>{{ Math.round(background.zoom * 100) }}%</b></span>
            <input id="background-zoom" :value="background.zoom" type="range" min="1" max="2.4" step="0.02" @change="changeBackgroundZoom($event.target.value)" />
          </label>
        </div>
        <div class="editor-tool-group">
          <span class="tool-label">添加内容</span>
          <div class="add-tools">
            <button type="button" @click="addLayer('text')"><Plus />文本</button>
            <button type="button" @click="addLayer('rect')"><Plus />矩形</button>
            <button type="button" @click="addLayer('circle')"><CirclePlus />圆形</button>
            <button type="button" @click="componentInput?.click()"><UploadFilled />图片组件</button>
          </div>
          <input ref="componentInput" class="visually-hidden" type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" @change="addImageLayer($event.target.files?.[0])" />
        </div>
        <div class="undo-row">
          <button type="button" :disabled="!undoStack.length" @click="undoEditor"><RefreshLeft />撤销</button>
          <button type="button" :disabled="!redoStack.length" @click="redoEditor"><RefreshLeft class="redo-icon" />重做</button>
        </div>
      </aside>

      <section class="square-editor-stage" aria-label="1440 方图画布">
        <div class="square-editor-head">
          <div><strong>{{ projectName }}</strong><span>1440 × 1440 px</span></div>
          <span>{{ saveStatus }}</span>
        </div>
        <div class="square-canvas-wrap" :class="{ moving: editorTool === 'background' }">
          <canvas
            ref="editorCanvas"
            width="1440"
            height="1440"
            tabindex="0"
            aria-label="1440 方图编辑画布"
            @pointerdown="onEditorPointerDown"
            @pointermove="onEditorPointerMove"
            @pointerup="onEditorPointerUp"
            @pointercancel="onEditorPointerUp"
          />
        </div>
        <p class="editor-canvas-tip">{{ editorTool === 'background' ? '拖动画布调整底图裁切位置' : '点击图层后可拖动，也可在右侧输入精确位置' }}</p>
      </section>

      <aside class="layer-properties-panel">
        <div class="property-panel-head">
          <div><span>图层属性</span><strong>{{ activeLayer ? '已选图层' : '未选择' }}</strong></div>
          <button v-if="activeLayer" type="button" class="danger-icon-button" aria-label="删除当前图层" @click="removeActiveLayer"><Delete /></button>
        </div>
        <div v-if="activeLayer" class="property-fields">
          <label v-if="activeLayer.type === 'text'">
            <span>文本内容</span>
            <textarea v-model="activeLayer.text" class="resize-none" rows="4" @focus="beginPropertyEdit" @change="commitLayerChange" />
          </label>
          <label v-if="activeLayer.type === 'text'">
            <span>字号 <b>{{ activeLayer.fontSize }} px</b></span>
            <input v-model.number="activeLayer.fontSize" type="range" min="24" max="180" step="2" @focus="beginPropertyEdit" @change="commitLayerChange" />
          </label>
          <label v-if="activeLayer.type !== 'image'">
            <span>颜色</span>
            <input v-model="activeLayer.color" type="color" @focus="beginPropertyEdit" @change="commitLayerChange" />
          </label>
          <div class="coordinate-grid">
            <label><span>X</span><input v-model.number="activeLayer.x" type="number" min="-1440" max="2880" @focus="beginPropertyEdit" @change="commitLayerChange" /></label>
            <label><span>Y</span><input v-model.number="activeLayer.y" type="number" min="-1440" max="2880" @focus="beginPropertyEdit" @change="commitLayerChange" /></label>
            <label v-if="activeLayer.type !== 'text'"><span>宽</span><input v-model.number="activeLayer.width" type="number" min="20" max="2880" @focus="beginPropertyEdit" @change="commitLayerChange" /></label>
            <label v-if="activeLayer.type !== 'text'"><span>高</span><input v-model.number="activeLayer.height" type="number" min="20" max="2880" @focus="beginPropertyEdit" @change="commitLayerChange" /></label>
          </div>
          <label>
            <span>不透明度 <b>{{ Math.round(activeLayer.opacity * 100) }}%</b></span>
            <input v-model.number="activeLayer.opacity" type="range" min="0.1" max="1" step="0.05" @focus="beginPropertyEdit" @change="commitLayerChange" />
          </label>
          <div class="layer-order-actions">
            <button type="button" :disabled="layers[0]?.id === activeLayer.id" @click="moveLayer(-1)">下移一层</button>
            <button type="button" :disabled="layers.at(-1)?.id === activeLayer.id" @click="moveLayer(1)">上移一层</button>
          </div>
        </div>
        <div v-else class="property-empty">
          <Rank aria-hidden="true" />
          <strong>选择一个图层</strong>
          <span>在画布中点击文本或组件，这里会显示可编辑属性。</span>
        </div>
        <div class="export-panel">
          <div><span>导出规格</span><strong>1440×1440 JPG</strong><small>预计 {{ exportSizeLabel }} · 严格小于 1MB</small></div>
          <button class="export-button" type="button" :disabled="exportBusy" :aria-busy="exportBusy" @click="exportJpeg">
            <Download />{{ exportBusy ? '正在压缩…' : '导出 JPG' }}
          </button>
        </div>
      </aside>
    </main>

    <main v-else class="legacy-single-editor-page" aria-label="单图方图编辑器">
      <iframe
        ref="legacyEditorFrame"
        class="legacy-single-editor-frame"
        :src="legacyEditorUrl"
        :title="`${projectName || '单图项目'}编辑器`"
        allow="download"
        @load="postLegacyEditorInit"
      />
    </main>

    <ElDialog
      v-model="referenceLibraryOpen"
      class="reference-library-dialog"
      width="min(880px, calc(100vw - 32px))"
      append-to-body
      destroy-on-close
      align-center
    >
      <template #header>
        <div class="reference-library-heading">
          <strong>选择软装参考图</strong>
          <span>来自项目本地的“软装搭配”素材库</span>
        </div>
      </template>

      <div class="reference-library-body">
        <div v-if="referenceLibraryLoading" class="reference-library-state" role="status" aria-live="polite">
          <span class="reference-library-spinner" aria-hidden="true"></span>
          <strong>正在读取本地素材…</strong>
        </div>
        <div v-else-if="referenceLibraryError" class="reference-library-state error" role="alert">
          <strong>{{ referenceLibraryError }}</strong>
          <button type="button" @click="loadReferenceLibrary">重试</button>
        </div>
        <div v-else-if="!referenceLibraryItems.length" class="reference-library-state">
          <strong>素材库中还没有 JPG、PNG 或 WebP 图片</strong>
          <span>可以放入图片后点击“重新读取”。</span>
          <button type="button" @click="loadReferenceLibrary">重新读取</button>
        </div>
        <div v-else class="reference-library-grid" aria-label="软装参考图">
          <button
            v-for="item in referenceLibraryItems"
            :key="item.id"
            class="reference-library-card"
            type="button"
            :disabled="Boolean(selectingReferenceId)"
            :aria-busy="selectingReferenceId === item.id"
            @click="chooseReferenceLibraryItem(item)"
          >
            <span class="reference-library-preview">
              <img :src="item.url" :alt="item.name" loading="lazy" />
              <span v-if="selectingReferenceId === item.id">正在载入…</span>
            </span>
            <span class="reference-library-meta">
              <strong>{{ item.name }}</strong>
              <small>{{ item.category }} · {{ formatBytes(item.size) }}</small>
            </span>
          </button>
        </div>
      </div>

      <template #footer>
        <div class="reference-library-footer">
          <button type="button" class="reference-library-secondary" @click="chooseReferenceFromComputer">从电脑选择其他图片</button>
          <button type="button" class="reference-library-close" @click="referenceLibraryOpen = false">关闭</button>
        </div>
      </template>
    </ElDialog>
  </section>
</template>

<style scoped>
.single-mode {
  min-height: calc(100vh - 68px);
  color: var(--ink);
  background: var(--canvas-work);
}

.legacy-single-editor-page {
  height: calc(100vh - 68px);
  min-height: 620px;
  background: #1a252d;
}

.legacy-single-editor-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #1a252d;
}

button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible, canvas:focus-visible, [role="button"]:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent-bright);
  outline-offset: 3px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.single-crop-page {
  min-height: calc(100vh - 68px);
  display: grid;
  grid-template-columns: 320px minmax(460px, 1fr) 300px;
}

.single-crop-controls,
.crop-flow-panel {
  min-width: 0;
  padding: 22px;
  background: var(--menu-studio);
  color: #f3faf9;
}

.single-crop-controls { border-right: 1px solid var(--menu-studio-line); }
.crop-flow-panel { border-left: 1px solid var(--menu-studio-line); }
.crop-control-group { margin-top: 20px; padding-top: 4px; }
.crop-reset-button {
  width: 100%;
  min-height: 36px;
  margin-top: 14px;
  border: 1px solid #526574;
  border-radius: 5px;
  background: var(--menu-studio-raised);
  color: #eaf5f4;
  font-size: 10px;
}
.crop-reset-button:hover { border-color: var(--accent-bright); background: #203b3d; color: var(--accent-bright); }
.crop-help,
.crop-output-note {
  display: block;
  color: #9fb0ba;
  font-size: 10px;
  line-height: 1.65;
}
.crop-help { margin: 18px 0 0; }
.confirm-crop-button {
  width: 100%;
  min-height: 44px;
  margin-top: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--accent-bright);
  border-radius: 6px;
  background: var(--accent-bright);
  color: #102026;
  font-size: 12px;
  font-weight: 600;
}
.confirm-crop-button:hover:not(:disabled) { border-color: #76f7e1; background: #76f7e1; }
.confirm-crop-button svg { width: 17px; height: 17px; }
.crop-output-note { margin-top: 9px; text-align: center; }
.crop-canvas-panel { min-height: calc(100vh - 68px); }
.crop-canvas-stage canvas { cursor: move; }
.crop-canvas-stage canvas:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }
.crop-flow-list {
  margin: 18px 0 0;
  padding: 0;
  display: grid;
  gap: 7px;
  list-style: none;
}
.crop-flow-list li {
  padding: 11px 10px;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  color: #91a4ad;
}
.crop-flow-list li.active { border-color: var(--accent-bright); background: #203b3d; color: #f3faf9; }
.crop-flow-list li > span {
  width: 27px;
  height: 21px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: var(--menu-studio-raised);
  color: #9fb0ba;
  font: 600 9px Montserrat, sans-serif;
}
.crop-flow-list li.active > span { background: var(--accent-bright); color: #102026; }
.crop-flow-list li div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.crop-flow-list strong { font-size: 11px; }
.crop-flow-list small { font-size: 9px; line-height: 1.55; }
.crop-spec-card {
  margin-top: 22px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border: 1px solid var(--menu-studio-line);
  border-radius: 7px;
  background: var(--menu-studio-raised);
}
.crop-spec-card span { color: #9fb0ba; font-size: 9px; }
.crop-spec-card strong { color: var(--accent-bright); font: 600 16px Montserrat, sans-serif; }
.crop-spec-card small { color: #aebdc7; font-size: 9px; line-height: 1.5; }

.single-workspace {
  min-height: calc(100vh - 68px);
  display: grid;
  grid-template-columns: 320px minmax(420px, 1fr) 300px;
}

.single-control-panel, .single-history-panel, .editor-tools-panel, .layer-properties-panel {
  min-width: 0;
  padding: 22px;
  background: var(--menu-studio);
  color: #f3faf9;
}
.single-control-panel, .editor-tools-panel { border-right: 1px solid var(--menu-studio-line); }
.single-history-panel, .layer-properties-panel { border-left: 1px solid var(--menu-studio-line); }

.step-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px; }
.step-heading > span {
  min-width: 31px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: var(--accent-bright);
  color: #102026;
  font: 600 10px/1 Montserrat, sans-serif;
  letter-spacing: .09em;
}
.step-heading > div { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.step-heading strong { font-size: 13px; line-height: 1.4; }
.step-heading small { color: #9fb0ba; font-size: 10px; line-height: 1.55; }
.step-heading.compact { margin-bottom: 14px; }

.single-upload-zone {
  min-height: 222px;
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px dashed #607381;
  border-radius: 8px;
  background: var(--menu-studio-raised);
  text-align: center;
  transition: border-color .16s ease, background-color .16s ease;
}
.single-upload-zone:hover, .single-upload-zone.dragging { border-color: var(--accent-bright); background: #203b3d; }
.single-upload-zone > svg { width: 30px; height: 30px; color: var(--accent-bright); }
.single-upload-zone strong { font-size: 13px; }
.single-upload-zone span, .single-upload-zone small { color: #aebdc7; font-size: 11px; line-height: 1.6; }

.field-error { margin: 8px 0 0; color: #ff9b91; font-size: 11px; line-height: 1.55; }
.source-summary {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #526574;
  border-radius: 7px;
  background: var(--menu-studio-raised);
}
.source-summary > svg { width: 22px; height: 22px; color: var(--accent-bright); }
.source-summary > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.source-summary strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.source-summary span { color: #9fb0ba; font: 10px Montserrat, sans-serif; }
.source-summary button, .text-button {
  padding: 5px 7px;
  border: 0;
  background: transparent;
  color: var(--accent-bright);
  font-size: 11px;
}

.tool-section, .editor-tool-group { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--menu-studio-line); }
.tool-label { display: block; margin-bottom: 9px; color: #cfdddf; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
.mask-tools { display: grid; grid-template-columns: 1fr; gap: 5px; }
.mask-tools button, .editor-tool-grid button, .add-tools button, .undo-row button {
  min-height: 38px;
  padding: 7px 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid #526574;
  border-radius: 5px;
  background: var(--menu-studio-raised);
  color: #eaf5f4;
  font-size: 10px;
}
.mask-tools button:hover, .mask-tools button.active,
.editor-tool-grid button:hover, .editor-tool-grid button.active,
.add-tools button:hover, .undo-row button:hover:not(:disabled) {
  border-color: var(--accent-bright);
  background: var(--accent-bright);
  color: #102026;
}
.mask-tools svg, .editor-tool-grid svg, .add-tools svg, .undo-row svg { width: 15px; height: 15px; }
.aspect-ratio-field { margin-top: 13px; }
.aspect-ratio-field > span { display: block; margin-bottom: 7px; color: #9fb0ba; font-size: 9px; }
.aspect-ratio-picker { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
.aspect-ratio-picker button {
  min-height: 30px;
  padding: 5px 3px;
  border: 1px solid var(--menu-studio-line);
  border-radius: 5px;
  background: var(--menu-studio-raised);
  color: #cfdddf;
  font: 600 10px Montserrat, sans-serif;
}
.aspect-ratio-picker button:hover, .aspect-ratio-picker button.active {
  border-color: var(--accent-bright);
  background: rgba(58, 239, 208, .12);
  color: var(--accent-bright);
}
.aspect-ratio-picker button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }

.range-field { margin-top: 14px; display: block; }
.range-field > span, .property-fields > label > span {
  margin-bottom: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #9fb0ba;
  font-size: 10px;
}
.range-field b, .property-fields b { color: #f3faf9; font: 600 10px Montserrat, sans-serif; }
input[type="range"] {
  width: 100%;
  height: 16px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  accent-color: var(--accent-bright);
  cursor: pointer;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: #5d6e79;
}
input[type="range"]::-webkit-slider-thumb {
  width: 15px;
  height: 15px;
  margin-top: -4.5px;
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  border-radius: 50%;
  background: var(--accent-bright);
  box-shadow: 0 0 0 1px rgba(16, 32, 38, .35);
}
input[type="range"]::-moz-range-track {
  height: 6px;
  border: 0;
  border-radius: 999px;
  background: #5d6e79;
}
input[type="range"]::-moz-range-thumb {
  width: 15px;
  height: 15px;
  border: 0;
  border-radius: 50%;
  background: var(--accent-bright);
  box-shadow: 0 0 0 1px rgba(16, 32, 38, .35);
}
input[type="range"]:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; border-radius: 3px; }
input[type="range"]:disabled { opacity: .48; cursor: not-allowed; }
.text-button { width: 100%; margin-top: 8px; text-align: left; }

.prompt-form { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--menu-studio-line); }
.prompt-form > label { display: block; margin-bottom: 8px; font-size: 11px; font-weight: 700; }
.reference-upload-field { margin-bottom: 17px; }
.reference-field-head {
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.reference-field-head > div { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.reference-field-head strong { color: #f3faf9; font-size: 11px; }
.reference-field-head span { color: #8fa2ad; font-size: 9px; line-height: 1.45; }
.reference-field-actions { display: inline-flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.reference-field-actions button {
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--accent-bright);
  font-size: 10px;
  font-weight: 700;
}
.reference-field-actions button:hover { color: #c9fff6; }
.reference-field-actions button.remove { color: #ff9da8; }
.reference-field-actions button.remove:hover { color: #ffd9df; }
.reference-upload-button,
.reference-image-summary {
  width: 100%;
  min-height: 62px;
  border: 1px dashed #526574;
  border-radius: 6px;
  background: var(--menu-studio-raised);
}
.reference-upload-button {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: #dbe9e9;
  text-align: left;
}
.reference-upload-button:hover { border-color: var(--accent-bright); background: rgba(58, 239, 208, .07); }
.reference-upload-button:focus-visible,
.reference-image-summary button:focus-visible,
.reference-field-actions button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.reference-upload-button > svg { width: 21px; height: 21px; flex: 0 0 auto; color: var(--accent-bright); }
.reference-upload-button > span { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.reference-upload-button strong { font-size: 11px; }
.reference-upload-button small { color: #8fa2ad; font-size: 9px; }
.reference-image-summary {
  padding: 7px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border-style: solid;
}
.reference-image-summary img { width: 48px; height: 48px; border-radius: 4px; object-fit: cover; }
.reference-image-summary > div { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.reference-image-summary strong { overflow: hidden; color: #f3faf9; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.reference-image-summary span { color: #8fa2ad; font: 9px Montserrat, sans-serif; }
.reference-image-summary button {
  padding: 6px 4px;
  border: 0;
  background: transparent;
  color: var(--accent-bright);
  font-size: 10px;
  font-weight: 700;
}

:global(.reference-library-dialog) {
  max-height: min(820px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #405563;
  border-radius: 10px;
  background: var(--menu-studio);
  box-shadow: 0 24px 70px rgba(6, 17, 24, .42);
}
:global(.reference-library-dialog .el-dialog__header) {
  margin: 0;
  padding: 18px 20px;
  border-bottom: 1px solid var(--menu-studio-line);
}
:global(.reference-library-dialog .el-dialog__headerbtn) { top: 10px; right: 12px; }
:global(.reference-library-dialog .el-dialog__close) { color: #a8babe; }
:global(.reference-library-dialog .el-dialog__close:hover) { color: var(--accent-bright); }
:global(.reference-library-dialog .el-dialog__body) { min-height: 0; padding: 0; overflow: hidden; }
:global(.reference-library-dialog .el-dialog__footer) {
  padding: 14px 20px;
  border-top: 1px solid var(--menu-studio-line);
}
.reference-library-heading { display: flex; flex-direction: column; gap: 4px; padding-right: 36px; }
.reference-library-heading strong { color: #f4fbfa; font-size: 15px; }
.reference-library-heading span { color: #91a6ac; font-size: 11px; }
.reference-library-body { min-height: 280px; max-height: min(64vh, 640px); overflow: auto; padding: 18px 20px; }
.reference-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(142px, 1fr)); gap: 12px; }
.reference-library-card {
  min-width: 0;
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #3c515f;
  border-radius: 7px;
  background: var(--menu-studio-raised);
  color: #edf7f6;
  text-align: left;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease;
}
.reference-library-card:hover:not(:disabled) { border-color: var(--accent-bright); background: #293a45; transform: translateY(-1px); }
.reference-library-card:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.reference-library-card:disabled { cursor: wait; opacity: .62; }
.reference-library-preview { position: relative; display: block; aspect-ratio: 1; overflow: hidden; border-radius: 5px; background: #eef3f2; }
.reference-library-preview img { width: 100%; height: 100%; display: block; object-fit: contain; }
.reference-library-preview > span { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(21, 34, 42, .78); color: #eafffb; font-size: 11px; }
.reference-library-meta { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.reference-library-meta strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.reference-library-meta small { color: #91a6ac; font-size: 9px; }
.reference-library-state { min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #91a6ac; text-align: center; }
.reference-library-state strong { color: #e7f2f1; font-size: 13px; }
.reference-library-state button { min-width: 88px; height: 34px; border: 1px solid #4b6570; border-radius: 5px; background: #263845; color: #eff8f7; cursor: pointer; }
.reference-library-state button:hover { border-color: var(--accent-bright); color: var(--accent-bright); }
.reference-library-state button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.reference-library-state.error strong { color: #ffb4ab; }
.reference-library-spinner { width: 24px; height: 24px; border: 3px solid #526873; border-top-color: var(--accent-bright); border-radius: 50%; animation: reference-library-spin .8s linear infinite; }
.reference-library-footer { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.reference-library-footer button { height: 36px; padding: 0 14px; border-radius: 5px; cursor: pointer; }
.reference-library-secondary { border: 1px solid #4b6570; background: transparent; color: #d8e5e5; }
.reference-library-close { border: 1px solid var(--accent-bright); background: #1d4948; color: #edfffc; }
.reference-library-footer button:hover { border-color: var(--accent-bright); color: var(--accent-bright); }
.reference-library-footer button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
@keyframes reference-library-spin { to { transform: rotate(360deg); } }
.prompt-form textarea, .property-fields textarea {
  width: 100%;
  min-height: 112px;
  padding: 11px;
  resize: none;
  border: 1px solid #526574;
  border-radius: 6px;
  background: var(--menu-studio-raised);
  color: #f3faf9;
  font: 12px/1.65 inherit;
}
.prompt-form textarea::placeholder, .property-fields textarea::placeholder { color: #879aa3; }
.prompt-form textarea:focus, .property-fields textarea:focus { border-color: var(--accent-bright); outline: 2px solid rgba(58, 239, 208, .24); }
.prompt-meta { margin-top: 5px; display: flex; justify-content: space-between; gap: 12px; color: #8fa2ad; font-size: 9px; }
.inline-error {
  margin-top: 10px;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #7b5260;
  border-radius: 5px;
  background: #49303a;
  color: #ffd9df;
  font-size: 10px;
}
.inline-error button { border: 0; background: transparent; color: #ffb0b7; font-weight: 700; }
.generate-button, .enter-editor-button, .export-button, .primary-button {
  min-height: 44px;
  border: 1px solid var(--accent-bright);
  border-radius: 6px;
  background: var(--accent-bright);
  color: #102026;
  font-weight: 600;
}
.generate-button {
  width: 100%;
  margin-top: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
}
.generate-button:hover:not(:disabled), .enter-editor-button:hover:not(:disabled), .export-button:hover:not(:disabled) { background: #76f7e1; border-color: #76f7e1; }
.primary-button:hover:not(:disabled) { background: var(--accent-deep); border-color: var(--accent-deep); }
.generate-button svg { width: 17px; height: 17px; }
.cancel-generate { width: 100%; margin-top: 8px; padding: 7px; border: 0; background: transparent; color: #aebdc7; font-size: 10px; }

.single-canvas-panel { min-width: 0; display: flex; flex-direction: column; background: var(--canvas-work); }
.canvas-panel-head, .square-editor-head {
  min-height: 52px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--menu-studio-line);
  background: var(--menu-studio);
  color: #f3faf9;
}
.canvas-panel-head > div, .square-editor-head > div { display: flex; align-items: center; gap: 8px; }
.canvas-panel-head strong, .square-editor-head strong { font-size: 11px; }
.canvas-panel-head span, .square-editor-head span { color: #9eb0b4; font-size: 10px; }
.live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-bright); box-shadow: 0 0 0 3px rgba(58, 239, 208, .14); }
.canvas-panel-head .result-badge { padding: 5px 8px; border: 1px solid rgba(255, 115, 95, .5); border-radius: 4px; color: #ffc2b9; letter-spacing: .06em; }
.canvas-panel-actions { margin-left: auto; }
.canvas-save-button {
  min-height: 34px;
  padding: 0 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #17877f;
  border-radius: 5px;
  background: #17877f;
  color: #f4fffd;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}
.canvas-save-button:hover:not(:disabled) { border-color: #20a99d; background: #20a99d; }
.canvas-save-button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.canvas-save-button:disabled { opacity: .48; cursor: not-allowed; }
.canvas-panel-head .canvas-save-button span { color: inherit; font-size: inherit; }
.canvas-back-button {
  min-height: 30px;
  margin-left: 8px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #526574;
  border-radius: 5px;
  background: transparent;
  color: #d9e8e6;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.canvas-back-button:hover:not(:disabled) { border-color: var(--accent-bright); color: var(--accent-bright); background: #203b3d; }
.canvas-back-button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.canvas-back-button:disabled { opacity: .48; cursor: not-allowed; }
.canvas-back-button svg { width: 13px; height: 13px; }
.canvas-panel-head .canvas-back-button span { color: inherit; font-size: inherit; }
.canvas-projects-button {
  min-height: 34px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid #526574;
  border-radius: 5px;
  background: var(--menu-studio-2);
  color: #e8f5f3;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}
.canvas-projects-button:hover { border-color: var(--accent-bright); color: var(--accent-bright); background: #203b3d; }
.canvas-projects-button:focus-visible { outline: 2px solid var(--accent-bright); outline-offset: 2px; }
.canvas-projects-button svg { width: 14px; height: 14px; }
.canvas-panel-head .canvas-projects-button span { color: inherit; font-size: inherit; }
.project-count {
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: var(--accent-bright);
  color: #102b2b;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  line-height: 1;
}

.single-canvas-stage {
  min-height: 0;
  flex: 1;
  padding: 28px;
  display: grid;
  place-items: center;
  overflow: auto;
  background-color: var(--canvas-work);
  background-image: radial-gradient(circle, var(--canvas-dot) 1px, transparent 1.2px);
  background-size: 16px 16px;
  background-position: 8px 8px;
  scrollbar-gutter: stable;
}
.single-canvas-stage canvas {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 250px);
  width: auto;
  height: auto;
  background: #fff;
  border: 1px solid rgba(58, 239, 208, .72);
  box-shadow: 0 4px 18px rgba(30, 42, 65, .1);
  cursor: crosshair;
  touch-action: none;
}
.single-canvas-stage.transforming canvas { cursor: grab; }
.single-canvas-stage.transforming canvas:active { cursor: grabbing; }
.canvas-placeholder { max-width: 360px; color: #64747d; text-align: center; }
.placeholder-square {
  width: 104px;
  height: 104px;
  margin: 0 auto 20px;
  display: grid;
  place-items: center;
  border: 1px dashed #8da0aa;
  color: var(--accent-strong);
}
.placeholder-square svg { width: 30px; height: 30px; }
.canvas-placeholder strong { display: block; color: var(--ink); font-size: 14px; }
.canvas-placeholder p { margin: 10px 0 0; color: var(--muted); font-size: 11px; line-height: 1.7; }
.canvas-footer-status {
  min-height: 36px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--menu-studio-line);
  background: var(--menu-studio);
  color: #9fb0ba;
  font-size: 9px;
}

.single-history-panel { display: flex; flex-direction: column; min-height: 0; }
.history-list { flex: 1; min-height: 220px; overflow-y: auto; padding-right: 3px; scrollbar-gutter: stable; }
.history-version { position: relative; }
.history-item {
  width: 100%;
  min-height: 64px;
  margin-bottom: 7px;
  padding: 7px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  border: 1px solid #526574;
  border-radius: 6px;
  background: var(--menu-studio-raised);
  color: #f3faf9;
  text-align: left;
}
.history-item:hover, .history-item.active { border-color: var(--accent-bright); background: #203b3d; box-shadow: inset 3px 0 0 var(--accent-bright); }
.history-item img { width: 48px; height: 48px; display: block; object-fit: cover; border-radius: 3px; background: #edf2f2; }
.history-item > span { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.history-item strong { font-size: 11px; }
.history-item small { overflow: hidden; color: #9fb0ba; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.history-delete {
  position: absolute;
  top: 8px;
  right: 6px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: rgba(73, 48, 58, .96);
  color: #ffd9df;
  opacity: 0;
}
.history-version:hover .history-delete, .history-delete:focus-visible { opacity: 1; }
.history-delete svg { width: 13px; height: 13px; }
.history-empty { min-height: 210px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #9fb0ba; text-align: center; }
.history-empty svg { width: 28px; height: 28px; color: var(--accent-bright); }
.history-empty strong { color: #f3faf9; font-size: 12px; }
.history-empty span { font-size: 10px; line-height: 1.6; }
.enter-editor-block { padding-top: 14px; border-top: 1px solid var(--menu-studio-line); }
.enter-editor-block > span { display: block; margin-bottom: 9px; color: #9fb0ba; font-size: 9px; line-height: 1.5; }
.enter-editor-button { width: 100%; padding: 0 13px; display: flex; align-items: center; justify-content: space-between; text-align: left; }
.enter-editor-button > span { display: flex; flex-direction: column; gap: 2px; font-size: 11px; }
.enter-editor-button small { color: #2f5b56; font-size: 8px; font-weight: 500; }
.enter-editor-button svg { width: 17px; height: 17px; }

.single-projects-page { max-width: 1380px; margin: 0 auto; padding: 38px 34px 72px; }
.single-page-head { margin-bottom: 26px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.single-page-head h1 { margin: 5px 0 7px; font-size: 24px; }
.single-page-head p { margin: 0; color: var(--muted); font-size: 12px; }
.eyebrow { color: var(--accent-strong); font-size: 10px; font-weight: 700; letter-spacing: .1em; }
.primary-button { padding: 0 18px; display: inline-flex; align-items: center; gap: 7px; font-size: 12px; }
.single-projects-page .primary-button { border-color: var(--accent-strong); background: var(--accent-strong); color: #fff; }
.primary-button svg { width: 16px; height: 16px; }
.single-empty-state { min-height: 330px; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border: 1px dashed var(--line); border-radius: 9px; background: #fff; color: var(--muted); text-align: center; font-size: 12px; }
.single-empty-state > svg { width: 40px; height: 40px; color: #9ab9b6; }
.single-empty-state strong { color: var(--ink); font-size: 15px; }
.single-empty-state button { margin-top: 5px; padding: 9px 14px; border: 1px solid var(--accent-strong); border-radius: 5px; background: var(--accent-strong); color: #fff; }
.error-panel { color: var(--danger); }
.single-project-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.single-project-card { overflow: hidden; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.single-project-preview { position: relative; width: 100%; aspect-ratio: 1; padding: 0; display: grid; place-items: center; overflow: hidden; border: 0; border-bottom: 1px solid var(--line); background: #e7eeee; color: var(--muted); }
.single-project-preview img { width: 100%; height: 100%; display: block; object-fit: cover; transition: transform .18s ease; }
.single-project-preview:hover img { transform: scale(1.02); }
.single-project-preview > span { display: flex; flex-direction: column; gap: 8px; align-items: center; font-size: 11px; }
.single-project-preview > span svg { width: 28px; height: 28px; }
.single-project-preview em { position: absolute; right: 10px; bottom: 10px; padding: 5px 7px; border-radius: 4px; background: rgba(25,48,54,.88); color: #fff; font-size: 9px; font-style: normal; }
.single-project-card-body { padding: 14px; }
.single-project-card-body h2 { overflow: hidden; margin: 0; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.single-project-card-body p { margin: 6px 0 3px; color: var(--muted); font-size: 10px; }
.single-project-card-body time { color: #88999e; font-size: 9px; }
.single-project-actions { margin-top: 13px; display: grid; grid-template-columns: 1fr 36px; gap: 7px; }
.single-project-actions button { height: 36px; border-radius: 5px; }
.primary-card-button { border: 1px solid var(--menu); background: var(--menu); color: #fff; }
.danger-icon-button { display: grid; place-items: center; border: 1px solid #e7c6c2; background: #fff; color: var(--danger); }
.danger-icon-button:hover { background: #fff4f3; border-color: #d99a94; }
.danger-icon-button svg { width: 15px; height: 15px; }

.single-editor-page { min-height: calc(100vh - 68px); display: grid; grid-template-columns: 250px minmax(480px, 1fr) 286px; }
.back-to-mask { margin-bottom: 18px; padding: 0; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--accent-deep); font-size: 11px; }
.back-to-mask svg { width: 15px; height: 15px; }
.editor-tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.add-tools { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.undo-row { margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.redo-icon { transform: scaleX(-1); }

.square-editor-stage { min-width: 0; display: flex; flex-direction: column; background: #263439; }
.square-editor-head { border-bottom-color: #3c4d52; }
.square-canvas-wrap { min-height: 0; flex: 1; padding: 28px; display: grid; place-items: center; overflow: auto; scrollbar-gutter: stable; }
.square-canvas-wrap canvas { display: block; width: min(100%, calc(100vh - 252px)); height: auto; aspect-ratio: 1; background: #fff; box-shadow: 0 24px 70px rgba(4,17,20,.38); cursor: default; touch-action: none; }
.square-canvas-wrap.moving canvas { cursor: grab; }
.square-canvas-wrap.moving canvas:active { cursor: grabbing; }
.editor-canvas-tip { min-height: 38px; margin: 0; padding: 10px 20px; border-top: 1px solid #3c4d52; color: #91a6aa; font-size: 9px; text-align: center; }

.layer-properties-panel { display: flex; flex-direction: column; min-height: 0; }
.property-panel-head { min-height: 48px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #dfe8e8; }
.property-panel-head > div { display: flex; flex-direction: column; gap: 3px; }
.property-panel-head span { color: var(--muted); font-size: 9px; }
.property-panel-head strong { font-size: 12px; }
.property-panel-head button { width: 34px; height: 34px; border-radius: 5px; }
.property-fields { padding-top: 16px; overflow-y: auto; }
.property-fields > label { margin-bottom: 15px; display: block; }
.property-fields textarea { min-height: 88px; }
.property-fields input[type="color"] { width: 100%; height: 38px; padding: 4px; border: 1px solid #cad8d9; border-radius: 5px; background: #fff; }
.coordinate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; }
.coordinate-grid label { min-width: 0; }
.coordinate-grid span { display: block; margin-bottom: 5px; color: var(--muted); font-size: 9px; }
.coordinate-grid input { width: 100%; height: 34px; padding: 0 8px; border: 1px solid #cad8d9; border-radius: 5px; background: #fff; color: var(--ink); }
.layer-order-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.layer-order-actions button { height: 34px; border: 1px solid #cad8d9; border-radius: 5px; background: #fff; color: #51676e; font-size: 10px; }
.property-empty { flex: 1; min-height: 260px; padding: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--muted); text-align: center; }
.property-empty svg { width: 28px; height: 28px; color: #9ab9b6; }
.property-empty strong { color: var(--ink); font-size: 12px; }
.property-empty span { font-size: 10px; line-height: 1.6; }
.export-panel { margin-top: auto; padding-top: 16px; border-top: 1px solid #dfe8e8; }
.export-panel > div { margin-bottom: 10px; display: flex; flex-direction: column; gap: 3px; }
.export-panel span { color: var(--muted); font-size: 9px; }
.export-panel strong { font: 600 12px Montserrat, sans-serif; }
.export-panel small { color: #72858b; font-size: 9px; }
.export-button { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 7px; font-size: 11px; }
.export-button svg { width: 16px; height: 16px; }

@media (max-width: 1180px) {
  .single-crop-page { grid-template-columns: 270px minmax(390px, 1fr) 244px; }
  .single-crop-controls, .crop-flow-panel { padding: 18px; }
  .single-workspace { grid-template-columns: 258px minmax(370px, 1fr) 246px; }
  .single-editor-page { grid-template-columns: 224px minmax(420px, 1fr) 258px; }
  .single-control-panel, .single-history-panel, .editor-tools-panel, .layer-properties-panel { padding: 18px; }
  .single-project-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 900px) {
  .single-crop-page, .single-workspace, .single-editor-page { display: block; }
  .single-crop-controls, .crop-flow-panel { border: 0; border-bottom: 1px solid var(--menu-studio-line); }
  .single-control-panel, .single-history-panel, .editor-tools-panel, .layer-properties-panel { border: 0; border-bottom: 1px solid var(--menu-studio-line); }
  .single-canvas-panel, .square-editor-stage { min-height: 680px; }
  .crop-canvas-panel { min-height: 680px; }
  .single-canvas-stage canvas { max-height: 580px; }
  .single-history-panel { min-height: 380px; }
  .history-list { max-height: 320px; }
  .single-project-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .square-canvas-wrap canvas { width: min(100%, 620px); }
}

@media (max-width: 560px) {
  .single-crop-controls, .crop-flow-panel, .single-control-panel, .single-history-panel, .editor-tools-panel, .layer-properties-panel { padding: 16px; }
  .single-canvas-stage, .square-canvas-wrap { padding: 14px; }
  .single-canvas-panel, .square-editor-stage { min-height: 520px; }
  .generate-canvas-head { min-height: auto; padding: 9px 14px; flex-wrap: wrap; }
  .crop-canvas-panel .canvas-panel-head { min-height: auto; padding: 9px 14px; flex-wrap: wrap; }
  .crop-canvas-panel .canvas-panel-actions { width: 100%; flex-wrap: wrap; justify-content: flex-start; }
  .generate-canvas-head .canvas-status-group { width: 100%; flex-wrap: wrap; }
  .generate-canvas-head .canvas-back-button { margin-left: auto; }
  .generate-canvas-head .canvas-panel-actions { width: 100%; flex-wrap: wrap; justify-content: flex-end; }
  .single-page-head { align-items: stretch; flex-direction: column; }
  .single-projects-page { padding: 28px 16px 50px; }
  .single-project-grid { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .single-upload-zone, .single-project-preview img, .reference-library-card { transition: none; }
  .reference-library-spinner { animation: none; }
}
</style>
