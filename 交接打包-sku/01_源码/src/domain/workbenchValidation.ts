import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { dimensionsFromFields, type DimensionFields } from './dimensions';

export type WorkbenchValidation = {
  blockers: string[];
  warnings: string[];
  completed: number;
  total: number;
};

function selectedKinds(fields: DimensionFields, allowText = false): DimensionKind[] {
  const dimensions = dimensionsFromFields(fields, 'round', allowText);
  return (['length', 'width', 'height', 'headWidth', 'footWidth', 'diameter', 'secondaryLength', 'secondaryWidth', 'secondaryHeight'] as DimensionKind[]).filter((kind) => dimensions[kind] !== undefined);
}

function missingAnnotations(fields: DimensionFields, annotations: DimensionAnnotation[], allowText = false): DimensionKind[] {
  const marked = new Set(annotations.map((annotation) => annotation.kind));
  return selectedKinds(fields, allowText).filter((kind) => !marked.has(kind));
}

const DIMENSION_LABEL: Record<DimensionKind, string> = { length: '长', width: '宽', height: '高', headWidth: '床头宽', footWidth: '床尾宽', diameter: '直径', secondaryLength: '副柜长', secondaryWidth: '副柜宽', secondaryHeight: '副柜高' };

export function validateSingleWorkbench(input: {
  model: string;
  hasImage: boolean;
  dimensionFields: DimensionFields;
  annotations: DimensionAnnotation[];
  annotationInProgress: boolean;
  sellingPoints: string[];
  allowDimensionText?: boolean;
  sellingPointIssue?: string | null;
  fontIssue?: string;
}): WorkbenchValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!input.hasImage) blockers.push('请上传透明 PNG 产品图');
  if (!input.model.trim()) blockers.push('请填写产品型号');
  const missing = missingAnnotations(input.dimensionFields, input.annotations, input.allowDimensionText);
  if (missing.length) blockers.push(`请完成已填写尺寸的标注：${missing.map((kind) => DIMENSION_LABEL[kind]).join('、')}`);
  if (input.annotationInProgress) blockers.push('尺寸标注尚未完成，请完成或取消本次标注后再导出');
  if (input.sellingPointIssue) blockers.push(input.sellingPointIssue);
  if (input.fontIssue) blockers.push(input.fontIssue);
  const filledSellingPoints = input.sellingPoints.filter((value) => value.trim()).length;
  if (filledSellingPoints > 0 && filledSellingPoints < input.sellingPoints.length) warnings.push('卖点已部分填写；可以导出，未填写的位置将保持空白');

  const dimensionsComplete = selectedKinds(input.dimensionFields, input.allowDimensionText).length === 0 || (!missing.length && !input.annotationInProgress);
  const sellingComplete = filledSellingPoints === 0 || filledSellingPoints === input.sellingPoints.length;
  const ready = blockers.length === 0;
  return {
    blockers,
    warnings,
    completed: [input.hasImage, Boolean(input.model.trim()), dimensionsComplete, sellingComplete, ready].filter(Boolean).length,
    total: 5,
  };
}

export function validateCombinationWorkbench(input: {
  model: string;
  hasMainImage: boolean;
  mainDimensionFields: DimensionFields;
  mainAnnotations: DimensionAnnotation[];
  mainAnnotationInProgress: boolean;
  optionalSizes: Array<{
    hasImage: boolean;
    dimensionFields: DimensionFields;
    annotations: DimensionAnnotation[];
    annotationInProgress: boolean;
  }>;
  noteEnabled: boolean;
  note: string;
  layoutIssues: string[];
  fontIssue?: string;
}): WorkbenchValidation {
  const blockers: string[] = [];
  if (!input.hasMainImage) blockers.push('请上传主产品透明 PNG');
  if (!input.model.trim()) blockers.push('请填写产品型号');
  const mainMissing = missingAnnotations(input.mainDimensionFields, input.mainAnnotations);
  if (mainMissing.length) blockers.push(`请完成主产品已填写尺寸的标注：${mainMissing.map((kind) => DIMENSION_LABEL[kind]).join('、')}`);
  if (input.mainAnnotationInProgress) blockers.push('主产品尺寸标注尚未完成');
  if (!input.optionalSizes.length) blockers.push('请添加至少一个其他可选尺寸');
  input.optionalSizes.forEach((item, index) => {
    if (!item.hasImage) blockers.push(`规格 ${index + 1} 请上传或复用产品图`);
    const selected = selectedKinds(item.dimensionFields);
    if (!selected.length) blockers.push(`规格 ${index + 1} 请填写至少一项尺寸`);
    const missing = missingAnnotations(item.dimensionFields, item.annotations);
    if (missing.length) blockers.push(`规格 ${index + 1} 请完成已填写尺寸的标注：${missing.map((kind) => DIMENSION_LABEL[kind]).join('、')}`);
    if (item.annotationInProgress) blockers.push(`规格 ${index + 1} 的尺寸标注尚未完成`);
  });
  if (input.noteEnabled && !input.note.trim()) blockers.push('已开启底部备注，请填写备注文字或关闭备注');
  blockers.push(...input.layoutIssues);
  if (input.fontIssue) blockers.push(input.fontIssue);

  const mainDimensionsComplete = selectedKinds(input.mainDimensionFields).length === 0
    || (!mainMissing.length && !input.mainAnnotationInProgress);
  const optionalComplete = input.optionalSizes.length > 0 && input.optionalSizes.every((item) => {
    const selected = selectedKinds(item.dimensionFields);
    return item.hasImage && selected.length > 0 && !missingAnnotations(item.dimensionFields, item.annotations).length && !item.annotationInProgress;
  });
  const noteComplete = !input.noteEnabled || Boolean(input.note.trim());
  const baseComplete = input.hasMainImage && Boolean(input.model.trim());
  const ready = blockers.length === 0;
  return {
    blockers,
    warnings: [],
    completed: [baseComplete, mainDimensionsComplete, optionalComplete, noteComplete, ready].filter(Boolean).length,
    total: 5,
  };
}
