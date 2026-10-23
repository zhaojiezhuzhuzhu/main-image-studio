import { parseDimensionText, type DimensionFields } from './dimensions';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type MattressMaterial = { text: string; textColor: 'black' | 'white' };
export type MattressSingleOptions = { headline: string; subtitle: string; firmnessValue: string; firmnessPosition: number; materials: MattressMaterial[] };
export type MattressSingleDraft = WorkbenchDraft & { mattressSingle?: MattressSingleOptions };
export const MATTRESS_TEXT_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const MATTRESS_HEADLINE_FONT = '"Montserrat Semi Bold", "方正兰亭中黑_GBK", sans-serif';
export const MATTRESS_FIRMNESS_NAMES = ['硬', '偏硬', '适中', '偏软', '软'] as const;

export function normalizeMattressSingle(value: unknown): MattressSingleOptions {
  const saved = value && typeof value === 'object' ? value as Partial<MattressSingleOptions> : {};
  const materials = Array.isArray(saved.materials) ? saved.materials : [];
  return { headline: typeof saved.headline === 'string' ? saved.headline : '', subtitle: typeof saved.subtitle === 'string' ? saved.subtitle : '',
    firmnessValue: typeof saved.firmnessValue === 'string' ? saved.firmnessValue : '',
    firmnessPosition: typeof saved.firmnessPosition === 'number' && Number.isFinite(saved.firmnessPosition) ? Math.min(100, Math.max(0, saved.firmnessPosition)) : 50,
    materials: Array.from({ length: 3 }, (_, index) => ({ text: typeof materials[index]?.text === 'string' ? materials[index].text : '', textColor: materials[index]?.textColor === 'black' ? 'black' : 'white' })) };
}

// P10 image32 明确 0<硬≤2、2<偏硬≤4、4<适中≤6、6<偏软≤8、8<软≤10。
export function mattressFirmnessBand(value: string): number | null {
  const text = value.trim();
  if (!/^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/.test(text) || Number(text) <= 0) return null;
  return Math.ceil(Number(text) / 2) - 1;
}

export function mattressFirmnessCenter(position: number): number {
  // 图示的五档等宽参考带；为圆环与端点留出60px，是实现推定。
  return 220 + Math.max(0, Math.min(100, position)) * 10;
}

export function getMattressSingleLayout(): SingleLayout {
  // P10图示外侧说明不计入1440画布，顶部327px留白；主图与厚度共用安全区。
  return { modelBadge: { x: 1000, y: 351, height: 60 }, productArea: { x: 150, y: 558, width: 965, height: 300 },
    subjectSafeArea: { x: 60, y: 545, width: 1320, height: 317 }, sellingPoints: [] };
}
export function mattressMaterialCards() {
  return Array.from({ length: 3 }, (_, index) => ({ x: 60 + index * 444, y: 1130, width: 432, height: 264 }));
}
export function mattressAccessories() {
  return mattressMaterialCards().map((area, index) => ({ id: `mattress-material-${index + 1}`, label: `材质卖点${index + 1}`, area, fit: 'cover' as const, clipRadius: 8 }));
}

export function mattressModelBadge(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '床垫型号'; context.font = '45px Montserrat, sans-serif';
  const width = context.measureText(text).width + 50;
  return { text, fontSize: 45, box: { ...layout.modelBadge, x: 1350 - width, width },
    issue: /[\r\n\t]/.test(text) || width > 350 ? '床垫型号过长或包含换行，请核对完整型号，不能缩小或截断内容' : null };
}
export function parseMattressThickness(input: string): DimensionFields | null {
  const value = parseDimensionText(input, 'truncate');
  return value && !/[~/]/.test(value.text) ? { length: '', width: '', height: value.text } : null;
}
export function mattressThicknessLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const text = `${parseDimensionText(fields.height, 'truncate')?.text ?? annotation.value}cm`;
  const font = '52px "Montserrat Semi Bold", sans-serif'; context.font = font;
  return { width: context.measureText(text).width, height: 52, letterSpacing: -1.3, runs: [{ text, font, x: 0, y: 0 }] };
}
function lineIssue(context: TextMeasure, text: string, font: string, width: number, name: string, required = true): string | null {
  context.font = font;
  if (!text.trim()) return required ? `请填写${name}，内容须依据真实产品资料` : null;
  return /[\r\n\t]/.test(text) || context.measureText(text).width > width ? `${name}需单行且不能超出规定字号区域，请核对完整内容` : null;
}
export function mattressExtraIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeMattressSingle(options.mattressSingle), band = mattressFirmnessBand(value.firmnessValue);
  const issues = [lineIssue(context, value.headline, `100px ${MATTRESS_HEADLINE_FONT}`, 900, '床垫标题'),
    lineIssue(context, value.subtitle, '33px "方正兰亭黑_GBK", sans-serif', 1250, '床垫说明', false),
    ...value.materials.map((material, index) => lineIssue(context, material.text, `35px ${MATTRESS_TEXT_FONT}`, 392, `材质卖点${index + 1}文案`))];
  if (band === null) issues.push('床垫软硬度须大于0且不超过10，最多保留1位小数');
  else if (value.firmnessPosition < band * 20 || value.firmnessPosition > (band + 1) * 20) issues.push(`${MATTRESS_FIRMNESS_NAMES[band]}指示位置须在${band * 20}%–${(band + 1) * 20}%内，请按已确认资料微调`);
  if (fields) {
    const thickness = parseMattressThickness(fields.height);
    if (!thickness) issues.push('请依据床垫信息表填写单个厚度（cm），不可根据图片推测');
    else issues.push(lineIssue(context, `${thickness.height}cm`, '52px "Montserrat Semi Bold", sans-serif', 220, '床垫厚度'));
  }
  return issues.filter((issue): issue is string => Boolean(issue));
}

export function drawMattressExtras(context: CanvasRenderingContext2D, options: SingleTemplateOptions): void {
  const value = normalizeMattressSingle(options.mattressSingle), band = mattressFirmnessBand(value.firmnessValue);
  context.save(); context.textAlign = 'left'; context.textBaseline = 'top'; context.letterSpacing = '0px';
  context.fillStyle = '#000000'; context.font = `100px ${MATTRESS_HEADLINE_FONT}`; context.fillText(value.headline, 85, 342);
  context.fillStyle = '#5e5e5e'; context.font = '33px "方正兰亭黑_GBK", sans-serif'; context.fillText(value.subtitle, 85, 472);
  const x = mattressFirmnessCenter(value.firmnessPosition), lineY = 970, outerY = 943;
  context.strokeStyle = '#769aa7'; context.lineWidth = 4.5; context.lineCap = 'round';
  context.beginPath(); context.moveTo(160, lineY); context.lineTo(1280, lineY); context.stroke();
  context.save(); context.beginPath(); context.roundRect(0, lineY, 1440, 1440 - lineY, 0); context.clip();
  context.beginPath(); context.arc(x, outerY, 53.469, 0, Math.PI * 2); context.fillStyle = '#1b576c'; context.fill();
  context.beginPath(); context.arc(x, outerY, 55.719, 0, Math.PI * 2); context.stroke(); context.restore();
  context.beginPath(); context.arc(x, 944, 49.133, 0, Math.PI * 2); context.fillStyle = '#00586d'; context.fill(); context.strokeStyle = '#ffffff'; context.lineWidth = 8; context.stroke();
  context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.letterSpacing = '-1.15px'; context.font = '46px Montserrat, sans-serif'; context.fillStyle = '#ffffff'; context.fillText(value.firmnessValue.trim(), x, 960);
  context.fillStyle = '#00586d'; context.letterSpacing = '-0.875px'; context.font = '35px "方正兰亭中黑_GBK", sans-serif'; context.fillText(band === null ? '' : MATTRESS_FIRMNESS_NAMES[band], x, 1040);
  context.fillStyle = 'rgba(0,0,0,0.5)'; context.font = '35px Montserrat, sans-serif'; context.fillText('0', 135, 941); context.fillText('10', 1305, 941);
  context.font = '32px "方正兰亭中黑_GBK", sans-serif'; context.letterSpacing = '-0.8px'; context.fillText('硬', 135, 984); context.fillText('软', 1305, 984);
  context.letterSpacing = '0px'; context.font = `35px ${MATTRESS_TEXT_FONT}`;
  mattressMaterialCards().forEach((card, index) => {
    context.save(); context.beginPath(); context.roundRect(card.x, card.y, card.width, card.height, 8); context.clip();
    context.fillStyle = 'rgba(0,0,0,0.28)'; context.beginPath(); context.roundRect(card.x, card.y + card.height - 70, card.width, 70, 0); context.fill();
    context.fillStyle = value.materials[index].textColor === 'black' ? '#000000' : '#ffffff';
    context.fillText(value.materials[index].text, card.x + card.width / 2, card.y + card.height - 25); context.restore();
  });
  context.restore();
}
