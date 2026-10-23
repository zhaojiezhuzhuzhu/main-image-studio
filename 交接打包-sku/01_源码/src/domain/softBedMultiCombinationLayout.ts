import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';
import { compactFirmnessIssues, drawCompactFirmness, normalizeCompactFirmness, type CompactFirmness, type CompactFirmnessStyle } from './compactFirmness';

export type MultiBedMattress = { title: string; thickness: string; model: string; firmness: CompactFirmness };
export type SoftBedMultiOptions = { bedKind: 'standard' | 'storage'; mattressCount: 2 | 3; cabinetCount: 0 | 1 | 2; cabinetModels: [string, string]; productGap: number; noteGap: number; mattresses: [MultiBedMattress, MultiBedMattress, MultiBedMattress] };
export type SoftBedMultiDraft = WorkbenchDraft & { softBedMultiCombination?: SoftBedMultiOptions };
export const BED_MULTI_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const BED_MULTI_FIRMNESS: CompactFirmnessStyle = { bands: [{ max: 2, label: '硬' }, { max: 4, label: '偏硬' }, { max: 6, label: '适中' }, { max: 8, label: '偏软' }, { max: 10, label: '软' }],
  font: 'Montserrat, sans-serif', labelFont: '"方正兰亭中黑_GBK", sans-serif', fontSize: 20, color: '#00586d', lineColor: '#769aa7', radius: 20, lineWidth: 2, letterSpacing: -.5 };
export const BED_MULTI_NOTE = '*床头柜/床垫为推荐搭配，产品发货数量以最终下单选择为准';
export function normalizeSoftBedMulti(input: unknown): SoftBedMultiOptions {
  const value = input && typeof input === 'object' ? input as Partial<SoftBedMultiOptions> : {}, mattresses = Array.isArray(value.mattresses) ? value.mattresses : [];
  const cabinetModels = Array.isArray(value.cabinetModels) ? value.cabinetModels : [];
  const text = (raw: unknown) => typeof raw === 'string' ? raw : '';
  const gap = (raw: unknown, min: number) => typeof raw === 'number' && Number.isFinite(raw) ? Math.min(100, Math.max(min, raw)) : 40;
  return { bedKind: value.bedKind === 'storage' ? 'storage' : 'standard', mattressCount: value.mattressCount === 2 ? 2 : 3,
    cabinetCount: value.cabinetCount === 0 || value.cabinetCount === 1 ? value.cabinetCount : 2, cabinetModels: [text(cabinetModels[0]), text(cabinetModels[1])],
    productGap: gap(value.productGap, 30), noteGap: gap(value.noteGap, 15), mattresses: [0, 1, 2].map((i) => ({ title: text(mattresses[i]?.title), thickness: text(mattresses[i]?.thickness), model: text(mattresses[i]?.model), firmness: normalizeCompactFirmness(mattresses[i]?.firmness) })) as SoftBedMultiOptions['mattresses'] };
}
export function softBedMultiAreas(options: SingleTemplateOptions) {
  const value = normalizeSoftBedMulti(options.softBedMultiCombination), rowBottom = 1363 - value.noteGap, rowTop = rowBottom - 350, bedBottom = rowTop - value.productGap;
  const width = (1380 - (value.mattressCount - 1) * 30) / value.mattressCount;
  return { rowTop, rowBottom, bedBottom,
    mattresses: Array.from({ length: value.mattressCount }, (_, i) => { const x = 30 + i * (width + 30); return { x, width,
      image: { x: x + 10, y: rowTop + 130, width: width - 20, height: 125 }, firmness: { x: x + 10, y: rowTop + 265, width: width - 20, height: 85 } }; }),
    cabinets: Array.from({ length: value.cabinetCount }, (_, i) => { const y = value.cabinetCount === 2 ? 445 + i * 235 : bedBottom - 255; return {
      badge: { x: 1090, y, width: 320, height: 52 }, image: { x: 1120, y: y + 70, width: 270, height: value.cabinetCount === 2 ? Math.min(155, bedBottom - y - 70) : 185 } }; }) };
}
export function getSoftBedMultiLayout(_widths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeSoftBedMulti(options.softBedMultiCombination), area = softBedMultiAreas(options), width = value.cabinetCount ? 990 : 1380;
  return { modelBadge: { x: 60, y: 370, height: 52 }, productArea: { x: 170, y: 490, width: width - 200, height: area.bedBottom - 520 },
    subjectSafeArea: { x: 30, y: 450, width, height: area.bedBottom - 450 }, sellingPoints: [] };
}
export function softBedMultiAccessories(options: SingleTemplateOptions) {
  const areas = softBedMultiAreas(options);
  return [...areas.cabinets.map((item, i) => ({ id: `soft-bed-multi-cabinet-${i + 1}`, label: `搭配床头柜${i + 1}`, area: item.image })),
    ...areas.mattresses.map((item, i) => ({ id: `soft-bed-multi-mattress-${i + 1}`, label: `搭配床垫${i + 1}`, area: item.image }))];
}
export function softBedMultiModel(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '床型号及规格'; context.font = `33px ${BED_MULTI_FONT}`; const width = context.measureText(text).width + 36;
  return { text, fontSize: 33, box: { ...layout.modelBadge, width }, issue: /[\r\n\t]/.test(text) || width > 960 ? '床型号及规格过长，请保留完整内容并核对，不能缩小字号' : null };
}
export function parseSoftBedMultiDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate'); return fields && Object.values(fields).every((value) => !value.includes('~') && value.split('/').length <= 3) ? fields : null;
}
export function softBedMultiDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const values = (parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? String(annotation.value)).split('/');
  const parts = values.flatMap((value, i) => [...(i ? [{ text: ' / ', size: 25 }] : []), { text: `${value}cm`, size: 35 }]);
  const measured = parts.map((part) => { const font = `${part.size}px Montserrat, sans-serif`; context.font = font; return { ...part, font, width: context.measureText(part.text).width }; });
  const width = measured.reduce((sum, part) => sum + part.width, 0); let x = -width / 2;
  return { width, height: 35, runs: measured.map((part) => { const run = { text: part.text, font: part.font, x: x + part.width / 2, y: 0 }; x += part.width; return run; }) };
}
function lineIssue(context: TextMeasure, text: string, width: number, name: string) {
  context.font = `33px ${BED_MULTI_FONT}`;
  return !text.trim() ? `请填写${name}，以真实产品资料为准` : /[\r\n\t]/.test(text) || context.measureText(text).width > width ? `${name}完整内容超出单行区域，请核对；不能缩小字号或截断` : null;
}
export function softBedMultiIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeSoftBedMulti(options.softBedMultiCombination), areas = softBedMultiAreas(options), issues: Array<string | null> = [];
  areas.cabinets.forEach((_area, i) => issues.push(lineIssue(context, value.cabinetModels[i], 284, `床头柜${i + 1}型号及规格`)));
  areas.mattresses.forEach((area, i) => {
    const mattress = value.mattresses[i], thickness = parseDimensionText(mattress.thickness, 'truncate');
    if (!thickness || /[~/]/.test(thickness.text)) issues.push(`请填写床垫${i + 1}的单个厚度（cm）`);
    issues.push(lineIssue(context, mattress.title, area.width - 56, `床垫${i + 1}名称`), lineIssue(context, `${mattress.title} | ${thickness?.text ?? mattress.thickness}cm`, area.width - 56, `床垫${i + 1}名称与厚度`), lineIssue(context, mattress.model, area.width - 20, `床垫${i + 1}型号`));
    issues.push(...compactFirmnessIssues(mattress.firmness, area.firmness, BED_MULTI_FIRMNESS).map((issue) => `床垫${i + 1}：${issue}`));
  });
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('床体长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else {
      const annotation = { kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', value: parsed.value } as DimensionAnnotation;
      if (softBedMultiDimensionLabel(context, annotation, fields).width > 850) issues.push('床体尺寸完整文字超出标注区域，请核对规格');
    }
  }
  return issues.filter((issue): issue is string => Boolean(issue));
}
export function drawSoftBedMulti(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const value = normalizeSoftBedMulti(options.softBedMultiCombination), areas = softBedMultiAreas(options);
  context.save(); context.letterSpacing = '0px'; context.textAlign = 'center'; context.textBaseline = 'middle';
  const badge = (text: string, center: number, y: number, maximum: number) => {
    context.font = `33px ${BED_MULTI_FONT}`; const width = Math.min(maximum, context.measureText(text).width + 36);
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(center - width / 2, y, width, 52, 8); context.fill(); context.fillStyle = '#ffffff'; context.fillText(text, center, y + 26);
  };
  areas.cabinets.forEach((area, i) => badge(value.cabinetModels[i], area.badge.x + area.badge.width / 2, area.badge.y, area.badge.width));
  areas.mattresses.forEach((area, i) => {
    const mattress = value.mattresses[i], thickness = parseDimensionText(mattress.thickness, 'truncate')?.text ?? mattress.thickness;
    badge(`${mattress.title} | ${thickness}cm`, area.x + area.width / 2, areas.rowTop, area.width - 20);
    context.font = `33px ${BED_MULTI_FONT}`; context.fillStyle = '#000000'; context.fillText(mattress.model, area.x + area.width / 2, areas.rowTop + 84);
    drawCompactFirmness(context, mattress.firmness, area.firmness, BED_MULTI_FIRMNESS);
  });
  context.font = '42px "方正兰亭准黑_GBK", sans-serif'; context.fillStyle = '#5e5e5e'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(BED_MULTI_NOTE, 720, 1363); context.restore();
}
