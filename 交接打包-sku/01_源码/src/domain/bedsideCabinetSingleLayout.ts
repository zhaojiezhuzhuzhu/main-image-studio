import type { DimensionFields } from './dimensions';
import { parseDimensionFields, parseDimensionText } from './dimensions';
import { canvasFontFromPs } from './typography';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export const BEDSIDE_CABINET_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const BEDSIDE_CABINET_SELLING_FONT = 'Montserrat, "方正兰亭中黑_GBK", sans-serif';
export const BEDSIDE_CABINET_QUANTITY_BADGE = { x: 1055, y: 722, width: 100, height: 100 };
export type BedsideCabinetOptions = { quantity: 1 | 2; sellingPointCount: 2 | 3 };
export type BedsideCabinetDraft = WorkbenchDraft & { bedsideCabinet?: BedsideCabinetOptions };

export function normalizeBedsideCabinetOptions(value: unknown): SingleTemplateOptions & BedsideCabinetOptions {
  const saved = value && typeof value === 'object' ? value as Partial<BedsideCabinetOptions> : {};
  return { sizeLabels: ['', ''], quantity: saved.quantity === 2 ? 2 : 1,
    sellingPointCount: saved.sellingPointCount === 2 ? 2 : 3, dimensionGap: 60 };
}

export function getBedsideCabinetSingleLayout(pointWidths: number[]): SingleLayout {
  // 第9页1440px示例：型号居中，卖点y=1262；位置与60px留白为示例推导值。
  const availableWidth = 1092, gap = 30;
  const equalWidth = (availableWidth - gap * Math.max(0, pointWidths.length - 1)) / Math.max(1, pointWidths.length);
  let widths = pointWidths.map((width) => Math.max(equalWidth, width + 50));
  if (widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1) > availableWidth) {
    widths = pointWidths.map((width) => Math.max(150, width + 50));
  }
  const total = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
  let x = (1440 - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1262, width, height: 98 }; x += width + gap; return box; });
  return {
    modelBadge: { x: 720, y: 378, height: 72 },
    productArea: { x: 420, y: 500, width: 600, height: 630 },
    // 两种数量始终预留右侧徽标位置，避免切换数量时重新排产品，也防止标注进入圆标。
    subjectSafeArea: { x: 174, y: 500, width: 850, height: 700 },
    sellingPoints,
    issue: total > availableWidth ? '卖点文案总宽度超出床头柜安全区，请调整完整文案' : null,
  };
}

export function bedsideCabinetModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '产品型号床头柜';
  context.font = canvasFontFromPs(45, BEDSIDE_CABINET_FONT);
  const width = context.measureText(text).width + 48;
  return { text, fontSize: 45, box: { ...layout.modelBadge, x: (1440 - width) / 2, width },
    issue: /[\r\n\t\u2028\u2029]/.test(text) ? '床头柜型号及规格请填写在一行内'
      : width > 1380 ? '床头柜型号及完整规格过长，45号字已超出安全区，请核对完整内容' : null };
}

function parseBedsideCabinetDimension(value: string) {
  const parsed = parseDimensionText(value, 'truncate');
  return parsed && !/[~/]/.test(parsed.text) ? parsed : null;
}

export function parseBedsideCabinetDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate');
  return fields && ['length', 'width', 'height'].every((kind) => parseBedsideCabinetDimension(fields[kind as keyof DimensionFields] ?? '')) ? fields : null;
}

export function bedsideCabinetDimensionIssue(fields: DimensionFields): string | null {
  for (const [kind, name] of [['length', '长'], ['width', '宽'], ['height', '高']] as const) {
    if (!fields[kind].trim()) return `请填写床头柜${name}尺寸，不能根据图片推测真实尺寸`;
    if (!parseBedsideCabinetDimension(fields[kind])) return `床头柜${name}尺寸无效，请填写一个正数（cm）`;
  }
  return null;
}

export function drawBedsideCabinetQuantity(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  if (options.quantity !== 2) return;
  const badge = BEDSIDE_CABINET_QUANTITY_BADGE;
  context.fillStyle = '#00586d';
  context.beginPath();
  context.roundRect(badge.x, badge.y, badge.width, badge.height, 100);
  context.fill();
  context.font = canvasFontFromPs(60, 'Montserrat, sans-serif');
  context.letterSpacing = '0px';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('x2', badge.x + badge.width / 2, badge.y + badge.height / 2);
}
