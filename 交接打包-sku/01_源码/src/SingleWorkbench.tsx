import { templateDraftSlot, templateKindLabel, TEMPLATES } from './domain/templates';
import { ChangeEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { exportCanvasJpg, isDesktop, registerDesktopFlush } from './desktop/runtime';
import { annotationFromProduct, adjustAnnotatedProduct, previewAnnotatedProduct, fitAnnotatedProduct, pointFromProduct, pointHitsProductSilhouette, pointRelativeToProduct, type MeasuredDimensionAnnotation, type SubjectAdjustment } from './domain/annotatedProductFit';
import { completeDimension, dimensionTask, DimensionAnnotation, DimensionKind, nextDimension, updateAnnotationValues } from './domain/dimensionAnnotations';
import { getDimensionGeometry, dimensionLabelAngle, dimensionLabelBounds, Point, Rect } from './domain/dimensionGeometry';
import { getDimensionStyleGeometry } from './domain/dimensionStyle';
import { type DimensionFields, dimensionsFromFields } from './domain/dimensions';
import { resolveModelOnUpload } from './domain/modelFromFilename';
import { SINGLE_TEMPLATE_RULES, type SingleTemplateId } from './templates/registry';
import type { DimensionLabel, SingleTemplateOptions, SingleTemplateRules } from './templates/types';
import { applyTemplateSellingPointFont } from './templates/drawing';
import { validateSingleWorkbench } from './domain/workbenchValidation';
import { clearDraft, hasDraftContent, loadDraft, loadRecoveryHistory, saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { productImageFromBlob, type ProductImage } from './project/productImage';
import { useImageImport } from './project/useImageImport';
import { projectDraftSlot } from './project/projectFile';
import { useProjectFile, type ProjectLaunch } from './project/useProjectFile';
import { useUndoHistory } from './history/useUndoHistory';
import { useCanvasFonts } from './project/useCanvasFonts';
import { QuickInputPanel, WorkbenchHeader, WorkbenchSidebar } from './WorkbenchChrome';
import { InputCard, InputDetails, InputImage, type InputSlots } from './WorkbenchInputCards';
import { inputImageIcon } from './ui/inputImageIcons';
import { CanvasStage } from './CanvasStage';
import { CanvasSellingPointEditor } from './CanvasSellingPointEditor';
import { CanvasModelEditor } from './CanvasModelEditor';
import { FilenameNameNotice } from './FilenameNameNotice';
import { DimensionInspector, DIMENSION_LABELS } from './DimensionInspector';
import { hitTestDimension, type DimensionHitTarget } from './domain/dimensionHitTest';
import { CanvasDimensionEditor, DimensionEditMode } from './CanvasDimensionEditor';
import { DimensionLabelControls } from './DimensionLabelControls';
import { DimensionLinkControls } from './DimensionLinkControls';
import type { DimensionLabelAdjustment } from './domain/dimensionAnnotations';
import { useDimensionEditing } from './useDimensionEditing';
import { useShiftKey } from './useShiftKey';
import { changeDimensionLink, dimensionExtensionPoint, snapDimensionPoint } from './domain/dimensionEditing';
import { DEFAULT_ACCESSORY_ADJUSTMENT, adjustAccessoryProduct, drawAccessoryScenes, getAccessoryScenes, pointInAccessoryClip, type AccessoryPreview, type SingleAccessory } from './domain/singleAccessories';

const CANVAS_SIZE = 1440;
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';
type MicroInteraction = { ownerId?: string } & (
  | { mode: 'move'; start: Point; adjustment: SubjectAdjustment }
  | { mode: 'scale'; anchor: Point; anchorBase: Point; startDistance: number; adjustment: SubjectAdjustment });
type SingleHistoryState = {
  model: string;
  modelManuallyEdited: boolean;
  sellingPoints: string[];
  options: SingleTemplateOptions;
  sizeInput: string;
  dimensionFields: DimensionFields;
  image?: ProductImage;
  accessories: SingleAccessory[];
  annotations: DimensionAnnotation[];
  subjectAdjustment: SubjectAdjustment;
};

const DEFAULT_SUBJECT_ADJUSTMENT: SubjectAdjustment = { scale: 1, offsetX: 0, offsetY: 0 };
const EMPTY_DIMENSION_FIELDS: DimensionFields = { length: '', width: '', height: '' };

function sameRect(left: Rect | undefined, right: Rect) {
  return Boolean(left)
    && Math.abs(left!.x - right.x) < 0.01
    && Math.abs(left!.y - right.y) < 0.01
    && Math.abs(left!.width - right.width) < 0.01
    && Math.abs(left!.height - right.height) < 0.01;
}

function rectCorner(rect: Rect, corner: ResizeCorner): Point {
  return {
    x: corner.endsWith('w') ? rect.x : rect.x + rect.width,
    y: corner.startsWith('n') ? rect.y : rect.y + rect.height,
  };
}

function oppositeCorner(corner: ResizeCorner): ResizeCorner {
  return ({ nw: 'se', ne: 'sw', sw: 'ne', se: 'nw' } as const)[corner];
}

function drawDimension(context: CanvasRenderingContext2D, annotation: DimensionAnnotation, productRect: Rect, label: DimensionLabel, rules: SingleTemplateRules) {
  const text = `${annotation.value}cm`;
  const bounds = dimensionLabelBounds(annotation.from, annotation.to, label);
  const labelWidth = bounds.width, textHeight = bounds.height;
  const geometry = getDimensionGeometry(annotation.from, annotation.to, text, productRect, label, annotation.labelOffset);
  const labelColor = annotation.labelColor === 'white' ? '#ffffff' : annotation.labelColor === 'dark' ? '#000000' : label.color ?? rules.dimensionColor;
  const style = getDimensionStyleGeometry(annotation.from, annotation.to, annotation.kind, rules.lineStyle, annotation.extensionOffsets);
  context.save();
  context.strokeStyle = label.lineColor ?? style.color; context.fillStyle = label.lineColor ?? style.color; context.lineWidth = style.lineWidth;
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
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = labelColor;
  const previousSpacing = context.letterSpacing;
  if (label.letterSpacing !== undefined) context.letterSpacing = `${label.letterSpacing}px`;
  if (label.orientation === 'line') {
    context.save(); context.translate(geometry.label.x, geometry.label.y); context.rotate(dimensionLabelAngle(annotation.from, annotation.to, label));
    label.runs.forEach((run) => { context.font = run.font; context.fillText(run.text, run.x, run.y); }); context.restore();
  } else label.runs.forEach((run) => { context.font = run.font; context.fillText(run.text, geometry.label.x + run.x, geometry.label.y + run.y); });
  context.letterSpacing = previousSpacing;
  context.textAlign = 'start'; context.textBaseline = 'alphabetic';
  return { kind: annotation.kind, from: annotation.from, to: annotation.to, labelColor, extensions: { from: dimensionExtensionPoint(annotation, 'from', productRect), to: dimensionExtensionPoint(annotation, 'to', productRect) }, label: { x: geometry.label.x - labelWidth / 2, y: geometry.label.y - textHeight / 2, width: labelWidth, height: textHeight } };
}

export function SingleWorkbench({ onBack, initialProject, initialDraftSlot, templateId = 'sofa-single' }: { onBack: () => void; initialProject?: ProjectLaunch<WorkbenchDraft>; initialDraftSlot?: string; templateId?: SingleTemplateId }) {
  const rules: SingleTemplateRules = SINGLE_TEMPLATE_RULES[templateId];
  const formatFields = rules.formatFields;
  const OptionsEditor = rules.OptionsEditor;
  const CanvasOptionsEditor = rules.CanvasOptionsEditor;
  const [canvasOptionsPreview, setCanvasOptionsPreview] = useState<SingleTemplateOptions>();
  const [canvasOptionsStatus, setCanvasOptionsStatus] = useState('');
  const [canvasOptionsEpoch, setCanvasOptionsEpoch] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dimensionTargets = useRef<DimensionHitTarget[]>([]);
  const [selection, setSelection] = useState<'product' | DimensionKind>();
  const [dimensionOwner, setDimensionOwner] = useState('main');
  const displayedProductRect = useRef<Rect>(rules.layout([0, 0, 0], rules.createOptions()).productArea);
  const autoScene = useRef<{ productRect: Rect; annotations: MeasuredDimensionAnnotation[]; safeArea: Rect } | undefined>(undefined);
  const appliedAdjustment = useRef<SubjectAdjustment>(DEFAULT_SUBJECT_ADJUSTMENT);
  const microInteraction = useRef<MicroInteraction | undefined>(undefined);
  const requestedPreview = useRef<SubjectAdjustment | undefined>(undefined);
  const [productPreview, setProductPreview] = useState<SubjectAdjustment>();
  const suppressCanvasClick = useRef(false);
  const draftReady = useRef(false);
  const skipNextDraftSave = useRef(false);
  const draftSaveQueue = useRef(Promise.resolve());
  const draftGeneration = useRef(0);
  const modelManuallyEdited = useRef(false);
  const [model, setModel] = useState('');
  const [modelEditing, setModelEditing] = useState(false);
  const [modelBadge, setModelBadge] = useState<Rect>(() => ({ ...rules.layout([0, 0, 0], rules.createOptions()).modelBadge, width: 0 }));
  const imageImport = useImageImport();
  const [sellingPoints, setSellingPoints] = useState(['', '', '']);
  const [options, setOptions] = useState(rules.createOptions);
  const [modelFontSize, setModelFontSize] = useState(rules.model.fontSize);
  const [modelIssue, setModelIssue] = useState<string | null>(null);
  const [sellingPointBoxes, setSellingPointBoxes] = useState(() => rules.layout([0, 0, 0], rules.createOptions()).sellingPoints);
  const [sizeInput, setSizeInput] = useState('');
  const [dimensionFields, setDimensionFields] = useState<DimensionFields>({ length: '', width: '', height: '' });
  const dimensionKinds = rules.dimensionKindsForFields?.(dimensionFields) ?? rules.dimensionKinds;
  const [image, setImage] = useState<ProductImage>();
  const [accessories, setAccessories] = useState<SingleAccessory[]>([]);
  const [selectedAccessory, setSelectedAccessory] = useState<string>();
  const [accessoryPreview, setAccessoryPreview] = useState<AccessoryPreview>();
  const canvasFonts = useCanvasFonts(rules.requiredFonts);
  const accessorySlots = useMemo(() => rules.accessories?.(options, rules.layout([0, 0, 0], options)) ?? [], [rules, options]);
  const accessoryScenes = useMemo(() => getAccessoryScenes(accessorySlots, accessories, accessoryPreview, canvasRef.current?.getContext('2d')), [accessorySlots, accessories, accessoryPreview, canvasFonts.status]);
  const accessoryScenesRef = useRef(accessoryScenes);
  accessoryScenesRef.current = accessoryScenes;
  const selectedAccessoryScene = accessoryScenes.find((scene) => scene.id === selectedAccessory);
  const accessorySelectionRect = selectedAccessoryScene?.fit === 'cover' ? selectedAccessoryScene.area : selectedAccessoryScene?.productRect;
  const [sellingPointIssue,setSellingPointIssue]=useState<string|null>(null);
  const [extraIssue, setExtraIssue] = useState('');
  const [annotations, setAnnotations] = useState<DimensionAnnotation[]>([]);
  const [draftStart, setDraftStart] = useState<Point>();
  const shiftPressed = useShiftKey();
  const [hoverPoint, setHoverPoint] = useState<Point>();
  const [reannotateKind, setReannotateKind] = useState<DimensionKind>();
  const [microAdjust, setMicroAdjust] = useState(false);
  const [subjectAdjustment, setSubjectAdjustment] = useState<SubjectAdjustment>(DEFAULT_SUBJECT_ADJUSTMENT);
  const [microProductRect, setMicroProductRect] = useState<Rect>();
  const [draftStatus, setDraftStatus] = useState('正在恢复操作现场…');
  const [draftSlot, setDraftSlot] = useState(initialProject ? projectDraftSlot('single', initialProject.projectId) : initialDraftSlot ?? templateDraftSlot(templateId));
  const dimensions = dimensionsFromFields(dimensionFields, rules.precision, rules.allowDimensionText);
  const displayedSellingPoints = rules.visibleSellingPoints(sellingPoints, options);
  const unmarkedKinds = dimensionKinds.filter((kind) => !annotations.some((annotation) => annotation.kind === kind));
  const dimensionAccessory = accessoryScenes.find((scene) => scene.id === dimensionOwner);
  const selectedFields = dimensionAccessory?.dimensions?.fields ?? dimensionFields;
  const selectedAnnotations = dimensionAccessory?.dimensions?.annotations ?? annotations;
  const selectedKinds = dimensionAccessory?.dimensions ? Object.keys(dimensionsFromFields(selectedFields)) as DimensionKind[] : dimensionKinds;
  const activeTask = reannotateKind ? dimensionTask(dimensionsFromFields(selectedFields, rules.precision, rules.allowDimensionText), reannotateKind) : null;
  const dimensionEditor = useDimensionEditing(canvasRef, (ownerId, change) => {
    if (ownerId !== 'main' && rules.changeAccessoryDimensions) {
      const slot = accessorySlots.find((item) => item.id === ownerId);
      if (!slot?.dimensions) return;
      const nextOptions = rules.changeAccessoryDimensions(options, ownerId, slot.dimensions.fields, change.annotations);
      const nextAccessories = accessories.map((item) => item.id === ownerId ? { ...item, adjustment: change.adjustment } : item);
      history.commit({ ...currentHistoryState(), options: nextOptions, accessories: nextAccessories });
      setOptions(nextOptions); setAccessories(nextAccessories); return;
    }
    history.commit({ ...currentHistoryState(), annotations: change.annotations, subjectAdjustment: change.adjustment });
    setAnnotations(change.annotations);
    setSubjectAdjustment(change.adjustment);
  }, changeDimensionLabel);
  function changeDimensionLabel(target: DimensionHitTarget, changes: DimensionLabelAdjustment) {
    if (target.ownerId !== 'main') {
      const slot = accessorySlots.find((item) => item.id === target.ownerId);
      if (!slot?.dimensions || !rules.changeAccessoryDimensions) return;
      const next = slot.dimensions.annotations.map((item) => item.kind === target.kind ? { ...item, ...changes } : item);
      if (JSON.stringify(next) === JSON.stringify(slot.dimensions.annotations)) return;
      const nextOptions = rules.changeAccessoryDimensions(options, target.ownerId, slot.dimensions.fields, next);
      history.commit({ ...currentHistoryState(), options: nextOptions }); setOptions(nextOptions);
    } else {
      const next = annotations.map((item) => item.kind === target.kind ? { ...item, ...changes } : item);
      if (JSON.stringify(next) === JSON.stringify(annotations)) return;
      history.commit({ ...currentHistoryState(), annotations: next }); setAnnotations(next);
    }
  }
  const validation = validateSingleWorkbench({
    model,
    hasImage: Boolean(image),
    dimensionFields,
    annotations,
    annotationInProgress: Boolean(reannotateKind || draftStart),
    sellingPoints: displayedSellingPoints,
    allowDimensionText: rules.allowDimensionText,
    sellingPointIssue,
    fontIssue: canvasFonts.issue,
  });
  const issues = [...validation.blockers, ...rules.exportIssues(dimensionFields, sizeInput, options, modelIssue), ...(extraIssue ? [extraIssue] : []), ...accessorySlots.filter((slot) => !accessories.some((item) => item.id === slot.id && item.image)).map((slot) => `请上传${slot.label} PNG`)];

  function currentDraft(): WorkbenchDraft {
    return {
      version: 1,
      templateId,
      model,
      modelManuallyEdited: modelManuallyEdited.current,
      sellingPoints,
      ...rules.saveOptions(options),
      sizeInput,
      dimensionFields,
      annotations,
      subjectAdjustment,
      image: image ? { name: image.name, blob: image.blob } : undefined,
      ...(accessories.length ? { accessories: accessories.map(({ id, adjustment, image: accessoryImage }) => ({ id, adjustment, image: accessoryImage ? { name: accessoryImage.name, blob: accessoryImage.blob } : undefined })) } : {}),
    };
  }

  function currentHistoryState(): SingleHistoryState {
    return {
      model,
      modelManuallyEdited: modelManuallyEdited.current,
      sellingPoints,
      options,
      sizeInput,
      dimensionFields,
      image,
      accessories,
      annotations,
      subjectAdjustment,
    };
  }

  function applyHistoryState(state: SingleHistoryState) {
    setCanvasOptionsPreview(undefined);
    setCanvasOptionsStatus('');
    setCanvasOptionsEpoch((current) => current + 1);
    cancelMicroAdjustment();
    dimensionEditor.clear();
    setSelection(undefined);
    modelManuallyEdited.current = state.modelManuallyEdited;
    setModel(state.model);
    setSellingPoints(state.sellingPoints);
    setOptions(state.options);
    setSizeInput(state.sizeInput);
    setDimensionFields(state.dimensionFields);
    setImage(state.image);
    setAccessories(state.accessories);
    setSelectedAccessory(undefined);
    setAnnotations(state.annotations);
    setSubjectAdjustment(state.subjectAdjustment);
    appliedAdjustment.current = state.subjectAdjustment;
    setDraftStart(undefined);
    setHoverPoint(undefined);
    setReannotateKind(undefined);
    setMicroAdjust(false);
    microInteraction.current = undefined;
  }

  async function applyProjectDraft(draft: WorkbenchDraft, recoveryDrafts: WorkbenchDraft[] = []) {
    imageImport.cancel();
    const restoredImage = draft.image ? await productImageFromBlob(draft.image.blob, draft.image.name) : undefined;
    const restoredAccessories = await Promise.all((draft.accessories ?? []).map(async (item) => ({ ...item, image: item.image ? await productImageFromBlob(item.image.blob, item.image.name) : undefined })));
    const toState = (value: WorkbenchDraft): SingleHistoryState => ({
      model: value.model,
      modelManuallyEdited: value.modelManuallyEdited,
      sellingPoints: value.sellingPoints.slice(0, 3).concat(['', '', '']).slice(0, 3),
      options: rules.restoreOptions(value),
      sizeInput: value.sizeInput,
      dimensionFields: value.dimensionFields,
      image: value.image ? restoredImage : undefined,
      accessories: (value.accessories ?? []).map((item) => ({ ...item, image: item.image ? restoredAccessories.find((current) => current.id === item.id)?.image : undefined })),
      annotations: value.annotations,
      subjectAdjustment: value.subjectAdjustment,
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
    kind: 'single',
    templateId,
    enabled: draftReady.current,
    draft: currentDraft(),
    initialProject,
    onOpen: async (draft, projectId) => {
      const slot = projectDraftSlot('single', projectId);
      draftGeneration.current += 1;
      await draftSaveQueue.current;
      if (!draftSlot.startsWith('project:')) await saveDraft(currentDraft(), draftSlot);
      skipNextDraftSave.current = true;
      setDraftSlot(slot);
      const recovery = await loadRecoveryHistory(slot, draft);
      await applyProjectDraft(draft, recovery);
      setDraftStatus('已打开独立项目现场');
    },
    onProjectIdChange: async (projectId) => {
      const slot = projectDraftSlot('single', projectId);
      if (slot === draftSlot) return;
      draftGeneration.current += 1;
      setDraftSlot(slot);
      await draftSaveQueue.current;
      await saveDraft(currentDraft(), slot);
      if (!draftSlot.startsWith('project:')) await clearDraft(draftSlot);
    },
  });

  useEffect(() => {
    let cancelled = false;
    const initialDraft = initialProject?.draft;
    const loading = initialDraft ? Promise.resolve(initialDraft) : loadDraft(draftSlot) as Promise<WorkbenchDraft | null>;
    loading.then(async (draft) => {
      if (cancelled) return;
      if (!draft) {
        draftReady.current = true;
        setDraftStatus('填写内容后自动保留现场');
        return;
      }
      const recovery = await loadRecoveryHistory(draftSlot, draft);
      await applyProjectDraft(draft, recovery);
      if (cancelled) return;
      draftReady.current = true;
      setDraftStatus(initialDraft ? '已打开独立项目现场' : '已恢复上次操作现场');
    }).catch(() => {
      if (cancelled) return;
      draftReady.current = true;
      setDraftStatus('操作现场恢复失败，新修改仍会自动保存');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const generation = draftGeneration.current;
    const timer = window.setTimeout(() => {
      const snapshot = currentDraft();
      setDraftStatus('正在自动保存…');
      draftSaveQueue.current = draftSaveQueue.current
        .then(() => generation === draftGeneration.current ? saveDraft(snapshot, draftSlot) : undefined)
        .then(() => {
          if (generation === draftGeneration.current) setDraftStatus(hasDraftContent(snapshot) ? '操作现场已自动保存' : '空白现场不保留缓存');
        })
        .catch(() => {
          if (generation === draftGeneration.current) setDraftStatus('自动保存失败，请保留当前页面');
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [model, sellingPoints, options, sizeInput, dimensionFields, annotations, subjectAdjustment, image, accessories, draftSlot]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const context = canvas.getContext('2d'); if (!context) return;
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    applyTemplateSellingPointFont(context, rules.sellingPoints);
    const pointWidths = displayedSellingPoints.map((text) => context.measureText(text).width);
    const layout = rules.layout(pointWidths, options, context);
    setSellingPointIssue(rules.sellingPointIssue(pointWidths, layout));
    setExtraIssue(rules.extraIssues?.(context, options, layout, dimensionFields).join('；') ?? '');
    setSellingPointBoxes((current) => current.length === layout.sellingPoints.length && layout.sellingPoints.every((box, index) => sameRect(current[index], box)) ? current : layout.sellingPoints);

    context.letterSpacing = `${rules.model.letterSpacing ?? 0}px`;
    const measuredBadge = rules.modelBadge(context, model, layout, options);
    const { box: badge, text: modelText } = measuredBadge;
    if (measuredBadge.lines && layout.subjectSafeArea.y < badge.y + badge.height + 30) {
      const delta = badge.y + badge.height + 30 - layout.subjectSafeArea.y;
      layout.subjectSafeArea = { ...layout.subjectSafeArea, y: layout.subjectSafeArea.y + delta, height: layout.subjectSafeArea.height - delta };
    }
    setModelFontSize(measuredBadge.fontSize);
    setModelIssue(measuredBadge.issue);
    setModelBadge((current) => sameRect(current, badge) ? current : badge);
    context.beginPath(); context.fillStyle = rules.model.background;
    context.roundRect(badge.x, badge.y, badge.width, badge.height, rules.model.radius); context.fill();
    context.fillStyle = rules.model.color; context.textBaseline = rules.model.baseline;
    if (measuredBadge.lines) measuredBadge.lines.forEach((text, index) => context.fillText(text, badge.x + rules.model.paddingX, badge.y + 25 + index * 50));
    else context.fillText(modelText, badge.x + rules.model.paddingX, badge.y + rules.model.textY);
    context.letterSpacing = '0px';
    context.textBaseline = 'alphabetic';

    let baseProductRect: Rect = layout.productArea;
    if (image) {
      const area = layout.productArea;
      const source=image.visible;
      const scale = Math.min(area.width / source.width, area.height / source.height);
      const width = source.width * scale, height = source.height * scale;
      baseProductRect = { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
    }

    const currentAnnotations = updateAnnotationValues(rules.dimensionKindsForFields ? annotations.filter((annotation) => dimensionKinds.includes(annotation.kind)) : annotations, dimensions);
    const baseAnnotations = currentAnnotations.map((annotation) => annotationFromProduct(annotation, subjectAdjustment.dimensionFrame ?? baseProductRect));
    const measuredAnnotations = baseAnnotations.map((annotation) => ({
      annotation, labelSize: rules.dimensionLabel(context, annotation, dimensionFields, options),
    }));
    const fitted = fitAnnotatedProduct(baseProductRect, measuredAnnotations, layout.subjectSafeArea, subjectAdjustment.dimensionFrame);
    const fittedMeasured = fitted.annotations.map((annotation, index) => ({
      annotation,
      labelSize: measuredAnnotations[index].labelSize,
    }));
    const adjusted = productPreview ? previewAnnotatedProduct(fitted.productRect, fittedMeasured, productPreview) : adjustAnnotatedProduct(
      fitted.productRect,
      fittedMeasured,
      layout.subjectSafeArea,
      subjectAdjustment,
    );
    const productRect = adjusted.productRect;
    autoScene.current = { productRect: fitted.productRect, annotations: fittedMeasured, safeArea: layout.subjectSafeArea };
    appliedAdjustment.current = adjusted.adjustment;
    displayedProductRect.current = productRect;
    setMicroProductRect((current) => sameRect(current, productRect) ? current : productRect);
    if (image) {
      const source = image.visible;
      context.drawImage(image.element,source.x,source.y,source.width,source.height,productRect.x,productRect.y,productRect.width,productRect.height);
    }

    drawAccessoryScenes(context, accessoryScenes);
    applyTemplateSellingPointFont(context, rules.sellingPoints);
    layout.sellingPoints.forEach((box, index) => {
      context.beginPath(); context.strokeStyle = rules.sellingPoints.color; context.lineWidth = rules.sellingPoints.borderWidth;
      context.roundRect(box.x, box.y, box.width, box.height, rules.sellingPoints.radius); context.stroke();
      const text = sellingPoints[index]; if (!text) return;
      const textWidth = context.measureText(text).width;
      context.save();context.beginPath();context.roundRect(box.x+rules.sellingPoints.borderWidth,box.y+rules.sellingPoints.borderWidth,box.width-rules.sellingPoints.borderWidth*2,box.height-rules.sellingPoints.borderWidth*2,rules.sellingPoints.clipRadius);context.clip();
      context.fillStyle = rules.sellingPoints.color; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(text, box.x + box.width / 2, box.y + box.height / 2);
      context.restore();context.textAlign = 'start'; context.textBaseline = 'alphabetic';
      void textWidth;
    });

    dimensionEditor.scenes.current = { main: {
      productRect, baseProductRect, fitArea: layout.subjectSafeArea, safeArea: layout.subjectSafeArea, adjustment: adjusted.adjustment,
      annotations: adjusted.annotations.map((annotation, index) => ({ annotation, labelSize: measuredAnnotations[index].labelSize })),
    } };
    dimensionTargets.current = adjusted.annotations.filter((annotation) => dimensionOwner !== 'main' || annotation.kind !== reannotateKind)
      .map((annotation) => ({ ...drawDimension(context, dimensionEditor.display('main', annotation), subjectAdjustment.dimensionFrame ?? productRect, rules.dimensionLabel(context, annotation, dimensionFields, options), rules), ownerId: 'main' }));
    for (const scene of accessoryScenes) {
      if (!scene.dimensions) continue;
      dimensionEditor.scenes.current[scene.id] = { productRect: scene.productRect, baseProductRect: scene.sourceBase, fitArea: scene.area, safeArea: scene.area, adjustment: scene.adjustment,
        annotations: scene.annotations.map((annotation, i) => ({ annotation, labelSize: scene.baseAnnotations[i].labelSize })) };
      dimensionTargets.current.push(...scene.annotations.filter((annotation) => dimensionOwner !== scene.id || annotation.kind !== reannotateKind).map((annotation) => ({
        ...drawDimension(context, dimensionEditor.display(scene.id, annotation), scene.adjustment.dimensionFrame ?? scene.productRect, scene.dimensions!.label(context, annotation), rules), ownerId: scene.id,
      })));
    }
    dimensionEditor.updateTargets(dimensionTargets.current);
    const note = typeof rules.note === 'function' ? rules.note(options, layout) : rules.note;
    if (note) {
      context.save();
      context.font = note.font; context.fillStyle = note.color;
      context.textAlign = 'start'; context.textBaseline = 'alphabetic';
      context.fillText(note.text, note.x, note.y);
      context.restore();
    }
    if (rules.drawExtras) {
      context.save();
      rules.drawExtras(context, canvasOptionsPreview ?? options, layout, image ? productRect : undefined, accessoryScenes, dimensionFields);
      context.restore();
    }
    if (draftStart && hoverPoint && activeTask) {
      const markingRect = dimensionAccessory ? dimensionAccessory.adjustment.dimensionFrame ?? dimensionAccessory.productRect : subjectAdjustment.dimensionFrame ?? productRect;
      const preview = {
        ...activeTask,
        from: pointFromProduct(draftStart, markingRect),
        to: snapDimensionPoint(pointFromProduct(draftStart, markingRect), pointFromProduct(hoverPoint, markingRect), shiftPressed),
      };
      drawDimension(context, preview, markingRect, dimensionAccessory?.dimensions?.label(context, preview) ?? rules.dimensionLabel(context, preview, dimensionFields, options), rules);
    }
  }, [model, sellingPoints, options, canvasOptionsPreview, image, accessories, accessoryScenes, annotations, dimensionFields, draftStart, hoverPoint, activeTask, reannotateKind, subjectAdjustment, productPreview, canvasFonts.status, dimensionEditor.preview, shiftPressed, dimensionOwner]);

  function canvasPoint(event: React.MouseEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * CANVAS_SIZE / rect.width, y: (event.clientY - rect.top) * CANVAS_SIZE / rect.height };
  }

  function canvasPointFromClient(clientX: number, clientY: number): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) * CANVAS_SIZE / rect.width, y: (clientY - rect.top) * CANVAS_SIZE / rect.height };
  }

  function applyRequestedAdjustment(requested: SubjectAdjustment) {
    requestedPreview.current = requested;
    const ownerId = microInteraction.current?.ownerId;
    if (ownerId) setAccessoryPreview({ id: ownerId, adjustment: requested });
    else setProductPreview(requested);
  }

  function interactionScene() {
    const ownerId = microInteraction.current?.ownerId;
    if (!ownerId) return autoScene.current;
    const scene = accessoryScenesRef.current.find((item) => item.id === ownerId);
    return scene ? { productRect: scene.base, annotations: scene.baseAnnotations, safeArea: scene.area } : undefined;
  }

  function beginMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = canvasPointFromClient(event.clientX, event.clientY);
    if (draftStart || reannotateKind) return;
    const dimension = hitTestDimension(point, dimensionTargets.current, 8 * CANVAS_SIZE / event.currentTarget.getBoundingClientRect().width);
    if (dimension) {
      event.preventDefault();
      selectDimension(dimension.kind, dimension.ownerId);
      if (dimension.part === 'label') dimensionEditor.setTextTarget(dimension);
      else dimensionEditor.setLabelTarget(undefined);
      suppressCanvasClick.current = true;
      return;
    }
    const accessory = accessoryScenes.find((scene) => pointInAccessoryClip(point, scene) && pointHitsProductSilhouette(point, scene.productRect, scene.image.silhouette));
    if (accessory) {
      clearSelection();
      setSelectedAccessory(accessory.id);
      suppressCanvasClick.current = true;
      microInteraction.current = { mode: 'move', ownerId: accessory.id, start: point, adjustment: accessory.adjustment };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    const product = displayedProductRect.current;
    if (!image || !pointHitsProductSilhouette(point, product, image.silhouette)) { clearSelection(); return; }
    dimensionEditor.clear();
    setSelectedAccessory(undefined);
    setSelection('product');
    setMicroAdjust(true);
    suppressCanvasClick.current = true;
    microInteraction.current = { mode: 'move', start: point, adjustment: appliedAdjustment.current };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function replaceSelectedImage(event: React.MouseEvent<HTMLCanvasElement>) {
    if (selection !== 'product' || !image || !pointHitsProductSilhouette(canvasPoint(event), displayedProductRect.current, image.silhouette)) return;
    const input = imageInputRef.current;
    if (!input) return;
    event.preventDefault();
    microInteraction.current = undefined;
    input.value = '';
    input.click();
  }

  function beginScale(event: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) {
    const accessory = selectedAccessoryScene;
    const scene = accessory ? { productRect: accessory.base } : autoScene.current;
    if ((!accessory && (!microAdjust || !image)) || !scene || draftStart) return;
    const opposite = oppositeCorner(corner);
    const rect = accessorySelectionRect ?? displayedProductRect.current;
    const anchor = rectCorner(rect, opposite);
    const anchorBase = accessory?.fit === 'cover' ? {
      x: scene.productRect.x + (anchor.x - accessory.productRect.x) / accessory.adjustment.scale,
      y: scene.productRect.y + (anchor.y - accessory.productRect.y) / accessory.adjustment.scale,
    } : rectCorner(scene.productRect, opposite);
    const movingCorner = rectCorner(rect, corner);
    microInteraction.current = {
      mode: 'scale',
      ownerId: accessory?.id,
      anchor,
      anchorBase,
      startDistance: Math.hypot(movingCorner.x - anchor.x, movingCorner.y - anchor.y),
      adjustment: accessory?.adjustment ?? appliedAdjustment.current,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function continueMicroAdjustment(event: React.PointerEvent<HTMLDivElement>) {
    const interaction = microInteraction.current;
    const scene = interactionScene();
    if (!interaction || !scene) return;
    const point = canvasPointFromClient(event.clientX, event.clientY);
    if (interaction.mode === 'move') {
      applyRequestedAdjustment({
        ...interaction.adjustment,
        offsetX: interaction.adjustment.offsetX + point.x - interaction.start.x,
        offsetY: interaction.adjustment.offsetY + point.y - interaction.start.y,
      });
      return;
    }
    const distance = Math.hypot(point.x - interaction.anchor.x, point.y - interaction.anchor.y);
    const scale = interaction.adjustment.scale * Math.max(distance / interaction.startDistance, 0.01);
    applyRequestedAdjustment({
      ...interaction.adjustment,
      scale,
      offsetX: interaction.anchor.x - scene.productRect.x - (interaction.anchorBase.x - scene.productRect.x) * scale,
      offsetY: interaction.anchor.y - scene.productRect.y - (interaction.anchorBase.y - scene.productRect.y) * scale,
    });
  }

  function cancelMicroAdjustment() {
    microInteraction.current = undefined;
    requestedPreview.current = undefined;
    setProductPreview(undefined);
    setAccessoryPreview(undefined);
  }

  function finishMicroAdjustment(event: React.PointerEvent<HTMLDivElement>) {
    if (!microInteraction.current) return;
    continueMicroAdjustment(event);
    const scene = interactionScene(), requested = requestedPreview.current;
    if (scene && requested) {
      const ownerId = microInteraction.current?.ownerId;
      if (ownerId) {
        const accessory = accessoryScenesRef.current.find((item) => item.id === ownerId)!;
        const result = adjustAccessoryProduct(scene.productRect, accessory, requested, accessory.baseAnnotations);
        const next = accessories.map((item) => item.id === ownerId ? { ...item, adjustment: result.adjustment } : item);
        history.commit({ ...currentHistoryState(), accessories: next });
        setAccessories(next);
      } else {
        const result = adjustAnnotatedProduct(scene.productRect, scene.annotations, scene.safeArea, requested);
        history.commit({ ...currentHistoryState(), subjectAdjustment: result.adjustment });
        setSubjectAdjustment(result.adjustment);
      }
    }
    cancelMicroAdjustment();
  }

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') cancelMicroAdjustment(); };
    window.addEventListener('keydown', cancel);
    window.addEventListener('blur', cancelMicroAdjustment);
    return () => { window.removeEventListener('keydown', cancel); window.removeEventListener('blur', cancelMicroAdjustment); };
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = '';
    await imageImport.run(file, (nextImage) => {
      const scene = dimensionEditor.scenes.current.main;
      const fixed = image && scene ? changeDimensionLink(scene, true, annotations) : undefined;
      clearSelection();
      setMicroAdjust(false);
      if (fixed) setAnnotations(fixed.annotations);
      setSubjectAdjustment({ ...DEFAULT_SUBJECT_ADJUSTMENT, ...(fixed ? { dimensionFrame: fixed.adjustment.dimensionFrame } : {}) });
      microInteraction.current = undefined;
      setModel((current) => resolveModelOnUpload(current, modelManuallyEdited.current, file.name, rules.filenameName));
      setImage(nextImage);
    });
  }

  async function uploadAccessory(id: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = '';
    await imageImport.run(file, (nextImage) => {
      const scene = dimensionEditor.scenes.current[id];
      const fixed = scene ? changeDimensionLink(scene, true) : undefined;
      const slot = accessorySlots.find((item) => item.id === id);
      if (fixed && slot?.dimensions && rules.changeAccessoryDimensions) setOptions(rules.changeAccessoryDimensions(options, id, slot.dimensions.fields, fixed.annotations));
      clearSelection();
      setAccessories((current) => [...current.filter((item) => item.id !== id), { id, image: nextImage, adjustment: { ...DEFAULT_ACCESSORY_ADJUSTMENT, ...(fixed ? { dimensionFrame: fixed.adjustment.dimensionFrame } : {}) } }]);
      setSelectedAccessory(id);
    }, accessorySlots.find((slot) => slot.id === id)?.fit !== 'cover');
  }

  function adjustAccessory(requested: SubjectAdjustment) {
    const scene = selectedAccessoryScene; if (!scene) return;
    const adjusted = adjustAccessoryProduct(scene.base, scene, requested, scene.baseAnnotations).adjustment;
    setAccessories((current) => current.map((item) => item.id === scene.id ? { ...item, adjustment: adjusted } : item));
  }

  function markDimension(event: React.MouseEvent<HTMLCanvasElement>) {
    if (suppressCanvasClick.current) { suppressCanvasClick.current = false; return; }
    if (!image || microAdjust || !activeTask) return;
    const rect = dimensionAccessory ? dimensionAccessory.adjustment.dimensionFrame ?? dimensionAccessory.productRect : subjectAdjustment.dimensionFrame ?? displayedProductRect.current;
    const raw = canvasPoint(event);
    const point = pointRelativeToProduct(draftStart ? snapDimensionPoint(pointFromProduct(draftStart, rect), raw, event.shiftKey) : raw, rect);
    if (!draftStart) { setDraftStart(point); setHoverPoint(point); return; }
    if (dimensionAccessory?.dimensions && rules.changeAccessoryDimensions) {
      const next = completeDimension(selectedAnnotations, dimensionsFromFields(selectedFields, rules.precision, rules.allowDimensionText), draftStart, point, reannotateKind);
      setOptions(rules.changeAccessoryDimensions(options, dimensionOwner, selectedFields, next));
    } else setAnnotations((current) => completeDimension(current, dimensions, draftStart, point, reannotateKind));
    setReannotateKind(undefined);
    setDraftStart(undefined); setHoverPoint(undefined);
  }

  function changeQuickDimensions(value: string) {
    setSizeInput(value);
    const parsed = rules.parseQuickDimensions(value);
    if (parsed) setDimensionFields(parsed);
  }

  function changeDimensionField(kind: DimensionKind, value: string) {
    if (dimensionAccessory?.dimensions && rules.changeAccessoryDimensions) {
      setOptions(rules.changeAccessoryDimensions(options, dimensionOwner, { ...selectedFields, [kind]: value }, selectedAnnotations)); return;
    }
    const next = { ...dimensionFields, [kind]: value };
    setDimensionFields(next);
    setSizeInput(formatFields(next));
  }

  function startReannotation(kind: DimensionKind, ownerId = 'main') {
    const accessory = accessoryScenes.find((scene) => scene.id === ownerId);
    if (!(accessory?.image ?? image) || dimensionsFromFields(accessory?.dimensions?.fields ?? dimensionFields, rules.precision, rules.allowDimensionText)[kind] === undefined) return;
    suppressCanvasClick.current = false;
    setDimensionOwner(ownerId);
    dimensionEditor.clear();
    setSelectedAccessory(undefined);
    setSelection(kind);
    setMicroAdjust(false);
    setReannotateKind(kind);
    setDraftStart(undefined);
    setHoverPoint(undefined);
  }

  function clearSelection() {
    cancelMicroAdjustment();
    dimensionEditor.clear();
    setSelection(undefined);
    setDimensionOwner('main');
    setSelectedAccessory(undefined);
    setMicroAdjust(false);
    setReannotateKind(undefined);
    setDraftStart(undefined);
    setHoverPoint(undefined);
    microInteraction.current = undefined;
  }

  function selectDimension(kind: DimensionKind, ownerId = dimensionOwner) {
    if (selection === kind && dimensionOwner === ownerId) return;
    clearSelection();
    setDimensionOwner(ownerId);
    setSelection(kind);
  }

  function resetSubjectAdjustment() {
    const next = { ...DEFAULT_SUBJECT_ADJUSTMENT, ...(subjectAdjustment.dimensionFrame ? { dimensionFrame: subjectAdjustment.dimensionFrame } : {}) };
    appliedAdjustment.current = next;
    setSubjectAdjustment(next);
    microInteraction.current = undefined;
  }

  function setDimensionFixed(ownerId: string, fixed: boolean) {
    const scene = dimensionEditor.scenes.current[ownerId];
    if (!scene || Boolean(scene.adjustment?.dimensionFrame) === fixed) return;
    cancelMicroAdjustment();
    dimensionEditor.clear();
    const change = changeDimensionLink(scene, fixed, ownerId === 'main' ? annotations : accessorySlots.find((item) => item.id === ownerId)?.dimensions?.annotations);
    if (ownerId === 'main') {
      history.commit({ ...currentHistoryState(), annotations: change.annotations, subjectAdjustment: change.adjustment });
      setAnnotations(change.annotations); setSubjectAdjustment(change.adjustment);
    } else {
      const slot = accessorySlots.find((item) => item.id === ownerId);
      if (!slot?.dimensions || !rules.changeAccessoryDimensions) return;
      const nextOptions = rules.changeAccessoryDimensions(options, ownerId, slot.dimensions.fields, change.annotations);
      const nextAccessories = accessories.map((item) => item.id === ownerId ? { ...item, adjustment: change.adjustment } : item);
      history.commit({ ...currentHistoryState(), options: nextOptions, accessories: nextAccessories });
      setOptions(nextOptions); setAccessories(nextAccessories);
    }
  }

  async function clearOperationSite() {
    if (!window.confirm('确定清空当前操作现场吗？上传的产品图、输入内容、尺寸标注和微调位置都会被清除。')) return;
    clearSelection();
    draftGeneration.current += 1;
    skipNextDraftSave.current = true;
    modelManuallyEdited.current = false;
    setModel('');
    imageImport.cancel();
    setSellingPoints(['', '', '']);
    setOptions(rules.createOptions());
    setSizeInput('');
    setDimensionFields(EMPTY_DIMENSION_FIELDS);
    setAnnotations([]);
    setImage(undefined);
    setAccessories([]);
    setMicroAdjust(false);
    setSubjectAdjustment(DEFAULT_SUBJECT_ADJUSTMENT);
    setMicroProductRect(undefined);
    setReannotateKind(undefined);
    setDraftStart(undefined);
    setHoverPoint(undefined);
    appliedAdjustment.current = DEFAULT_SUBJECT_ADJUSTMENT;
    microInteraction.current = undefined;
    setDraftStatus('正在清空操作现场…');
    try {
      await draftSaveQueue.current.catch(() => undefined);
      await clearDraft(draftSlot);
      setDraftStatus('当前操作现场已清空');
    } catch {
      setDraftStatus('操作现场清空失败');
    }
  }

  async function saveBeforeDesktopExit() {
    await draftSaveQueue.current.catch(() => undefined);
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
    await draftSaveQueue.current.catch(() => undefined);
    if (draftReady.current) await saveDraft(currentDraft(), draftSlot).catch(() => undefined);
    await project.flush().catch(() => undefined);
    onBack();
  }

  function exportJpg() {
    if (canvasOptionsPreview) { alert('请先结束画布编辑，再导出图片'); return; }
    if (issues.length) { alert(issues.join('\n')); return; }
    void exportCanvasJpg(canvasRef.current!, rules.exportFileName?.(model, options) ?? `${model}-SKU.jpg`).catch((error) => { setDraftStatus(error.message); if (isDesktop()) alert(error.message); });
  }

  const hasAnyDimension = Object.keys(dimensions).length > 0;
  const subjectAdjusted = Math.abs(subjectAdjustment.scale - 1) > 0.0001
    || Math.abs(subjectAdjustment.offsetX) > 0.01
    || Math.abs(subjectAdjustment.offsetY) > 0.01;
  const hasOperationSite = Boolean(model || image || accessories.length || sizeInput || annotations.length || sellingPoints.some(Boolean) || subjectAdjusted || rules.hasOptions(options));
  const inputSlots: InputSlots = {
    main: (fields?: ReactNode) => <InputCard title="主产品" selected={selection === 'product'}
      onSelect={() => { if (image) { clearSelection(); setSelection('product'); setMicroAdjust(true); } }}
      image={<InputImage image={image} icon={inputImageIcon(templateId)} label="上传产品 PNG" inputRef={imageInputRef} onChange={upload} disabled={imageImport.busy}/>}
      quickFields={<label className="input-quick-size">快速尺寸<input value={sizeInput} onChange={(event) => changeQuickDimensions(event.target.value)} placeholder={rules.sizePlaceholder}/></label>}>
      <label>产品型号{rules.model.multiline ? <textarea aria-label="产品型号" rows={1} value={model} onChange={(event) => { modelManuallyEdited.current = true; setModel(event.target.value); }}/> : <input value={model} onChange={(event) => { modelManuallyEdited.current = true; setModel(event.target.value); }}/>}</label>
      {unmarkedKinds.length > 0 && <div className="quick-annotation-actions">{unmarkedKinds.map((kind) => <button type="button" key={kind} disabled={!image || dimensions[kind] === undefined} onClick={() => startReannotation(kind)}>标注{DIMENSION_LABELS[kind]}</button>)}</div>}
      {image && <InputDetails title="图片与文件名"><p className="file-caption">{image.name}</p><FilenameNameNotice filename={image.name} policy={rules.filenameName} current={model} manuallyEdited={modelManuallyEdited.current} onApply={(value) => { modelManuallyEdited.current = true; setModel(value); }}/></InputDetails>}
      {imageImport.error && <p className="hint" role="alert">{imageImport.error}</p>}
      {fields}
      {displayedSellingPoints.length > 0 && <InputDetails title={displayedSellingPoints.length === 2 ? '两个卖点' : '三个卖点'} open>{rules.sellingPointHint && <p className="hint">{rules.sellingPointHint}</p>}{displayedSellingPoints.map((point, index) => <label key={index}>卖点 {index + 1}<input value={point} maxLength={rules.sellingPoints.maxLength} onChange={(event) => setSellingPoints((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}/></label>)}</InputDetails>}
    </InputCard>,
    accessory: (id, fields) => {
      const slot = accessorySlots.find((candidate) => candidate.id === id);
      if (!slot) return null;
      const item = accessories.find((accessory) => accessory.id === id);
      return <InputCard key={id} title={slot.label} selected={selectedAccessory === id} className="accessory-input-card"
        onSelect={() => { if (item?.image) { clearSelection(); setSelectedAccessory(id); } }}
        image={<InputImage image={item?.image} icon={inputImageIcon(templateId, id)} label={`上传${slot.label} PNG`} onChange={(event) => void uploadAccessory(id, event)} disabled={imageImport.busy}/>}
        quickFields={<span className="input-card-status">{item?.image ? '已上传' : '待上传图片'}</span>}>
        {fields}
        {item?.image && <InputDetails title="图片与位置"><p className="file-caption">{item.image.name}</p><button type="button" className="quick-secondary" onClick={() => { clearSelection(); setSelectedAccessory(id); }}>微调{slot.label}</button></InputDetails>}
      </InputCard>;
    },
  };
  const taskStatus = !hasAnyDimension ? '可直接点击产品并拖动；在左侧输入尺寸后选择标注' : nextDimension(dimensions, annotations) ? `尺寸已填写，在左侧选择要标注的${rules.dimensionPrompt}` : '已有尺寸均已完成，点击尺寸可微调，拖动产品可移动';
  const canvasStatus = dimensionEditor.textTarget ? '正在编辑尺寸：Enter 保存，Esc 取消，点击其他位置保存' : dimensionEditor.labelMoving ? '移动尺寸文字：拖动高亮文字，点空白或再次点击按钮结束，Esc 取消' : dimensionEditor.preview ? (dimensionEditor.preview.endpoint === 'line' ? '正在整体移动标注：Shift 限定方向，松开后整体适配安全范围，Esc 取消' : dimensionEditor.mode === 'extensions' ? '正在调整辅助线：松开后整体适配安全范围，Esc 取消' : '正在调整端点：Shift 锁定水平／垂直，松开后整体适配安全范围') : productPreview ? (subjectAdjustment.dimensionFrame ? '正在调整产品，尺寸线保持固定；Esc 取消' : '正在调整产品和标注：松开后整体适配安全范围，Esc 取消') : microAdjust ? '微调中：拖动产品移动，拖动四角等比例缩放，双击产品换图' : draftStart ? `正在标注${activeTask?.label ?? ''}：移动鼠标并点击第二端点，按住 Shift 锁定水平／垂直` : reannotateKind ? `正在标注${DIMENSION_LABELS[reannotateKind]}：点击第一端点` : selection && selection !== 'product' ? `已选中${DIMENSION_LABELS[selection]}：${dimensionEditor.mode === 'extensions' ? '拖动菱形调整辅助线，可用方向键微调' : '拖动高亮线条整体移动，圆点调整端点；Shift 限定方向'}` : taskStatus;
  return <main className="workbench-shell">
    <WorkbenchHeader title={TEMPLATES[templateId].title} subtitle={`${templateKindLabel(templateId)}模板 / 1440 × 1440`} saveStatus={project.status} pendingCount={issues.length + validation.warnings.length} exportLabel="导出 JPG" onBack={backToTemplates} onExport={exportJpg} projectFileName={project.fileName} onOpenProject={() => void project.open()} onSaveProject={() => void project.save()} onSaveProjectAs={() => void project.saveAs()} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo}/>
    <section className="workbench-layout">
      <QuickInputPanel>
        {rules.inputLayout === 'products' && OptionsEditor ? <OptionsEditor value={options} onChange={setOptions} input={inputSlots}/> : inputSlots.main(<>
          {OptionsEditor && <OptionsEditor value={options} onChange={setOptions} input={inputSlots}/>}
          {!rules.inputLayout && accessorySlots.map((slot) => inputSlots.accessory(slot.id))}
        </>)}
        <details className="workspace-management"><summary>现场管理</summary><p className="draft-status">{draftStatus}</p><p className="draft-status">{project.status}</p><button type="button" className="clear-site" disabled={!hasOperationSite} onClick={clearOperationSite}>清空当前现场</button></details>
      </QuickInputPanel>
      <section className="canvas-panel">
        <CanvasStage title="成品画布" status={imageImport.error || canvasOptionsStatus || (selectedAccessoryScene ? `${accessoryPreview ? '正在调整' : '已选中'}${selectedAccessoryScene.label}：拖动移动，四角缩放，松开适配安全范围；右侧可填写位置，Esc 取消拖动` : modelEditing ? '正在编辑产品型号：直接输入文字，按回车或点击其他位置结束编辑' : canvasStatus)}>
          <div className="canvas-wrap" onPointerMove={continueMicroAdjustment} onPointerUp={finishMicroAdjustment} onPointerCancel={cancelMicroAdjustment} onLostPointerCapture={cancelMicroAdjustment}>
            <canvas className={microAdjust ? 'micro-adjusting' : ''} ref={canvasRef} width="1440" height="1440" onClick={markDimension} onDoubleClick={replaceSelectedImage} onPointerDown={beginMove} onMouseMove={(event) => draftStart && setHoverPoint(pointRelativeToProduct(canvasPoint(event), (dimensionAccessory ? dimensionAccessory.adjustment.dimensionFrame ?? dimensionAccessory.productRect : subjectAdjustment.dimensionFrame ?? displayedProductRect.current)))}/>
            <CanvasModelEditor multiline={rules.model.multiline} box={modelBadge} value={model} fontSize={modelFontSize} fontFamily={rules.model.fontFamily} color={rules.model.color} background={rules.model.background} paddingX={rules.model.editorPaddingX ?? rules.model.paddingX} radius={rules.model.radius} letterSpacing={rules.model.letterSpacing} onFocus={() => { clearSelection(); setModelEditing(true); }} onBlur={() => setModelEditing(false)} onChange={(value) => { modelManuallyEdited.current = true; setModel(value); }}/>
            <CanvasDimensionEditor editor={dimensionEditor} precision={rules.precision} allowCompound={rules.allowCompound} allowDimensionText={rules.allowDimensionText} selected={selection && selection !== 'product' && !reannotateKind ? { ownerId: dimensionOwner, kind: selection } : undefined}
              value={dimensionEditor.textTarget ? selectedFields[dimensionEditor.textTarget.kind] : ''} onChange={(target, value) => {
                if (target.ownerId !== 'main' && rules.changeAccessoryDimensions) {
                  const next = rules.changeAccessoryDimensions(options, target.ownerId, { ...selectedFields, [target.kind]: value }, selectedAnnotations);
                  history.commit({ ...currentHistoryState(), options: next }); setOptions(next); return;
                }
                const fields = { ...dimensionFields, [target.kind]: value };
                history.commit({ ...currentHistoryState(), dimensionFields: fields, sizeInput: formatFields(fields) });
                changeDimensionField(target.kind, value);
              }}/>
            {CanvasOptionsEditor && <CanvasOptionsEditor key={canvasOptionsEpoch} value={options} canvasRef={canvasRef} productRect={image ? microProductRect : undefined} disabled={Boolean(reannotateKind || draftStart)}
              onActivate={clearSelection} onPreview={setCanvasOptionsPreview} onStatusChange={setCanvasOptionsStatus}
              onCommit={(next) => { history.commit({ ...currentHistoryState(), options: next }); setOptions(next); }}/>}
            {sellingPointBoxes.map((box, index) => <CanvasSellingPointEditor key={index} box={box} index={index} textStyle={rules.sellingPoints} value={sellingPoints[index]} maxLength={rules.sellingPoints.maxLength} onFocus={clearSelection} onChange={(value) => setSellingPoints((current) => current.map((point, pointIndex) => pointIndex === index ? value : point))}/>)}
            {microAdjust && image && microProductRect && <div className="product-selection" style={{ left: `${microProductRect.x / CANVAS_SIZE * 100}%`, top: `${microProductRect.y / CANVAS_SIZE * 100}%`, width: `${microProductRect.width / CANVAS_SIZE * 100}%`, height: `${microProductRect.height / CANVAS_SIZE * 100}%` }}>
              {(['nw','ne','sw','se'] as ResizeCorner[]).map((corner) => <button type="button" key={corner} aria-label={`等比例缩放 ${corner}`} className={`resize-handle ${corner}`} onPointerDown={(event) => beginScale(event, corner)}/>) }
            </div>}
            {selectedAccessoryScene && accessorySelectionRect && <div className="product-selection" style={{ left: `${accessorySelectionRect.x / CANVAS_SIZE * 100}%`, top: `${accessorySelectionRect.y / CANVAS_SIZE * 100}%`, width: `${accessorySelectionRect.width / CANVAS_SIZE * 100}%`, height: `${accessorySelectionRect.height / CANVAS_SIZE * 100}%` }}>
              {(['nw', 'ne', 'sw', 'se'] as ResizeCorner[]).map((corner) => <button type="button" key={corner} aria-label={`${selectedAccessoryScene.label}等比例缩放 ${corner}`} className={`resize-handle ${corner}`} onPointerDown={(event) => beginScale(event, corner)}/>)}
            </div>}
          </div>
        </CanvasStage>
      </section>
      <WorkbenchSidebar notes={rules.productionNotes}>
        {!selection && !selectedAccessoryScene && <div className="inspector-empty"><h2>微调编辑</h2><p>点击画布组件进行微调</p></div>}
        {selectedAccessoryScene && <section className="product-inspector"><h2>{selectedAccessoryScene.label}微调</h2><p className="hint">{selectedAccessoryScene.fit === 'cover' ? '拖动调整取景，四角缩放；图片填满圆角卡片，比例可在100%–500%间调整。' : '拖动图片或四角，松开后适配本素材区域；也可直接填写位置和比例。'}</p>
          {selectedAccessoryScene.dimensions && <DimensionLinkControls fixed={Boolean(selectedAccessoryScene.adjustment.dimensionFrame)} onChange={(fixed) => setDimensionFixed(selectedAccessoryScene.id, fixed)}/>}
          {(['offsetX', 'offsetY', 'scale'] as const).map((key) => <label key={key}>{key === 'offsetX' ? '横向偏移（px）' : key === 'offsetY' ? '纵向偏移（px）' : '缩放比例（%）'}<input type="number" step={1} min={key === 'scale' ? (selectedAccessoryScene.fit === 'cover' ? 100 : 1) : undefined} max={key === 'scale' ? (selectedAccessoryScene.fit === 'cover' ? 500 : 100) : undefined} value={Math.round(selectedAccessoryScene.adjustment[key] * (key === 'scale' ? 100 : 1))} onChange={(event) => { if (event.target.value !== '' && Number.isFinite(event.target.valueAsNumber)) adjustAccessory({ ...selectedAccessoryScene.adjustment, [key]: event.target.valueAsNumber / (key === 'scale' ? 100 : 1) }); }}/></label>)}
          <button type="button" className="reset-layout" onClick={() => adjustAccessory({ ...DEFAULT_ACCESSORY_ADJUSTMENT, ...(selectedAccessoryScene.adjustment.dimensionFrame ? { dimensionFrame: selectedAccessoryScene.adjustment.dimensionFrame } : {}) })}>恢复自动布局</button>
        </section>}
        {selection === 'product' && <section className="product-inspector"><h2>产品微调</h2><DimensionLinkControls fixed={Boolean(subjectAdjustment.dimensionFrame)} onChange={(fixed) => setDimensionFixed('main', fixed)}/><p className="hint">拖动产品移动，拖动四角等比例缩放。</p><button type="button" className="reset-layout" disabled={!image || !subjectAdjusted} onClick={resetSubjectAdjustment}>恢复自动布局</button></section>}
        {selection && selection !== 'product' && <DimensionInspector allowDimensionText={rules.allowDimensionText} controls={<><DimensionLabelControls editor={dimensionEditor} annotation={selectedAnnotations.find((item) => item.kind === dimensionEditor.labelTarget?.kind)} onChange={changeDimensionLabel}/><DimensionEditMode editor={dimensionEditor}/></>} title={dimensionAccessory?.label ?? rules.inspectorTitle} kinds={selectedKinds} fields={selectedFields} annotations={selectedAnnotations} activeKind={selection} hasImage={Boolean(image)} markingKind={reannotateKind}
          onSelect={selectDimension} onChange={changeDimensionField} onAnnotate={(kind) => startReannotation(kind, dimensionOwner)}
          onCancel={() => { setReannotateKind(undefined); setDraftStart(undefined); setHoverPoint(undefined); }}/>}
      </WorkbenchSidebar>
    </section>
  </main>;
}

