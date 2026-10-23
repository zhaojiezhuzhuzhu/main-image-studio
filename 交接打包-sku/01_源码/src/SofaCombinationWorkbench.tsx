import { InputDetails, InputImage } from './WorkbenchInputCards';
import { inputImageIcon } from './ui/inputImageIcons';
import { templateDraftSlot, TEMPLATES } from './domain/templates';
import { ChangeEvent, useEffect, useRef, useState, type SetStateAction, type CSSProperties } from 'react';
import { exportCanvasJpg, isDesktop, registerDesktopFlush } from './desktop/runtime';
import { annotationFromProduct, adjustAnnotatedProduct, previewAnnotatedProduct, adjustAnnotatedProductAroundObstacles, annotatedProductCollisionRects, fitAnnotatedProduct, pointFromProduct, pointHitsProductSilhouette, pointRelativeToProduct, type MeasuredDimensionAnnotation, type ProductSilhouette, type SubjectAdjustment } from './domain/annotatedProductFit';
import { completeDimension, dimensionTask, type DimensionAnnotation, type DimensionKind, nextDimension, updateAnnotationValues } from './domain/dimensionAnnotations';
import { getDimensionGeometry, type Point, type Rect } from './domain/dimensionGeometry';
import { getDimensionStyleGeometry } from './domain/dimensionStyle';
import { dimensionFieldsFromDimensions, dimensionsFromFields, formatDimensionFields, parseDimensions, type DimensionFields } from './domain/dimensions';
import { resolveModelOnUpload } from './domain/modelFromFilename';
import type { SofaCombinationKind } from './domain/sofaCombinationLayout';
import { COMBINATION_TEMPLATE_RULES, type CombinationTemplateId } from './templates/registry';
import type { CombinationTemplateRules, CombinationTemplateOptions, FeaturePlacement } from './templates/types';
import { CanvasSellingPointEditor } from './CanvasSellingPointEditor';
import { applyTemplateSellingPointFont } from './templates/drawing';
import { canvasFontFromPs } from './domain/typography';
import { clearDraft, hasDraftContent, loadDraft, loadRecoveryHistory, saveDraft, type SofaCombinationDraft } from './storage/draftStorage';
import { productImageFromBlob, type ProductImage } from './project/productImage';
import { useImageImport } from './project/useImageImport';
import { projectDraftSlot } from './project/projectFile';
import { useProjectFile, type ProjectLaunch } from './project/useProjectFile';
import { useUndoHistory } from './history/useUndoHistory';
import { useCanvasFonts } from './project/useCanvasFonts';
import { CombinationObjectPanel, WorkbenchHeader, WorkbenchSidebar, type CombinationObjectItem } from './WorkbenchChrome';
import { CanvasStage } from './CanvasStage';
import { CanvasModelEditor } from './CanvasModelEditor';
import { FilenameNameNotice } from './FilenameNameNotice';
import { DimensionInspector, DIMENSION_KINDS, DIMENSION_LABELS } from './DimensionInspector';
import { hitTestDimension, type DimensionHitTarget } from './domain/dimensionHitTest';
import { CanvasDimensionEditor, DimensionEditMode } from './CanvasDimensionEditor';
import { DimensionLinkControls } from './DimensionLinkControls';
import { DimensionLabelControls } from './DimensionLabelControls';
import type { DimensionLabelAdjustment } from './domain/dimensionAnnotations';
import { useDimensionEditing } from './useDimensionEditing';
import { useShiftKey } from './useShiftKey';
import { changeDimensionLink, dimensionExtensionPoint, snapDimensionPoint } from './domain/dimensionEditing';

const CANVAS_SIZE = 1440;
const DEFAULT_ADJUSTMENT: SubjectAdjustment = { scale: 1, offsetX: 0, offsetY: 0 };
const EMPTY_DIMENSIONS: DimensionFields = { length: '', width: '', height: '' };

function hasAdjustment(adjustment: SubjectAdjustment | undefined) {
  const value = adjustment ?? DEFAULT_ADJUSTMENT;
  return Math.abs(value.scale - 1) > .0001 || Math.abs(value.offsetX) > .01 || Math.abs(value.offsetY) > .01;
}

type OptionalSize = {
  id: string;
  sizeInput: string;
  dimensionFields: DimensionFields;
  annotations: DimensionAnnotation[];
  adjustment: SubjectAdjustment;
  image?: ProductImage;
};
type CombinationHistoryState = {
  kind: SofaCombinationKind;
  model: string;
  modelManuallyEdited: boolean;
  sizeInput: string;
  dimensionFields: DimensionFields;
  annotations: DimensionAnnotation[];
  subjectAdjustment: SubjectAdjustment;
  mainImage?: ProductImage;
  optionalSizes: OptionalSize[];
  labelEnabled: boolean;
  labelOffsetY: number;
  labelSide: OptionalLabelSide;
  noteEnabled: boolean;
  note: string;
  options: CombinationTemplateOptions;
};
type OptionalMarkTask = { id: string; kind: DimensionKind };
type CanvasSelection = { type: 'product'; id: string } | { type: 'dimensions'; id: string; kind: DimensionKind } | { type: 'label' } | { type: 'feature' };
type OptionalLabelSide = 'left' | 'right';
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
type MicroInteraction =
  | { mode: 'move'; target: 'main' | string; start: Point; adjustment: SubjectAdjustment }
  | { mode: 'scale'; target: 'main' | string; anchor: Point; anchorBase: Point; startDistance: number; adjustment: SubjectAdjustment }
  | { mode: 'feature'; start: Point; feature: FeaturePlacement }
  | { mode: 'label'; startY: number; offsetY: number };


function fitImage(image: ProductImage, area: Rect): Rect {
  const scale = Math.min(area.width / image.visible.width, area.height / image.visible.height);
  const width = image.visible.width * scale;
  const height = image.visible.height * scale;
  return { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
}

function drawProduct(context: CanvasRenderingContext2D, image: ProductImage, target: Rect) {
  const source = image.visible;
  context.drawImage(image.element, source.x, source.y, source.width, source.height, target.x, target.y, target.width, target.height);
}

function measureDimensionLabel(context: CanvasRenderingContext2D, text: string, rules: CombinationTemplateRules) {
  const lines = text.split('\n');
  const metrics = lines.map((line) => context.measureText(line));
  const lineHeight = Math.max(...metrics.map((metric) => metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent || rules.dimensionFontSize));
  return { lines, width: Math.max(...metrics.map((metric) => metric.width)), lineHeight, height: lineHeight * lines.length + rules.dimensionLineGap * (lines.length - 1) };
}

function drawDimension(context: CanvasRenderingContext2D, annotation: DimensionAnnotation, productRect: Rect, text: string, rules: CombinationTemplateRules) {
  context.font = rules.dimensionFont;
  const metrics = measureDimensionLabel(context, text, rules);
  const textHeight = metrics.height;
  const geometry = getDimensionGeometry(annotation.from, annotation.to, text, productRect, { width: metrics.width, height: textHeight }, annotation.labelOffset);
  const labelColor = annotation.labelColor === 'white' ? '#ffffff' : annotation.labelColor === 'dark' ? '#000000' : rules.dimensionColor;
  const style = getDimensionStyleGeometry(annotation.from, annotation.to, annotation.kind, rules.lineStyle, annotation.extensionOffsets);
  context.save();
  context.strokeStyle = style.color; context.fillStyle = style.color; context.lineWidth = style.lineWidth;
  context.lineCap = 'butt'; context.lineJoin = 'miter';
  context.beginPath(); context.moveTo(style.line.from.x, style.line.from.y); context.lineTo(style.line.to.x, style.line.to.y); context.stroke();
  context.beginPath();
  style.extensions.flat().forEach((segment) => { context.moveTo(segment.from.x, segment.from.y); context.lineTo(segment.to.x, segment.to.y); });
  context.stroke();
  style.arrows.forEach((arrow) => {
    context.beginPath(); context.moveTo(arrow.tip.x, arrow.tip.y);
    context.lineTo(arrow.corners[0].x, arrow.corners[0].y); context.lineTo(arrow.corners[1].x, arrow.corners[1].y);
    context.closePath(); context.fill();
  });
  context.restore();
  context.font = rules.dimensionFont; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = labelColor;
  metrics.lines.forEach((line, index) => context.fillText(line, geometry.label.x, geometry.label.y + (index - (metrics.lines.length - 1) / 2) * (metrics.lineHeight + rules.dimensionLineGap)));
  context.textAlign = 'start'; context.textBaseline = 'alphabetic';
  return { kind: annotation.kind, from: annotation.from, to: annotation.to, labelColor, extensions: { from: dimensionExtensionPoint(annotation, 'from', productRect), to: dimensionExtensionPoint(annotation, 'to', productRect) }, label: { x: geometry.label.x - metrics.width / 2, y: geometry.label.y - textHeight / 2, width: metrics.width, height: textHeight } };
}

function sameRect(left: Rect | undefined, right: Rect) {
  return Boolean(left) && Math.abs(left!.x - right.x) < .01 && Math.abs(left!.y - right.y) < .01
    && Math.abs(left!.width - right.width) < .01 && Math.abs(left!.height - right.height) < .01;
}

function rectCorner(rect: Rect, corner: ResizeCorner): Point {
  return { x: corner.endsWith('w') ? rect.x : rect.x + rect.width, y: corner.startsWith('n') ? rect.y : rect.y + rect.height };
}

const oppositeCorner = (corner: ResizeCorner): ResizeCorner => ({ nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' } as const)[corner];

export function SofaCombinationWorkbench({ onBack, initialProject, initialDraftSlot, templateId = 'sofa-combination' }: { onBack: () => void; initialProject?: ProjectLaunch<SofaCombinationDraft>; initialDraftSlot?: string; templateId?: CombinationTemplateId }) {
  const rules = COMBINATION_TEMPLATE_RULES[templateId];
  const precision = rules.precision;
  const dimensionText = rules.dimensionText;
  const MODEL_FONT = canvasFontFromPs(rules.model.fontSize, rules.model.fontFamily);
  const NOTE_FONT = rules.note.font;
  const DEFAULT_NOTE = rules.note.defaultText;
  const OptionsEditor = rules.OptionsEditor;
  const KindEditor = rules.KindEditor;
  const FeatureEditor = rules.feature?.Editor;
  const FeatureInspector = rules.feature?.Inspector;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputs = useRef(new Map<string, HTMLInputElement>());
  const dimensionTargets = useRef<DimensionHitTarget[]>([]);
  const [selection, setSelection] = useState<CanvasSelection>();
  const displayedProductRect = useRef<Rect>(rules.layout(0, 'standard').mainProductArea);
  const optionalProductRects = useRef<Record<string, Rect>>({});
  const optionalAutoScenes = useRef<Record<string, { productRect: Rect; annotations: MeasuredDimensionAnnotation[]; safeArea: Rect; obstacles: Rect[]; silhouette?: ProductSilhouette }>>({});
  const optionalLabelRect = useRef<Rect | undefined>(undefined);
  const [featureBounds, setFeatureBounds] = useState<Rect>();
  const [options, setOptions] = useState(rules.createOptions);
  const { feature: featureValue, sellingPoints } = options;
  const setFeatureValue = (change: SetStateAction<FeaturePlacement>) => setOptions((current) => ({ ...current, feature: typeof change === 'function' ? change(current.feature) : change }));
  const setSellingPoints = (change: SetStateAction<string[]>) => setOptions((current) => ({ ...current, sellingPoints: typeof change === 'function' ? change(current.sellingPoints) : change }));
  const [featureEditing, setFeatureEditing] = useState(false);
  const autoScene = useRef<{ productRect: Rect; annotations: MeasuredDimensionAnnotation[]; safeArea: Rect; obstacles: Rect[]; silhouette?: ProductSilhouette } | undefined>(undefined);
  const appliedAdjustment = useRef<SubjectAdjustment>(DEFAULT_ADJUSTMENT);
  const microInteraction = useRef<MicroInteraction | undefined>(undefined);
  const suppressCanvasClick = useRef(false);
  const manuallyEditedModel = useRef(false);
  const draftReady = useRef(false);
  const skipNextSave = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const draftGeneration = useRef(0);
  const [model, setModel] = useState('');
  const [modelEditing, setModelEditing] = useState(false);
  const [modelBadge, setModelBadge] = useState<Rect>(() => ({ ...rules.layout(0, 'standard').modelBadge, width: 0 }));
  const imageImport = useImageImport();
  const [kind, setKind] = useState<SofaCombinationKind>('standard');
  const [sizeInput, setSizeInput] = useState('');
  const [dimensionFields, setDimensionFields] = useState<DimensionFields>(EMPTY_DIMENSIONS);
  const [annotations, setAnnotations] = useState<DimensionAnnotation[]>([]);
  const [mainImage, setMainImage] = useState<ProductImage>();
  const [optionalSizes, setOptionalSizes] = useState<OptionalSize[]>([]);
  const [optionalMarkTask, setOptionalMarkTask] = useState<OptionalMarkTask>();
  const [optionalDraftStart, setOptionalDraftStart] = useState<Point>();
  const [optionalHoverPoint, setOptionalHoverPoint] = useState<Point>();
  const [labelOffsetY, setLabelOffsetY] = useState(0);
  const [labelSide, setLabelSide] = useState<OptionalLabelSide>('left');
  const [labelEnabled, setLabelEnabled] = useState(true);
  const [labelSelected, setLabelSelected] = useState(false);
  const [noteEnabled, setNoteEnabled] = useState(true);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [noteEditing, setNoteEditing] = useState(false);
  const [sellingPointBoxes, setSellingPointBoxes] = useState<Rect[]>([]);
  const [sellingPointEditing, setSellingPointEditing] = useState(false);
  const showSellingPoints = rules.sellingPoints?.visible(optionalSizes.length) ?? false;
  const labelState = rules.labelState({ count: optionalSizes.length, enabled: labelEnabled, side: labelSide, offsetY: labelOffsetY, noteEnabled });
  const { showLabel, showNote, side: effectiveLabelSide, offsetY: effectiveLabelOffsetY } = labelState;
  const objectGap = rules.objectGap;
  const getLayout = () => rules.layout(optionalSizes.length, kind);
  const [draftStart, setDraftStart] = useState<Point>();
  const shiftPressed = useShiftKey();
  const [hoverPoint, setHoverPoint] = useState<Point>();
  const [reannotateKind, setReannotateKind] = useState<DimensionKind>();
  const [subjectAdjustment, setSubjectAdjustment] = useState<SubjectAdjustment>(DEFAULT_ADJUSTMENT);
  const requestedPreview = useRef<{ target: string; adjustment: SubjectAdjustment } | undefined>(undefined);
  const [productPreview, setProductPreview] = useState<{ target: string; adjustment: SubjectAdjustment }>();
  const [microAdjust, setMicroAdjust] = useState(false);
  const [optionalMicroId, setOptionalMicroId] = useState<string>();
  const [microProductRect, setMicroProductRect] = useState<Rect>();
  const [microGroupBounds, setMicroGroupBounds] = useState<Rect>();
  const [microConstraintHint, setMicroConstraintHint] = useState('');
  const [draftStatus, setDraftStatus] = useState('正在恢复组合现场…');
  const [draftSlot, setDraftSlot] = useState(initialProject ? projectDraftSlot('combination', initialProject.projectId) : initialDraftSlot ?? templateDraftSlot(templateId));
  const [layoutIssues, setLayoutIssues] = useState<string[]>([]);
  const canvasFonts = useCanvasFonts(rules.requiredFonts);
  const dimensions = dimensionsFromFields(dimensionFields, precision);
  const unmarkedKinds = DIMENSION_KINDS.filter((dimensionKind) => !annotations.some((annotation) => annotation.kind === dimensionKind));
  const activeTask = reannotateKind ? dimensionTask(dimensions, reannotateKind) : null;
  const dimensionEditor = useDimensionEditing(canvasRef, (ownerId, change) => {
    if (ownerId === 'main') {
      history.commit({ ...currentHistoryState(), annotations: change.annotations, subjectAdjustment: change.adjustment });
      setAnnotations(change.annotations); setSubjectAdjustment(change.adjustment);
    } else {
      const next = optionalSizes.map((item) => item.id === ownerId ? { ...item, annotations: change.annotations, adjustment: change.adjustment } : item);
      history.commit({ ...currentHistoryState(), optionalSizes: next, subjectAdjustment: appliedAdjustment.current });
      setOptionalSizes(next); setSubjectAdjustment(appliedAdjustment.current);
    }
  }, changeDimensionLabel);

  function changeDimensionLabel(target: DimensionHitTarget, changes: DimensionLabelAdjustment) {
    const current = target.ownerId === 'main' ? annotations : optionalSizes.find((item) => item.id === target.ownerId)?.annotations;
    if (!current) return;
    const nextAnnotations = current.map((item) => item.kind === target.kind ? { ...item, ...changes } : item);
    if (JSON.stringify(nextAnnotations) === JSON.stringify(current)) return;
    if (target.ownerId === 'main') {
      history.commit({ ...currentHistoryState(), annotations: nextAnnotations }); setAnnotations(nextAnnotations);
    } else {
      const next = optionalSizes.map((item) => item.id === target.ownerId ? { ...item, annotations: nextAnnotations } : item);
      history.commit({ ...currentHistoryState(), optionalSizes: next }); setOptionalSizes(next);
    }
  }

  function currentDraft(): SofaCombinationDraft {
    return {
      version: 1, templateId, kind, model, modelManuallyEdited: manuallyEditedModel.current, sizeInput, dimensionFields, annotations, subjectAdjustment,
      mainImage: mainImage ? { name: mainImage.name, blob: mainImage.blob } : undefined,
      optionalSizes: optionalSizes.map((item) => ({
        id: item.id,
        sizeInput: item.sizeInput,
        dimensionFields: item.dimensionFields,
        annotations: item.annotations,
        adjustment: item.adjustment ?? DEFAULT_ADJUSTMENT,
        image: item.image ? { name: item.image.name, blob: item.image.blob } : undefined,
      })),
      optionalLabelEnabled: showLabel, optionalLabelOffsetY: effectiveLabelOffsetY, optionalLabelSide: effectiveLabelSide, noteEnabled, note,
      ...rules.saveOptions(options),
    };
  }

  function currentHistoryState(): CombinationHistoryState {
    return {
      kind,
      model,
      modelManuallyEdited: manuallyEditedModel.current,
      sizeInput,
      dimensionFields,
      annotations,
      subjectAdjustment,
      mainImage,
      optionalSizes,
      labelEnabled,
      labelOffsetY,
      labelSide,
      noteEnabled,
      note,
      options,
    };
  }

  function applyHistoryState(state: CombinationHistoryState) {
    cancelMicroAdjustment();
    dimensionEditor.clear();
    setSelection(undefined);
    manuallyEditedModel.current = state.modelManuallyEdited;
    setKind(state.kind);
    setModel(state.model);
    setSizeInput(state.sizeInput);
    setDimensionFields(state.dimensionFields);
    setAnnotations(state.annotations);
    setSubjectAdjustment(state.subjectAdjustment);
    appliedAdjustment.current = state.subjectAdjustment;
    setMainImage(state.mainImage);
    setOptionalSizes(state.optionalSizes);
    setLabelEnabled(state.labelEnabled);
    setLabelOffsetY(state.labelOffsetY);
    setLabelSide(state.labelSide);
    setNoteEnabled(state.noteEnabled);
    setNote(state.note);
    setOptions(state.options);
    setFeatureEditing(false);
    setSellingPointEditing(false);
    setOptionalMarkTask(undefined);
    setOptionalDraftStart(undefined);
    setOptionalHoverPoint(undefined);
    setDraftStart(undefined);
    setHoverPoint(undefined);
    setReannotateKind(undefined);
    setMicroAdjust(false);
    setOptionalMicroId(undefined);
    setLabelSelected(false);
    setMicroConstraintHint('');
    microInteraction.current = undefined;
  }

  async function applyProjectDraft(draft: SofaCombinationDraft, recoveryDrafts: SofaCombinationDraft[] = []) {
    imageImport.cancel();
    const [restoredMain, ...restoredOptions] = await Promise.all([
      draft.mainImage ? productImageFromBlob(draft.mainImage.blob, draft.mainImage.name) : undefined,
      ...draft.optionalSizes.map((item) => item.image ? productImageFromBlob(item.image.blob, item.image.name) : undefined),
    ]);
    const currentImages = new Map(draft.optionalSizes.map((item, index) => [item.id, restoredOptions[index]]));
    const toState = (value: SofaCombinationDraft): CombinationHistoryState => ({
      kind: value.kind ?? 'standard',
      model: value.model,
      modelManuallyEdited: value.modelManuallyEdited,
      sizeInput: value.sizeInput,
      dimensionFields: value.dimensionFields,
      annotations: value.annotations,
      subjectAdjustment: value.subjectAdjustment,
      mainImage: value.mainImage ? restoredMain : undefined,
      optionalSizes: value.optionalSizes.map((item) => {
        const legacySize = (item as typeof item & { size?: string }).size ?? '';
        const sizeInputValue = item.sizeInput ?? legacySize;
        const parsed = parseDimensions(sizeInputValue);
        return {
          id: item.id,
          sizeInput: sizeInputValue,
          dimensionFields: item.dimensionFields ?? (parsed ? dimensionFieldsFromDimensions(parsed) : EMPTY_DIMENSIONS),
          annotations: item.annotations ?? [],
          adjustment: item.adjustment ?? DEFAULT_ADJUSTMENT,
          image: item.image ? currentImages.get(item.id) : undefined,
        };
      }),
      labelEnabled: value.optionalLabelEnabled ?? true,
      labelOffsetY: value.optionalLabelOffsetY,
      labelSide: value.optionalLabelSide ?? 'left',
      noteEnabled: value.noteEnabled,
      note: value.note,
      options: rules.restoreOptions(value),
    });
    const state = toState(draft);
    applyHistoryState(state);
    imageImport.cancel();
    if (recoveryDrafts.length) history.seed(recoveryDrafts.map(toState), state);
    else history.reset(state);
  }

  const history = useUndoHistory({
    enabled: draftReady.current,
    value: currentHistoryState(),
    apply: applyHistoryState,
    limit: 30,
  });
  const project = useProjectFile({
    kind: 'combination',
    templateId,
    enabled: draftReady.current,
    draft: currentDraft(),
    initialProject,
    onOpen: async (draft, projectId) => {
      const slot = projectDraftSlot('combination', projectId);
      draftGeneration.current += 1;
      await saveQueue.current;
      if (!draftSlot.startsWith('project:')) await saveDraft(currentDraft(), draftSlot);
      skipNextSave.current = true;
      setDraftSlot(slot);
      const recovery = await loadRecoveryHistory(slot, draft);
      await applyProjectDraft(draft, recovery);
      setDraftStatus('已打开独立组合项目现场');
    },
    onProjectIdChange: async (projectId) => {
      const slot = projectDraftSlot('combination', projectId);
      if (slot === draftSlot) return;
      draftGeneration.current += 1;
      setDraftSlot(slot);
      await saveQueue.current;
      await saveDraft(currentDraft(), slot);
      if (!draftSlot.startsWith('project:')) await clearDraft(draftSlot);
    },
  });

  useEffect(() => {
    let cancelled = false;
    const initialDraft = initialProject?.draft;
    const loading = initialDraft ? Promise.resolve(initialDraft) : loadDraft(draftSlot) as Promise<SofaCombinationDraft | null>;
    loading.then(async (draft) => {
      if (cancelled) return;
      if (!draft) { draftReady.current = true; setDraftStatus('填写内容后自动保留现场'); return; }
      const recovery = await loadRecoveryHistory(draftSlot, draft);
      await applyProjectDraft(draft, recovery);
      if (cancelled) return;
      draftReady.current = true; setDraftStatus(initialDraft ? '已打开独立组合项目现场' : '已恢复上次组合现场');
    }).catch(() => { if (!cancelled) { draftReady.current = true; setDraftStatus('组合现场恢复失败，新修改仍会自动保存'); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const generation = draftGeneration.current;
    const timer = window.setTimeout(() => {
      const snapshot = currentDraft();
      setDraftStatus('正在自动保存组合现场…');
      saveQueue.current = saveQueue.current
        .then(() => generation === draftGeneration.current ? saveDraft(snapshot, draftSlot) : undefined)
        .then(() => { if (generation === draftGeneration.current) setDraftStatus(hasDraftContent(snapshot) ? '组合现场已自动保存' : '空白现场不保留缓存'); })
        .catch(() => { if (generation === draftGeneration.current) setDraftStatus('自动保存失败，请保留当前页面'); });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [kind, model, sizeInput, dimensionFields, annotations, subjectAdjustment, mainImage, optionalSizes, labelOffsetY, labelSide, labelEnabled, noteEnabled, note, options, draftSlot]);

  useEffect(() => {
    const canvas = canvasRef.current; const context = canvas?.getContext('2d'); if (!canvas || !context) return;
    context.fillStyle = '#fff'; context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const layout = getLayout();
    context.font = MODEL_FONT;
    const modelText = model || '产品型号'; const modelWidth = context.measureText(modelText).width + rules.model.paddingX * 2;
    const badge = { ...layout.modelBadge, width: modelWidth };
    setModelBadge((current) => sameRect(current, badge) ? current : badge);
    const nextLayoutIssues: string[] = [];
    const modelIssue = rules.modelWidthIssue(modelWidth);
    if (modelIssue) nextLayoutIssues.push(modelIssue);
    context.fillStyle = rules.model.background; context.beginPath(); context.roundRect(layout.modelBadge.x, layout.modelBadge.y, modelWidth, layout.modelBadge.height, rules.model.radius); context.fill();
    context.fillStyle = rules.model.color; context.fillText(modelText, layout.modelBadge.x + rules.model.paddingX, layout.modelBadge.y + rules.model.textY);

    const labelBaseY = effectiveLabelSide === 'right' ? layout.optionalLabelRightY : layout.optionalLabel.y;
    const label = {
      ...layout.optionalLabel,
      x: effectiveLabelSide === 'right' ? CANVAS_SIZE - layout.sideMargin - layout.optionalLabel.width : layout.optionalLabel.x,
      y: labelBaseY + effectiveLabelOffsetY,
    };
    optionalLabelRect.current = showLabel && rules.optionalLabel.movable ? label : undefined;
    context.font = rules.feature?.font ?? NOTE_FONT;
    const featureTextWidth = context.measureText(featureValue.text).width;
    const feature = rules.feature && featureValue.enabled ? rules.feature.bounds(featureValue, featureTextWidth, optionalSizes.length) : undefined;
    setFeatureBounds((current) => feature ? sameRect(current, feature) ? current : feature : undefined);
    if (feature) nextLayoutIssues.push(...rules.feature!.issues(featureValue, featureTextWidth));
    const templateObstacles: Rect[] = [
      { ...layout.modelBadge, width: modelWidth },
      ...(showLabel ? [label] : []),
      // 功能说明随用户拖动定位，不反向挤压主产品的自动排版。
    ];
    const optionalScenes = optionalSizes.map((item, index) => {
      const group = layout.optionalGroups[index];
      // 自动排版仍按规格分区；手动标注可利用上方空白，并由实际对象限制重叠。
      const movementArea = rules.optionalMovementArea(group, layout);
      const itemDimensions = dimensionsFromFields(item.dimensionFields, precision);
      const baseRect = item.image
        ? fitImage(item.image, { x: group.x + 18, y: group.y + 18, width: group.width - 36, height: group.height - 36 })
        : { x: group.x + group.width * .15, y: group.y + group.height * .2, width: group.width * .7, height: group.height * .6 };
      const currentItemAnnotations = updateAnnotationValues(rules.annotations(item.annotations, itemDimensions), itemDimensions);
      const absoluteAnnotations = currentItemAnnotations.map((annotation) => annotationFromProduct(annotation, item.adjustment.dimensionFrame ?? baseRect));
      context.font = rules.dimensionFont;
      const measuredItemAnnotations = absoluteAnnotations.map((annotation) => {
        const metrics = measureDimensionLabel(context, dimensionText(annotation, item.dimensionFields), rules);
        return { annotation, labelSize: { width: metrics.width, height: metrics.height } };
      });
      const fittedGroup = fitAnnotatedProduct(baseRect, measuredItemAnnotations, group, item.adjustment.dimensionFrame);
      const fittedMeasured = fittedGroup.annotations.map((annotation, annotationIndex) => ({
        annotation,
        labelSize: measuredItemAnnotations[annotationIndex].labelSize,
      }));
      const settledGroup = adjustAnnotatedProduct(fittedGroup.productRect, fittedMeasured, movementArea, item.adjustment ?? DEFAULT_ADJUSTMENT);
      const adjustedGroup = productPreview?.target === item.id
        ? previewAnnotatedProduct(fittedGroup.productRect, fittedMeasured, productPreview.adjustment) : settledGroup;
      return {
        item,
        group,
        movementArea,
        itemDimensions,
        originalProductRect: baseRect,
        baseProductRect: fittedGroup.productRect,
        baseMeasured: fittedMeasured,
        settledProductRect: settledGroup.productRect,
        settledMeasured: settledGroup.annotations.map((annotation, i) => ({ annotation, labelSize: fittedMeasured[i].labelSize })),
        productRect: adjustedGroup.productRect,
        annotations: adjustedGroup.annotations,
        measured: adjustedGroup.annotations.map((annotation, annotationIndex) => ({ annotation, labelSize: fittedMeasured[annotationIndex].labelSize })),
        bounds: adjustedGroup.bounds,
      };
    });

    let baseProductRect = layout.mainProductArea;
    if (mainImage) baseProductRect = fitImage(mainImage, layout.mainProductArea);
    const currentAnnotations = updateAnnotationValues(rules.annotations(annotations, dimensions), dimensions);
    const baseAnnotations = currentAnnotations.map((annotation) => annotationFromProduct(annotation, subjectAdjustment.dimensionFrame ?? baseProductRect));
    context.font = rules.dimensionFont;
    const measured = baseAnnotations.map((annotation) => {
      const metrics = measureDimensionLabel(context, dimensionText(annotation, dimensionFields), rules);
      return { annotation, labelSize: { width: metrics.width, height: metrics.height } };
    });
    const fitted = fitAnnotatedProduct(baseProductRect, measured, layout.mainSubjectSafeArea, subjectAdjustment.dimensionFrame);
    const fittedMeasured = fitted.annotations.map((annotation, index) => ({ annotation, labelSize: measured[index].labelSize }));
    const obstacles: Rect[] = [
      ...templateObstacles,
      ...optionalScenes.flatMap((scene) => scene.item.image
        ? annotatedProductCollisionRects(scene.settledProductRect, scene.settledMeasured, scene.item.image.silhouette)
        : [scene.group]),
    ];
    const adjusted = productPreview?.target === 'main' ? previewAnnotatedProduct(fitted.productRect, fittedMeasured, productPreview.adjustment) : adjustAnnotatedProductAroundObstacles(
      fitted.productRect,
      fittedMeasured,
      layout.mainMovementArea,
      obstacles,
      objectGap,
      subjectAdjustment,
      mainImage?.silhouette,
    );
    displayedProductRect.current = adjusted.productRect; appliedAdjustment.current = adjusted.adjustment;
    autoScene.current = { productRect: fitted.productRect, annotations: fittedMeasured, safeArea: layout.mainMovementArea, obstacles, silhouette: mainImage?.silhouette };
    setMicroProductRect((current) => sameRect(current, adjusted.productRect) ? current : adjusted.productRect);
    setMicroGroupBounds((current) => sameRect(current, adjusted.bounds) ? current : adjusted.bounds);
    if (mainImage) drawProduct(context, mainImage, adjusted.productRect);
    dimensionEditor.scenes.current = { main: {
      productRect: adjusted.productRect, baseProductRect, adjustment: adjusted.adjustment, fitArea: layout.mainSubjectSafeArea, safeArea: layout.mainMovementArea, obstacles, minimumGap: objectGap, silhouette: mainImage?.silhouette,
      annotations: adjusted.annotations.map((annotation, index) => ({ annotation, labelSize: measured[index].labelSize })),
    } };
    dimensionTargets.current = adjusted.annotations.filter((annotation) => annotation.kind !== reannotateKind)
      .map((annotation) => ({ ...drawDimension(context, dimensionEditor.display('main', annotation), subjectAdjustment.dimensionFrame ?? adjusted.productRect, dimensionText(annotation, dimensionFields), rules), ownerId: 'main' }));
    if (draftStart && hoverPoint && activeTask) drawDimension(context, { ...activeTask, from: pointFromProduct(draftStart, subjectAdjustment.dimensionFrame ?? adjusted.productRect), to: snapDimensionPoint(pointFromProduct(draftStart, subjectAdjustment.dimensionFrame ?? adjusted.productRect), pointFromProduct(hoverPoint, subjectAdjustment.dimensionFrame ?? adjusted.productRect), shiftPressed) }, subjectAdjustment.dimensionFrame ?? adjusted.productRect, dimensionText(activeTask, dimensionFields), rules);

    if (showLabel) {
      context.font = rules.optionalLabel.font; context.strokeStyle = rules.optionalLabel.color; context.fillStyle = rules.optionalLabel.color; context.lineWidth = rules.optionalLabel.borderWidth;
      context.beginPath(); context.roundRect(label.x, label.y, label.width, label.height, rules.optionalLabel.radius); context.stroke();
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(rules.optionalLabel.text, label.x + label.width / 2, label.y + label.height / 2);
    }
    const nextOptionalRects: Record<string, Rect> = {};
    const nextOptionalAutoScenes: typeof optionalAutoScenes.current = {};
    optionalScenes.forEach((scene) => {
      const { item, itemDimensions, productRect, annotations: sceneAnnotations } = scene;
      const otherObjects = [
        ...templateObstacles,
        ...(mainImage ? annotatedProductCollisionRects(adjusted.productRect, dimensionEditor.scenes.current.main.annotations, mainImage.silhouette) : []),
        ...optionalScenes.flatMap((other) => other.item.id !== item.id && other.item.image
          ? annotatedProductCollisionRects(other.productRect, other.measured, other.item.image.silhouette) : []),
      ];
      dimensionEditor.scenes.current[item.id] = {
        productRect, baseProductRect: scene.originalProductRect, adjustment: item.adjustment, annotations: scene.measured, fitArea: scene.group, safeArea: scene.movementArea,
        obstacles: otherObjects, minimumGap: objectGap, silhouette: item.image?.silhouette,
      };
      nextOptionalRects[item.id] = productRect;
      nextOptionalAutoScenes[item.id] = { productRect: scene.baseProductRect, annotations: scene.baseMeasured, safeArea: scene.movementArea, obstacles: otherObjects, silhouette: item.image?.silhouette };
      if (item.image) drawProduct(context, item.image, productRect);
      sceneAnnotations.filter((annotation) => optionalMarkTask?.id !== item.id || annotation.kind !== optionalMarkTask.kind)
        .forEach((annotation) => dimensionTargets.current.push({ ...drawDimension(context, dimensionEditor.display(item.id, annotation), item.adjustment.dimensionFrame ?? productRect, dimensionText(annotation, item.dimensionFields), rules), ownerId: item.id }));

      if (optionalMarkTask?.id === item.id && optionalDraftStart && optionalHoverPoint) {
        const previewTask = dimensionTask(itemDimensions, optionalMarkTask.kind);
        if (previewTask) drawDimension(context, {
          ...previewTask,
          from: pointFromProduct(optionalDraftStart, item.adjustment.dimensionFrame ?? productRect),
          to: snapDimensionPoint(pointFromProduct(optionalDraftStart, item.adjustment.dimensionFrame ?? productRect), pointFromProduct(optionalHoverPoint, item.adjustment.dimensionFrame ?? productRect), shiftPressed),
        }, item.adjustment.dimensionFrame ?? productRect, dimensionText(previewTask, item.dimensionFields), rules);
      }
    });
    optionalProductRects.current = nextOptionalRects;
    dimensionEditor.updateTargets(dimensionTargets.current);
    optionalAutoScenes.current = nextOptionalAutoScenes;
    const selectedOptional = optionalMicroId ? optionalScenes.find((scene) => scene.item.id === optionalMicroId) : undefined;
    if (selectedOptional) {
      setMicroProductRect((current) => sameRect(current, selectedOptional.productRect) ? current : selectedOptional.productRect);
      setMicroGroupBounds((current) => sameRect(current, selectedOptional.bounds) ? current : selectedOptional.bounds);
    }
    if (showNote) {
      context.font = NOTE_FONT; context.fillStyle = rules.note.color; context.textAlign = 'left'; context.textBaseline = 'top';
      if (context.measureText(note).width > layout.note.width) nextLayoutIssues.push('底部备注过长，超出组合安全区');
      if (!noteEditing) context.fillText(note, layout.note.x, layout.note.y);
    }
    if (feature) rules.feature!.draw(context, featureValue, feature);
    if (showSellingPoints && rules.sellingPoints) {
      applyTemplateSellingPointFont(context, rules.sellingPoints);
      const sellingLayout = rules.sellingPoints.layout(sellingPoints.map((point) => context.measureText(point).width));
      setSellingPointBoxes((current) => JSON.stringify(current) === JSON.stringify(sellingLayout.boxes) ? current : sellingLayout.boxes);
      if (sellingLayout.issue) nextLayoutIssues.push(sellingLayout.issue);
      context.fillStyle = rules.sellingPoints.color; context.strokeStyle = rules.sellingPoints.color; context.lineWidth = rules.sellingPoints.borderWidth;
      context.textAlign = 'center'; context.textBaseline = 'middle';
      sellingLayout.boxes.forEach((box, index) => {
        context.beginPath(); context.roundRect(box.x, box.y, box.width, box.height, rules.sellingPoints!.radius); context.stroke();
        context.save(); context.beginPath(); context.roundRect(box.x + rules.sellingPoints!.borderWidth, box.y + rules.sellingPoints!.borderWidth, box.width - rules.sellingPoints!.borderWidth * 2, box.height - rules.sellingPoints!.borderWidth * 2, rules.sellingPoints!.clipRadius); context.clip();
        context.fillText(sellingPoints[index], box.x + box.width / 2, box.y + box.height / 2); context.restore();
      });
    }
    setLayoutIssues((current) => current.length === nextLayoutIssues.length && current.every((issue, index) => issue === nextLayoutIssues[index]) ? current : nextLayoutIssues);
    context.textAlign = 'start'; context.textBaseline = 'alphabetic';
  }, [model, kind, mainImage, optionalSizes, annotations, dimensionFields, subjectAdjustment, productPreview, draftStart, hoverPoint, activeTask, reannotateKind, optionalMarkTask, optionalDraftStart, optionalHoverPoint, optionalMicroId, labelOffsetY, labelSide, labelSelected, labelEnabled, noteEnabled, note, noteEditing, canvasFonts.status, dimensionEditor.preview, shiftPressed, options, rules]);

  function canvasPoint(event: React.MouseEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * CANVAS_SIZE / rect.width, y: (event.clientY - rect.top) * CANVAS_SIZE / rect.height };
  }
  function canvasPointFromClient(clientX: number, clientY: number): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) * CANVAS_SIZE / rect.width, y: (clientY - rect.top) * CANVAS_SIZE / rect.height };
  }
  function pointInsideRect(point: Point, rect: Rect): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }
  function beginMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = canvasPointFromClient(event.clientX, event.clientY);
    if (optionalMarkTask || draftStart || reannotateKind) return;
    if (featureBounds && pointInsideRect(point, featureBounds)) {
      clearSelection(); setSelection({ type: 'feature' }); suppressCanvasClick.current = true;
      microInteraction.current = { mode: 'feature', start: point, feature: { ...featureValue, x: featureBounds.x, y: featureBounds.y } };
      event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); return;
    }
    if (optionalLabelRect.current && pointInsideRect(point, optionalLabelRect.current)) {
      clearSelection(); setSelection({ type: 'label' }); setLabelSelected(true);
      suppressCanvasClick.current = true;
      microInteraction.current = { mode: 'label', startY: point.y, offsetY: labelOffsetY };
      event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
      return;
    }
    const dimension = hitTestDimension(point, dimensionTargets.current, 8 * CANVAS_SIZE / event.currentTarget.getBoundingClientRect().width);
    if (dimension) {
      event.preventDefault();
      selectDimension(dimension.ownerId, dimension.kind);
      if (dimension.part === 'label') dimensionEditor.setTextTarget(dimension);
      else dimensionEditor.setLabelTarget(undefined);
      suppressCanvasClick.current = true;
      return;
    }
    const hitOptional = [...optionalSizes].reverse().find((item) => item.image
      && optionalProductRects.current[item.id]
      && pointHitsProductSilhouette(point, optionalProductRects.current[item.id], item.image.silhouette));
    let target: 'main' | string;
    let product: Rect | undefined;
    let adjustment: SubjectAdjustment;
    if (hitOptional) {
      target = hitOptional.id;
      product = optionalProductRects.current[hitOptional.id];
      adjustment = hitOptional.adjustment ?? DEFAULT_ADJUSTMENT;
      setLabelSelected(false); setMicroAdjust(false); setOptionalMicroId(hitOptional.id);
      setSelection({ type: 'product', id: hitOptional.id });
    } else if (!activeTask && mainImage && pointHitsProductSilhouette(point, displayedProductRect.current, mainImage.silhouette)) {
      target = 'main'; product = displayedProductRect.current; adjustment = appliedAdjustment.current;
      setLabelSelected(false); setOptionalMicroId(undefined); setMicroAdjust(true);
      setSelection({ type: 'product', id: 'main' });
    } else {
      if (!activeTask) clearSelection();
      return;
    }
    if (!product) return;
    dimensionEditor.clear();
    suppressCanvasClick.current = true;
    microInteraction.current = { mode: 'move', target, start: point, adjustment };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault();
  }
  function registerImageInput(id: string, input: HTMLInputElement | null) {
    if (input) imageInputs.current.set(id, input);
    else imageInputs.current.delete(id);
  }

  function replaceSelectedImage(event: React.MouseEvent<HTMLCanvasElement>) {
    if (selection?.type !== 'product') return;
    const id = selection.id;
    const image = id === 'main' ? mainImage : optionalSizes.find((item) => item.id === id)?.image;
    const rect = id === 'main' ? displayedProductRect.current : optionalProductRects.current[id];
    const input = imageInputs.current.get(id);
    if (!image || !rect || !input || !pointHitsProductSilhouette(canvasPoint(event), rect, image.silhouette)) return;
    event.preventDefault();
    microInteraction.current = undefined;
    input.value = '';
    input.click();
  }

  function beginScale(event: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) {
    const target = optionalMicroId ?? 'main';
    const scene = optionalMicroId ? optionalAutoScenes.current[optionalMicroId] : autoScene.current;
    const currentProduct = optionalMicroId ? optionalProductRects.current[optionalMicroId] : displayedProductRect.current;
    if ((!microAdjust && !optionalMicroId) || !scene || !currentProduct || draftStart) return;
    const adjustment = optionalMicroId ? optionalSizes.find((item) => item.id === optionalMicroId)?.adjustment ?? DEFAULT_ADJUSTMENT : appliedAdjustment.current;
    const anchor = rectCorner(currentProduct, oppositeCorner(corner));
    const anchorBase = rectCorner(scene.productRect, oppositeCorner(corner));
    const movingCorner = rectCorner(currentProduct, corner);
    microInteraction.current = { mode: 'scale', target, anchor, anchorBase, startDistance: Math.hypot(movingCorner.x - anchor.x, movingCorner.y - anchor.y), adjustment };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); event.stopPropagation();
  }
  function continueMicroAdjustment(event: React.PointerEvent<HTMLDivElement>) {
    const interaction = microInteraction.current;
    if (!interaction) return;
    const point = canvasPointFromClient(event.clientX, event.clientY);
    if (interaction.mode === 'feature') {
      moveFeature({ ...interaction.feature, x: interaction.feature.x + point.x - interaction.start.x, y: interaction.feature.y + point.y - interaction.start.y });
      return;
    }
    if (interaction.mode === 'label') {
      setLabelOffsetY(rules.constrainLabel(optionalSizes.length, kind, labelSide, interaction.offsetY + point.y - interaction.startY));
      return;
    }
    const scene = interaction.target === 'main' ? autoScene.current : optionalAutoScenes.current[interaction.target];
    if (!scene) return;
    const apply = (requested: SubjectAdjustment) => {
      requestedPreview.current = { target: interaction.target, adjustment: requested };
      setProductPreview(requestedPreview.current);
    };
    if (interaction.mode === 'move') {
      apply({ ...interaction.adjustment, offsetX: interaction.adjustment.offsetX + point.x - interaction.start.x, offsetY: interaction.adjustment.offsetY + point.y - interaction.start.y }); return;
    }
    const distance = Math.hypot(point.x - interaction.anchor.x, point.y - interaction.anchor.y);
    const scale = interaction.adjustment.scale * Math.max(distance / interaction.startDistance, .01);
    apply({ ...interaction.adjustment, scale, offsetX: interaction.anchor.x - scene.productRect.x - (interaction.anchorBase.x - scene.productRect.x) * scale, offsetY: interaction.anchor.y - scene.productRect.y - (interaction.anchorBase.y - scene.productRect.y) * scale });
  }

  function cancelMicroAdjustment() {
    microInteraction.current = undefined;
    requestedPreview.current = undefined;
    setProductPreview(undefined);
  }

  function finishMicroAdjustment(event: React.PointerEvent<HTMLDivElement>) {
    if (!microInteraction.current) return;
    if (microInteraction.current.mode === 'feature' || microInteraction.current.mode === 'label') { cancelMicroAdjustment(); return; }
    continueMicroAdjustment(event);
    const preview = requestedPreview.current;
    const scene = preview?.target === 'main' ? autoScene.current : preview && optionalAutoScenes.current[preview.target];
    if (scene && preview) {
      const result = adjustAnnotatedProductAroundObstacles(scene.productRect, scene.annotations, scene.safeArea, scene.obstacles, objectGap, preview.adjustment, scene.silhouette);
      if (preview.target === 'main') {
        history.commit({ ...currentHistoryState(), subjectAdjustment: result.adjustment });
        setSubjectAdjustment(result.adjustment);
      } else {
        const next = optionalSizes.map((item) => item.id === preview.target ? { ...item, adjustment: result.adjustment } : item);
        history.commit({ ...currentHistoryState(), optionalSizes: next });
        setOptionalSizes(next);
      }
      setMicroConstraintHint(result.constrained ? (result.adjustment.dimensionFrame ? '已将产品适配到规范安全范围，尺寸线保持固定' : '已将产品和标注整体适配到规范安全范围') : '');
    }
    cancelMicroAdjustment();
  }

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelMicroAdjustment(); };
    window.addEventListener('keydown', cancel);
    window.addEventListener('blur', cancelMicroAdjustment);
    return () => { window.removeEventListener('keydown', cancel); window.removeEventListener('blur', cancelMicroAdjustment); };
  }, []);

  async function uploadMain(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = '';
    await imageImport.run(file, (nextImage) => {
      const scene = dimensionEditor.scenes.current.main;
      const fixed = mainImage && scene ? changeDimensionLink(scene, true, annotations) : undefined;
      if (fixed) setAnnotations(fixed.annotations);
      clearSelection();
      setMicroAdjust(false); setOptionalMicroId(undefined); setSubjectAdjustment({ ...DEFAULT_ADJUSTMENT, ...(fixed ? { dimensionFrame: fixed.adjustment.dimensionFrame } : {}) }); setMicroConstraintHint('');
      setModel((current) => resolveModelOnUpload(current, manuallyEditedModel.current, file.name, rules.filenameName));
      setMainImage(nextImage);
    });
  }
  async function uploadOptional(index: number, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const id = optionalSizes[index].id;
    event.target.value = '';
    await imageImport.run(file, (image) => {
      const scene = dimensionEditor.scenes.current[id];
      const fixed = optionalSizes.find((item) => item.id === id)?.image && scene ? changeDimensionLink(scene, true, optionalSizes.find((item) => item.id === id)?.annotations) : undefined;
      clearSelection();
      setOptionalSizes((current) => current.map((item) => item.id === id ? { ...item, image, ...(fixed ? { annotations: fixed.annotations, adjustment: { ...DEFAULT_ADJUSTMENT, dimensionFrame: fixed.adjustment.dimensionFrame } } : {}) } : item));
    });
  }
  function changeQuickDimensions(value: string) {
    setSizeInput(value);
    const fields = rules.parseQuickDimensions(value); if (fields) setDimensionFields(fields);
  }
  function changeDimensionField(kindName: DimensionKind, value: string) { const next = { ...dimensionFields, [kindName]: value }; setDimensionFields(next); setSizeInput(formatDimensionFields(next)); }
  function changeOptionalQuickDimensions(id: string, value: string) {
    setOptionalSizes((current) => current.map((item) => {
      if (item.id !== id) return item;
      return { ...item, sizeInput: value, dimensionFields: rules.parseQuickDimensions(value) ?? item.dimensionFields };
    }));
  }
  function changeOptionalDimensionField(id: string, kindName: DimensionKind, value: string) {
    setOptionalSizes((current) => current.map((item) => {
      if (item.id !== id) return item;
      const nextFields = { ...item.dimensionFields, [kindName]: value };
      return { ...item, dimensionFields: nextFields, sizeInput: formatDimensionFields(nextFields) };
    }));
  }
  function startOptionalAnnotation(item: OptionalSize, kindName: DimensionKind) {
    if (dimensionsFromFields(item.dimensionFields, precision)[kindName] === undefined || !item.image) return;
    dimensionEditor.clear();
    setMicroAdjust(false); setOptionalMicroId(undefined); setReannotateKind(undefined); setDraftStart(undefined); setHoverPoint(undefined);
    setOptionalMarkTask({ id: item.id, kind: kindName }); setOptionalDraftStart(undefined); setOptionalHoverPoint(undefined);
    setLabelSelected(false); setSelection({ type: 'dimensions', id: item.id, kind: kindName });
  }
  function clearOptionalAnnotation(id: string, kindName: DimensionKind) {
    setOptionalSizes((current) => current.map((item) => item.id === id
      ? { ...item, annotations: item.annotations.filter((annotation) => annotation.kind !== kindName) }
      : item));
    if (optionalMarkTask?.id === id && optionalMarkTask.kind === kindName) {
      setOptionalMarkTask(undefined); setOptionalDraftStart(undefined); setOptionalHoverPoint(undefined);
    }
  }
  function markDimension(event: React.MouseEvent<HTMLCanvasElement>) {
    if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return; }
    if (labelSelected) return;
    if (microAdjust || optionalMicroId) return;
    if (optionalMarkTask) {
      const productRect = optionalSizes.find((item) => item.id === optionalMarkTask.id)?.adjustment.dimensionFrame ?? optionalProductRects.current[optionalMarkTask.id];
      const item = optionalSizes.find((candidate) => candidate.id === optionalMarkTask.id);
      if (!productRect || !item) return;
      const raw = canvasPoint(event);
      const point = pointRelativeToProduct(optionalDraftStart ? snapDimensionPoint(pointFromProduct(optionalDraftStart, item.adjustment.dimensionFrame ?? productRect), raw, event.shiftKey) : raw, productRect);
      if (!optionalDraftStart) { setOptionalDraftStart(point); setOptionalHoverPoint(point); return; }
      const itemDimensions = dimensionsFromFields(item.dimensionFields, precision);
      setOptionalSizes((current) => current.map((candidate) => candidate.id === item.id
        ? { ...candidate, annotations: completeDimension(candidate.annotations, itemDimensions, optionalDraftStart, point, optionalMarkTask.kind) }
        : candidate));
      setOptionalMarkTask(undefined); setOptionalDraftStart(undefined); setOptionalHoverPoint(undefined);
      return;
    }
    if (!mainImage || !activeTask) return;
    const rect = subjectAdjustment.dimensionFrame ?? displayedProductRect.current;
    const raw = canvasPoint(event);
    const point = pointRelativeToProduct(draftStart ? snapDimensionPoint(pointFromProduct(draftStart, rect), raw, event.shiftKey) : raw, rect);
    if (!draftStart) { setDraftStart(point); setHoverPoint(point); return; }
    setAnnotations((current) => completeDimension(current, dimensions, draftStart, point, reannotateKind));
    setReannotateKind(undefined); setDraftStart(undefined); setHoverPoint(undefined);
  }
  function startReannotation(kindName: DimensionKind) { if (!mainImage || dimensions[kindName] === undefined) return; clearSelection(); setSelection({ type: 'dimensions', id: 'main', kind: kindName }); setReannotateKind(kindName); }
  function clearSelection() {
    cancelMicroAdjustment();
    setSellingPointEditing(false); setFeatureEditing(false);
    dimensionEditor.clear();
    setSelection(undefined); setLabelSelected(false); setMicroAdjust(false); setOptionalMicroId(undefined); setMicroConstraintHint('');
    setReannotateKind(undefined); setDraftStart(undefined); setHoverPoint(undefined);
    setOptionalMarkTask(undefined); setOptionalDraftStart(undefined); setOptionalHoverPoint(undefined);
    microInteraction.current = undefined;
  }
  function selectDimension(id: string, kind: DimensionKind) {
    if (selection?.type === 'dimensions' && selection.id === id && selection.kind === kind) return;
    clearSelection(); setSelection({ type: 'dimensions', id, kind });
  }
  function selectProduct(id: string) {
    clearSelection(); setSelection({ type: 'product', id });
    if (id === 'main') setMicroAdjust(Boolean(mainImage));
    else setOptionalMicroId(id);
  }
  function setDimensionFixed(id: string, fixed: boolean) {
    const scene = dimensionEditor.scenes.current[id];
    if (!scene || Boolean(scene.adjustment?.dimensionFrame) === fixed) return;
    cancelMicroAdjustment(); dimensionEditor.clear();
    const change = changeDimensionLink(scene, fixed, id === 'main' ? annotations : optionalSizes.find((item) => item.id === id)?.annotations);
    if (id === 'main') {
      history.commit({ ...currentHistoryState(), annotations: change.annotations, subjectAdjustment: change.adjustment });
      setAnnotations(change.annotations); setSubjectAdjustment(change.adjustment);
    } else {
      const next = optionalSizes.map((item) => item.id === id ? { ...item, annotations: change.annotations, adjustment: change.adjustment } : item);
      history.commit({ ...currentHistoryState(), optionalSizes: next }); setOptionalSizes(next);
    }
  }
  function moveOptional(index: number, direction: -1 | 1) {
    setOptionalSizes((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  function moveFeature(feature: FeaturePlacement) {
    if (!rules.feature) return;
    const bounds = rules.feature.bounds(feature, Math.max(0, (featureBounds?.width ?? rules.feature.textInset) - rules.feature.textInset), optionalSizes.length);
    setFeatureValue({ ...feature, x: bounds.x, y: bounds.y });
  }
  function moveOptionalLabelY(delta: number) {
    setLabelOffsetY((value) => rules.constrainLabel(optionalSizes.length, kind, labelSide, value + delta));
  }
  async function clearSite() {
    if (!window.confirm('确定清空当前组合现场吗？主产品、其他规格、尺寸标注、备注和微调都会被清除。')) return;
    clearSelection();
    draftGeneration.current += 1; skipNextSave.current = true; manuallyEditedModel.current = false;
    setModel(''); imageImport.cancel(); setKind('standard'); setSizeInput(''); setDimensionFields(EMPTY_DIMENSIONS); setAnnotations([]); setMainImage(undefined); setOptionalSizes([]); setOptionalMarkTask(undefined); setOptionalDraftStart(undefined); setOptionalHoverPoint(undefined); setMicroGroupBounds(undefined); setMicroConstraintHint('');
    setLabelEnabled(true); setLabelOffsetY(0); setLabelSide('left'); setLabelSelected(false); setNoteEnabled(true); setNote(DEFAULT_NOTE); setOptions(rules.createOptions()); setSellingPointEditing(false); setDraftStart(undefined); setHoverPoint(undefined); setReannotateKind(undefined); setSubjectAdjustment(DEFAULT_ADJUSTMENT); setMicroAdjust(false); setOptionalMicroId(undefined);
    setDraftStatus('正在清空组合现场…'); await saveQueue.current.catch(() => undefined); await clearDraft(draftSlot); setDraftStatus('当前组合现场已清空');
  }
  async function saveBeforeDesktopExit() {
    await saveQueue.current.catch(() => undefined);
    if (draftReady.current) await saveDraft(currentDraft(), draftSlot);
    await project.flush();
  }
  useEffect(() => registerDesktopFlush(saveBeforeDesktopExit));

  async function backToTemplates() {
    imageImport.cancel();
    if (isDesktop()) {
      try { await saveBeforeDesktopExit(); onBack(); }
      catch (error) { const message = error instanceof Error ? error.message : '保存失败，现场已保留'; setDraftStatus(message); alert(message); }
      return;
    }
    await saveQueue.current.catch(() => undefined);
    if (draftReady.current) await saveDraft(currentDraft(), draftSlot).catch(() => undefined);
    await project.flush().catch(() => undefined);
    onBack();
  }

  const validation = rules.validate({
    options, sizeInput, optionalSizeInputs: optionalSizes.map((item) => item.sizeInput),
    model,
    hasMainImage: Boolean(mainImage),
    mainDimensionFields: dimensionFields,
    mainAnnotations: annotations,
    mainAnnotationInProgress: Boolean(reannotateKind || draftStart),
    optionalSizes: optionalSizes.map((item) => ({
      hasImage: Boolean(item.image),
      dimensionFields: item.dimensionFields,
      annotations: item.annotations,
      annotationInProgress: optionalMarkTask?.id === item.id,
    })),
    noteEnabled,
    note,
    layoutIssues,
    fontIssue: canvasFonts.issue,
  });
  const issues = validation.blockers;
  const hasAnyDimension = Object.keys(dimensions).length > 0;
  const taskStatus = !hasAnyDimension ? '可直接点击任一产品并拖动；在左侧输入尺寸后选择标注' : nextDimension(dimensions, annotations) ? '在左侧选择主产品的长、宽、高进行标注' : '主产品尺寸均已完成，点击尺寸可微调，拖动产品可移动';
  const canvasStatus = featureEditing ? '正在编辑功能说明：按回车或点击其他位置结束编辑' : selection?.type === 'feature' ? '已选中功能说明：拖动箭头移动，点击文字编辑，也可使用右侧按钮微调' : sellingPointEditing ? '正在编辑卖点：按回车或点击其他位置结束编辑' : dimensionEditor.textTarget ? '正在编辑尺寸：Enter 保存，Esc 取消，点击其他位置保存' : dimensionEditor.labelMoving ? '移动尺寸文字：拖动高亮文字，点空白或再次点击按钮结束，Esc 取消' : dimensionEditor.preview ? (dimensionEditor.preview.endpoint === 'line' ? '正在整体移动标注：Shift 限定方向，松开后整体适配安全范围，Esc 取消' : dimensionEditor.mode === 'extensions' ? '正在调整辅助线：松开后整体适配安全范围，Esc 取消' : '正在调整端点：Shift 锁定水平／垂直，松开后整体适配安全范围') : noteEditing ? '正在编辑底部备注：直接输入文字，按回车或点击其他位置结束编辑' : labelSelected ? '已选中“其他可选尺寸”：可在画布安全范围内上下拖动，也可使用右侧上移／下移按钮' : productPreview ? (productPreview.adjustment.dimensionFrame ? '正在调整产品，尺寸线保持固定；Esc 取消' : '正在调整产品和标注：松开后整体适配安全范围，Esc 取消') : microAdjust || optionalMicroId ? (microConstraintHint || (optionalMicroId ? `微调规格 ${optionalSizes.findIndex((item) => item.id === optionalMicroId) + 1}：拖动产品移动，拖动四角等比例缩放，双击产品换图` : '微调中：拖动产品移动，拖动四角等比例缩放，双击产品换图')) : optionalMarkTask ? `正在标注规格 ${optionalSizes.findIndex((item) => item.id === optionalMarkTask.id) + 1} 的${optionalMarkTask.kind === 'length' ? '长' : optionalMarkTask.kind === 'width' ? '宽' : '高'}${optionalDraftStart ? '：点击第二端点，按住 Shift 锁定水平／垂直' : '：点击第一端点'}` : draftStart ? `正在标注${activeTask?.label ?? ''}：点击第二端点，按住 Shift 锁定水平／垂直` : reannotateKind ? `正在标注${DIMENSION_LABELS[reannotateKind]}：点击第一端点` : selection?.type === 'dimensions' ? `已选中${selection.id === 'main' ? '主产品' : '规格 ' + (optionalSizes.findIndex((item) => item.id === selection.id) + 1)}的${DIMENSION_LABELS[selection.kind]}：${dimensionEditor.mode === 'extensions' ? '拖动菱形调整辅助线，可用方向键微调' : '拖动高亮线条整体移动，圆点调整端点；Shift 限定方向'}` : taskStatus;
  const subjectAdjusted = hasAdjustment(subjectAdjustment);
  const hasSite = Boolean(model || mainImage || optionalSizes.length || sizeInput || annotations.length || subjectAdjusted || note !== DEFAULT_NOTE || !noteEnabled || !labelEnabled || labelOffsetY || labelSide !== 'left' || rules.hasOptions(options));
  function exportJpg() {
    if (issues.length) { alert(issues.join('\n')); return; }
    const output = document.createElement('canvas');
    output.width = CANVAS_SIZE; output.height = CANVAS_SIZE;
    const context = output.getContext('2d')!;
    context.drawImage(canvasRef.current!, 0, 0);
    if (showNote && noteEditing) {
      const { note: rect } = getLayout();
      context.font = NOTE_FONT; context.fillStyle = rules.note.color; context.textAlign = 'left'; context.textBaseline = 'top';
      context.fillText(note, rect.x, rect.y);
    }
    void exportCanvasJpg(output, rules.exportFileName(model)).catch((error) => { setDraftStatus(error.message); if (isDesktop()) alert(error.message); });
  }
  const mainDimensionComplete = hasAnyDimension && !nextDimension(dimensions, annotations) && !reannotateKind;
  const inspectorOwnerId = selection && 'id' in selection ? selection.id : 'main';
  const inspectorItem = optionalSizes.find((item) => item.id === inspectorOwnerId);
  const inspectorTitle = inspectorItem ? `规格 ${optionalSizes.findIndex((item) => item.id === inspectorItem.id) + 1}` : '主产品';
  const inspectorFields = inspectorItem?.dimensionFields ?? dimensionFields;
  const inspectorAnnotations = inspectorItem?.annotations ?? annotations;
  const inspectorImage = inspectorItem?.image ?? (inspectorOwnerId === 'main' ? mainImage : undefined);
  const canvasLayout = getLayout();
  const noteRect = canvasLayout.note;
  const labelRect = { ...canvasLayout.optionalLabel, x: labelSide === 'right' ? CANVAS_SIZE - canvasLayout.sideMargin - canvasLayout.optionalLabel.width : canvasLayout.optionalLabel.x, y: (labelSide === 'right' ? canvasLayout.optionalLabelRightY : canvasLayout.optionalLabel.y) + labelOffsetY };
  const objectItems: CombinationObjectItem[] = optionalSizes.map((item, index) => {
    const itemDimensions = dimensionsFromFields(item.dimensionFields, precision);
    const markedKinds = item.annotations.map((annotation) => annotation.kind === 'length' ? '长' : annotation.kind === 'width' ? '宽' : '高').join('');
    const complete = Boolean(item.image && Object.keys(itemDimensions).length && item.annotations.length);
    return {
      id: item.id,
      title: `规格 ${index + 1}`,
      filename: item.image?.name,
      image: item.image,
      sizeInput: item.sizeInput,
      summary: `${item.sizeInput || formatDimensionFields(item.dimensionFields) || '待填写尺寸'} · ${markedKinds || '未标'}`,
      status: complete ? 'complete' : item.image || Object.keys(itemDimensions).length ? 'pending' : 'empty',
    };
  });

  return <main className={`workbench-shell${rules.markingPassThrough && (reannotateKind || optionalMarkTask) ? ' template-marking' : ''}`}>
    <WorkbenchHeader title={TEMPLATES[templateId].title} subtitle="组合模板 / 1440 × 1440" saveStatus={project.status} pendingCount={issues.length + validation.warnings.length} exportLabel="导出组合 JPG" onBack={backToTemplates} onExport={exportJpg} projectFileName={project.fileName} onOpenProject={() => void project.open()} onSaveProject={() => void project.save()} onSaveProjectAs={() => void project.saveAs()} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo}/>
    <section className="workbench-layout combination-layout">
      <CombinationObjectPanel maxOptionalCount={rules.maxOptionalCount} labelControls={rules.optionalLabel.movable} elementControls={labelState.showControls} model={model} mainComplete={Boolean(mainImage && model.trim() && mainDimensionComplete)} optionalItems={objectItems} selectedId={inspectorOwnerId === 'main' ? undefined : inspectorOwnerId} labelSelected={labelSelected} labelEnabled={labelEnabled} labelSide={labelSide} noteEnabled={noteEnabled}
        productIcon={inputImageIcon(templateId)} mainSizeInput={sizeInput} onMainSizeChange={changeQuickDimensions}
        mainFields={<section className="quick-section">
          <div className="quick-product-row" style={{ gridTemplateColumns: rules.mainFieldsColumns === 1 ? '1fr' : undefined }}>
            {KindEditor && <KindEditor value={kind} onChange={setKind}/>}
            <label>产品型号<input value={model} onChange={(event) => { manuallyEditedModel.current = true; setModel(event.target.value); }}/></label>
          </div>
          {unmarkedKinds.length > 0 && <div className="quick-annotation-actions">{unmarkedKinds.map((dimensionKind) => <button type="button" key={dimensionKind} disabled={!mainImage || dimensions[dimensionKind] === undefined} onClick={() => startReannotation(dimensionKind)}>标注{DIMENSION_LABELS[dimensionKind]}</button>)}</div>}
          {OptionsEditor && <OptionsEditor value={options} onChange={setOptions} count={optionalSizes.length} onBeforeChange={clearSelection}/>}
          {mainImage && <InputDetails title="图片与文件名"><FilenameNameNotice filename={mainImage.name} policy={rules.filenameName} current={model} manuallyEdited={manuallyEditedModel.current} onApply={(value) => { manuallyEditedModel.current = true; setModel(value); }}/></InputDetails>}
          {imageImport.error && <p className="hint" role="alert">{imageImport.error}</p>}
        </section>}
        uploadSlot={<InputImage image={mainImage} icon={inputImageIcon(templateId)} label="上传主产品 PNG" inputRef={(input) => registerImageInput('main', input)} onChange={uploadMain} disabled={imageImport.busy}/>}
        imageImportBusy={imageImport.busy}
        optionalActions={(id) => {
          const index = optionalSizes.findIndex((item) => item.id === id);
          return <details className="spec-management"><summary>规格操作</summary>
              <button type="button" className="quick-secondary" disabled={!mainImage} onClick={() => setOptionalSizes((current) => current.map((candidate) => candidate.id === id ? { ...candidate, image: mainImage } : candidate))}>复用主产品图</button>
              <div className="quick-annotation-actions"><button type="button" disabled={index === 0} onClick={() => moveOptional(index, -1)}>上移</button><button type="button" disabled={index === optionalSizes.length - 1} onClick={() => moveOptional(index, 1)}>下移</button><button type="button" onClick={() => { if (inspectorOwnerId === id || optionalMarkTask?.id === id) clearSelection(); setOptionalSizes((current) => current.filter((candidate) => candidate.id !== id)); }}>删除</button></div>
            </details>;
        }}
        noteFields={showNote && <label className="quick-note">备注文字<input value={note} onChange={(event) => setNote(event.target.value)}/></label>}
        management={<details className="workspace-management"><summary>现场管理</summary><p className="draft-status">{draftStatus}</p><p className="draft-status">{project.status}</p><button type="button" className="clear-site" disabled={!hasSite} onClick={clearSite}>清空组合现场</button></details>}
        onSelect={selectProduct}
        onAdd={() => setOptionalSizes((current) => current.length >= rules.maxOptionalCount ? current : [...current, { id: crypto.randomUUID(), sizeInput: '', dimensionFields: { ...EMPTY_DIMENSIONS }, annotations: [], adjustment: DEFAULT_ADJUSTMENT }])}
        onToggleLabel={() => { clearSelection(); setLabelEnabled(!labelEnabled); }}
        onSetLabelSide={(side) => { setLabelSide(side); setLabelOffsetY(0); }}
        onToggleNote={() => { setNoteEditing(false); setNoteEnabled((current) => !current); }}
        onOptionalSizeChange={changeOptionalQuickDimensions}
        optionalImageInputRef={registerImageInput}
        onOptionalImageChange={(id, event) => { const index = optionalSizes.findIndex((item) => item.id === id); if (index >= 0) void uploadOptional(index, event); }}/>
      <section className="canvas-panel">
        <CanvasStage title={rules.canvasTitle} status={imageImport.error || (modelEditing ? '正在编辑产品型号：直接输入文字，按回车或点击其他位置结束编辑' : canvasStatus)} maxFitSize={662}>
        <div className="canvas-wrap" onBlurCapture={(event) => { if (event.target instanceof HTMLInputElement && event.target.classList.contains('canvas-selling-editor')) setSellingPointEditing(false); }} onPointerMove={continueMicroAdjustment} onPointerUp={finishMicroAdjustment} onPointerCancel={cancelMicroAdjustment} onLostPointerCapture={cancelMicroAdjustment}><canvas className={microAdjust || optionalMicroId || labelSelected ? 'micro-adjusting' : ''} ref={canvasRef} width="1440" height="1440" onClick={markDimension} onDoubleClick={replaceSelectedImage} onPointerDown={beginMove} onMouseMove={(event) => { const point = canvasPoint(event); if (optionalMarkTask && optionalDraftStart) { const rect = optionalSizes.find((item) => item.id === optionalMarkTask.id)?.adjustment.dimensionFrame ?? optionalProductRects.current[optionalMarkTask.id]; if (rect) setOptionalHoverPoint(pointRelativeToProduct(point, rect)); } else if (draftStart) setHoverPoint(pointRelativeToProduct(point, subjectAdjustment.dimensionFrame ?? displayedProductRect.current)); }}/>
          {featureBounds && <>
            {selection?.type === 'feature' && <div className="label-selection" style={{ left: `${featureBounds.x / CANVAS_SIZE * 100}%`, top: `${featureBounds.y / CANVAS_SIZE * 100}%`, width: `${featureBounds.width / CANVAS_SIZE * 100}%`, height: `${featureBounds.height / CANVAS_SIZE * 100}%` }}/>}
            {FeatureEditor && <FeatureEditor value={featureValue} box={featureBounds} editing={featureEditing} onFocus={() => { clearSelection(); setFeatureEditing(true); }} onBlur={() => setFeatureEditing(false)} onChange={setFeatureValue}/>}

          </>}
          <CanvasModelEditor box={modelBadge} value={model} fontSize={rules.model.fontSize} fontFamily={rules.model.fontFamily} color={rules.model.color} background={rules.model.background} paddingX={rules.model.paddingX} radius={rules.model.radius} onFocus={() => { clearSelection(); setModelEditing(true); }} onBlur={() => setModelEditing(false)} onChange={(value) => { manuallyEditedModel.current = true; setModel(value); }}/>
          <CanvasDimensionEditor precision={precision} allowCompound={rules.allowCompound} editor={dimensionEditor} selected={selection?.type === 'dimensions' && !reannotateKind && !optionalMarkTask ? { ownerId: selection.id, kind: selection.kind } : undefined}
            value={dimensionEditor.textTarget ? (dimensionEditor.textTarget.ownerId === 'main' ? dimensionFields : optionalSizes.find((item) => item.id === dimensionEditor.textTarget!.ownerId)?.dimensionFields)?.[dimensionEditor.textTarget.kind] ?? '' : ''}
            onChange={(target, value) => {
              if (target.ownerId === 'main') {
                const fields = { ...dimensionFields, [target.kind]: value };
                history.commit({ ...currentHistoryState(), dimensionFields: fields, sizeInput: formatDimensionFields(fields) });
                changeDimensionField(target.kind, value);
              } else {
                const next = optionalSizes.map((item) => {
                  if (item.id !== target.ownerId) return item;
                  const fields = { ...item.dimensionFields, [target.kind]: value };
                  return { ...item, dimensionFields: fields, sizeInput: formatDimensionFields(fields) };
                });
                history.commit({ ...currentHistoryState(), optionalSizes: next });
                setOptionalSizes(next);
              }
            }}/>
          {(microAdjust || optionalMicroId) && !(inspectorItem?.adjustment ?? subjectAdjustment).dimensionFrame && microGroupBounds && <div className="group-selection" style={{ left: `${microGroupBounds.x / CANVAS_SIZE * 100}%`, top: `${microGroupBounds.y / CANVAS_SIZE * 100}%`, width: `${microGroupBounds.width / CANVAS_SIZE * 100}%`, height: `${microGroupBounds.height / CANVAS_SIZE * 100}%` }}><span>产品＋标注整体范围</span></div>}{(microAdjust || optionalMicroId) && microProductRect && <div className="product-selection" style={{ left: `${microProductRect.x / CANVAS_SIZE * 100}%`, top: `${microProductRect.y / CANVAS_SIZE * 100}%`, width: `${microProductRect.width / CANVAS_SIZE * 100}%`, height: `${microProductRect.height / CANVAS_SIZE * 100}%` }}>{(['nw','ne','sw','se'] as ResizeCorner[]).map((corner) => <button type="button" key={corner} aria-label={`等比例缩放 ${corner}`} className={`resize-handle ${corner}`} onPointerDown={(event) => beginScale(event, corner)}/>)}</div>}{labelSelected && <div className="label-selection" style={{ left: `${labelRect.x / CANVAS_SIZE * 100}%`, top: `${labelRect.y / CANVAS_SIZE * 100}%`, width: `${labelRect.width / CANVAS_SIZE * 100}%`, height: `${labelRect.height / CANVAS_SIZE * 100}%` }}/>} {showSellingPoints && sellingPointBoxes.map((box, index) => <CanvasSellingPointEditor key={index} box={box} index={index} textStyle={rules.sellingPoints} maxLength={rules.sellingPoints?.maxLength} value={sellingPoints[index] ?? ''} onFocus={() => { clearSelection(); setSellingPointEditing(true); }} onChange={(value) => setSellingPoints((current) => current.map((point, pointIndex) => pointIndex === index ? value : point))}/>)} {showNote && <input className="canvas-note-editor" aria-label="画布底部备注" title="点击编辑备注" onFocus={() => { clearSelection(); setNoteEditing(true); }} onBlur={() => setNoteEditing(false)} value={note} placeholder="点击输入备注" style={{ left: `${noteRect.x / CANVAS_SIZE * 100}%`, top: `${noteRect.y / CANVAS_SIZE * 100}%`, width: `${noteRect.width / CANVAS_SIZE * 100}%`, height: `${(noteRect.height + 12) / CANVAS_SIZE * 100}%`, fontSize: `${parseFloat(NOTE_FONT) / CANVAS_SIZE * 100}cqw`, fontFamily: NOTE_FONT.replace(/^.*?px\s+/, ''), '--note-color': rules.note.color } as CSSProperties} onChange={(event) => setNote(event.target.value)} onPointerDown={(event) => { event.stopPropagation(); microInteraction.current = undefined; }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === 'Escape')) event.currentTarget.blur(); }}/>}</div>
        </CanvasStage>
      </section>
      <WorkbenchSidebar notes={rules.productionNotes}>
        {!selection && <div className="inspector-empty"><h2>微调编辑</h2><p>点击画布组件进行微调</p></div>}
        {selection?.type === 'product' && <section className="product-inspector"><h2>{inspectorTitle} · 产品微调</h2><DimensionLinkControls fixed={Boolean((inspectorItem?.adjustment ?? subjectAdjustment).dimensionFrame)} onChange={(fixed) => setDimensionFixed(inspectorOwnerId, fixed)}/><p className="hint">拖动产品移动，拖动四角等比例缩放。</p>
          {inspectorItem && <button type="button" disabled={!inspectorImage} onClick={() => selectDimension(inspectorItem.id, 'length')}>尺寸标注</button>}
          <button type="button" className="reset-layout" disabled={!inspectorImage || !hasAdjustment(inspectorItem?.adjustment ?? subjectAdjustment)} onClick={() => {
            const frame = (inspectorItem?.adjustment ?? subjectAdjustment).dimensionFrame;
            const next = { ...DEFAULT_ADJUSTMENT, ...(frame ? { dimensionFrame: frame } : {}) };
            if (inspectorItem) setOptionalSizes((current) => current.map((item) => item.id === inspectorItem.id ? { ...item, adjustment: next } : item));
            else setSubjectAdjustment(next);
            setMicroConstraintHint('');
          }}>恢复自动位置</button>
        </section>}
        {selection?.type === 'dimensions' && <DimensionInspector controls={<><DimensionLabelControls editor={dimensionEditor} annotation={inspectorAnnotations.find((item) => item.kind === dimensionEditor.labelTarget?.kind)} onChange={changeDimensionLabel}/><DimensionEditMode editor={dimensionEditor}/></>} title={inspectorTitle} fields={inspectorFields} annotations={inspectorAnnotations} activeKind={selection.kind} hasImage={Boolean(inspectorImage)}
          markingKind={inspectorItem ? optionalMarkTask?.id === inspectorItem.id ? optionalMarkTask.kind : undefined : reannotateKind}
          onSelect={(dimensionKind) => selectDimension(inspectorOwnerId, dimensionKind)}
          onChange={(dimensionKind, value) => inspectorItem ? changeOptionalDimensionField(inspectorItem.id, dimensionKind, value) : changeDimensionField(dimensionKind, value)}
          onAnnotate={(dimensionKind) => inspectorItem ? startOptionalAnnotation(inspectorItem, dimensionKind) : startReannotation(dimensionKind)}
          onCancel={() => { setReannotateKind(undefined); setDraftStart(undefined); setHoverPoint(undefined); setOptionalMarkTask(undefined); setOptionalDraftStart(undefined); setOptionalHoverPoint(undefined); }}
          onClear={inspectorItem ? (dimensionKind) => clearOptionalAnnotation(inspectorItem.id, dimensionKind) : undefined}/>}
        {selection?.type === 'feature' && FeatureInspector && <FeatureInspector value={featureValue} box={featureBounds} onMove={moveFeature}/>}
        {selection?.type === 'label' && <section className="label-inspector"><h2>其他可选尺寸 · 位置微调</h2><div className="quick-annotation-actions"><button type="button" onClick={() => moveOptionalLabelY(-10)}>上移 10px</button><button type="button" onClick={() => setLabelOffsetY(0)}>复位</button><button type="button" onClick={() => moveOptionalLabelY(10)}>下移 10px</button></div><p className="hint">也可以直接在画布上拖动标签。</p></section>}
      </WorkbenchSidebar>
    </section>
  </main>;
}
