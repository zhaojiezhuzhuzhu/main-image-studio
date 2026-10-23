import type { DimensionAnnotation, DimensionKind } from './dimensionAnnotations';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';
import { editedFunctionalCurveBounds, normalizeFunctionalCurve, type FunctionalSofaFeature } from './functionalSofaCurve';

export const FUNCTIONAL_SOFA_DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];
export const FUNCTIONAL_SOFA_MODEL_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const FUNCTIONAL_SOFA_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const FUNCTIONAL_SOFA_DIMENSION_FONT = 'Montserrat, Arial, sans-serif';
export type FunctionalSofaOptions = { sellingPointCount: 2 | 3; rocking: FunctionalSofaFeature; rotation: FunctionalSofaFeature };
export type FunctionalSofaDraft = WorkbenchDraft & { functionalSofa?: FunctionalSofaOptions };
export type FunctionalSofaFeatureKind = 'rocking' | 'rotation';

export function defaultFunctionalSofaFeature(kind: FunctionalSofaFeatureKind): FunctionalSofaFeature {
  // 第18页曲线位置由示例推导；角度和功能文案必须依据当前产品资料填写。
  return { enabled: false, text: '', x: kind === 'rocking' ? 855 : 535, y: kind === 'rocking' ? 435 : 970 };
}

function normalizeFeature(value: unknown, kind: FunctionalSofaFeatureKind): FunctionalSofaFeature {
  const saved = value && typeof value === 'object' ? value as Partial<FunctionalSofaFeature> : {};
  const defaults = defaultFunctionalSofaFeature(kind);
  const curve = normalizeFunctionalCurve(saved.curve);
  return { enabled: saved.enabled === true, text: typeof saved.text === 'string' ? saved.text : '',
    x: typeof saved.x === 'number' && Number.isFinite(saved.x) ? saved.x : defaults.x,
    y: typeof saved.y === 'number' && Number.isFinite(saved.y) ? saved.y : defaults.y, ...(curve ? { curve } : {}) };
}

export function normalizeFunctionalSofaOptions(value: unknown): SingleTemplateOptions & FunctionalSofaOptions {
  const saved = value && typeof value === 'object' ? value as Partial<FunctionalSofaOptions> : {};
  return { sizeLabels: ['', ''], dimensionGap: 0, sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3,
    rocking: normalizeFeature(saved.rocking, 'rocking'), rotation: normalizeFeature(saved.rotation, 'rotation') };
}

export function getFunctionalSofaSingleLayout(pointWidths: number[]): SingleLayout {
  // 第15、18页1440方图：型号固定，卖点y1182/高98；主体与标注共同适配中间安全区。
  const side = 70, availableWidth = 1300, gap = 30;
  let widths = pointWidths.map((width) => Math.max(388, width + 52));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) + 4 > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 52));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1182, width, height: 98 }; x += width + gap; return box; });
  return { modelBadge: { x: side, y: 250, height: 78 },
    productArea: { x: 420, y: 440, width: 730, height: 610 },
    subjectSafeArea: { x: side, y: 350, width: availableWidth, height: 782 }, sellingPoints,
    issue: total + 4 > availableWidth ? '卖点文案总宽度超出安全区，请缩短文案；卖点位置与框高保持不变' : null };
}

export function functionalSofaModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号';
  context.font = canvasFontFromPs(60, FUNCTIONAL_SOFA_MODEL_FONT);
  const width = context.measureText(text).width + 56;
  return { text, fontSize: 60, box: { ...layout.modelBadge, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '型号请填写在一行内'
      : layout.modelBadge.x + width > 940 ? '型号过长，已进入右上禁区，请核对型号内容' : null };
}

export function parseFunctionalSofaDimensions(input: string): DimensionFields | null {
  return parseDimensionFields(input, 'truncate');
}

const dimensionWidths = { length: 720, width: 720, height: 230 };
function dimensionLines(context: TextMeasure, value: string, kind: 'length' | 'width' | 'height') {
  context.font = canvasFontFromPs(46, FUNCTIONAL_SOFA_DIMENSION_FONT);
  const lines: string[] = [];
  let line = '';
  for (const token of (`${value}cm`).match(/[^~/]+[~/]?/g) ?? []) {
    if (line && context.measureText(line + token).width > dimensionWidths[kind]) { lines.push(line); line = ''; }
    line += token;
  }
  if (line) lines.push(line);
  return lines;
}

export function functionalSofaDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const kind = annotation.kind === 'height' ? 'height' : annotation.kind === 'width' ? 'width' : 'length';
  const value = parseDimensionText(fields[kind], 'truncate')?.text ?? String(annotation.value);
  const lines = dimensionLines(context, value, kind);
  const font = canvasFontFromPs(46, FUNCTIONAL_SOFA_DIMENSION_FONT);
  return { width: Math.max(...lines.map((line) => context.measureText(line).width)), height: 46 + (lines.length - 1) * 50,
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * 50 })) };
}

export function functionalSofaDimensionIssue(fields: DimensionFields): string | null {
  const names = { length: '长', width: '宽', height: '高' };
  const measure: TextMeasure = { font: '', measureText: (text) => ({ width: Array.from(text).length * 46 * .7 } as TextMetrics) };
  for (const kind of ['length', 'width', 'height'] as const) {
    if (!fields[kind].trim()) return `请填写功能单人沙发${names[kind]}尺寸`;
    const value = parseDimensionText(fields[kind], 'truncate');
    if (!value) return `功能单人沙发${names[kind]}尺寸无效，范围用 ~、并列规格用 / 分隔（cm）`;
    const lines = dimensionLines(measure, value.text, kind);
    if (lines.length > 4 || lines.some((line) => measure.measureText(line).width > dimensionWidths[kind])) {
      return `功能单人沙发${names[kind]}尺寸过长，折行后仍超出标注容量，请核对完整数据`;
    }
  }
  return null;
}

export function functionalSofaFeatureBounds(kind: FunctionalSofaFeatureKind, feature: FunctionalSofaFeature, textWidth: number) {
  return editedFunctionalCurveBounds(kind, feature, textWidth);
}

export function functionalSofaFeatureIssues(kind: FunctionalSofaFeatureKind, feature: FunctionalSofaFeature): string[] {
  if (!feature.enabled) return [];
  const name = kind === 'rocking' ? '摇动' : '旋转';
  if (!feature.text.trim()) return [`请填写${name}功能说明，或关闭该标注`];
  if (/[\r\n\t\u2028\u2029]/.test(feature.text)) return [`${name}功能说明请填写单行文字`];
  // 无Canvas上下文的导出检查按每字符一个em留足空间，不截断实际文案。
  const bounds = functionalSofaFeatureBounds(kind, feature, Array.from(feature.text).length * 46);
  return !Number.isFinite(feature.x) || !Number.isFinite(feature.y) || bounds.x < 70 || bounds.x + bounds.width > 1370 || bounds.y < 350 || bounds.y + bounds.height > 1132
    ? [`${name}功能标注超出安全区，请调整位置或缩短说明，避免覆盖型号及卖点`] : [];
}
