import { bedsideDimensionIssues, bedsideDimensionSlot, normalizeBedsideDimensions, type BedsideDimensions } from './bedsideDimensions';
import { multilineModelBadge } from './multilineModelBadge';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';
import { compactFirmnessIssues, drawCompactFirmness, normalizeCompactFirmness, type CompactFirmness, type CompactFirmnessStyle } from './compactFirmness';

export type MultiBedMattress = { title: string; thickness: string; model: string; firmness: CompactFirmness };
export type WoodBedMultiOptions = { cabinetDimensions: [BedsideDimensions, BedsideDimensions]; bedKind: 'standard' | 'storage'; mattressCount: 2 | 3; cabinetCount: 0 | 1 | 2; cabinetModels: [string, string]; productGap: number; noteGap: number; mattresses: [MultiBedMattress, MultiBedMattress, MultiBedMattress] };
export type WoodBedMultiDraft = WorkbenchDraft & { woodBedMultiCombination?: WoodBedMultiOptions };
export const WOOD_BED_MULTI_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const WOOD_BED_MULTI_FIRMNESS: CompactFirmnessStyle = { bands: [{ max: 2, label: '硬' }, { max: 4, label: '偏硬' }, { max: 6, label: '适中' }, { max: 8, label: '偏软' }, { max: 10, label: '软' }],
  font: 'Montserrat, sans-serif', labelFont: '"方正兰亭中黑_GBK", sans-serif', fontSize: 20, color: '#00586d', lineColor: '#769aa7', radius: 20, lineWidth: 2, letterSpacing: -.5 };
export const WOOD_BED_MULTI_NOTE = '*床头柜/床垫为推荐搭配，产品发货数量以最终下单选择为准';
export function normalizeWoodBedMulti(input: unknown): WoodBedMultiOptions {
  const value = input && typeof input === 'object' ? input as Partial<WoodBedMultiOptions> : {}, mattresses = Array.isArray(value.mattresses) ? value.mattresses : [];
  const cabinetModels = Array.isArray(value.cabinetModels) ? value.cabinetModels : [];
  const text = (raw: unknown) => typeof raw === 'string' ? raw : '';
  const gap = (raw: unknown, min: number) => typeof raw === 'number' && Number.isFinite(raw) ? Math.min(100, Math.max(min, raw)) : 40;
  return { cabinetDimensions: [normalizeBedsideDimensions(value.cabinetDimensions?.[0]), normalizeBedsideDimensions(value.cabinetDimensions?.[1])], bedKind: value.bedKind === 'storage' ? 'storage' : 'standard', mattressCount: value.mattressCount === 2 ? 2 : 3,
    cabinetCount: value.cabinetCount === 0 || value.cabinetCount === 1 ? value.cabinetCount : 2, cabinetModels: [text(cabinetModels[0]), text(cabinetModels[1])],
    productGap: gap(value.productGap, 30), noteGap: gap(value.noteGap, 15), mattresses: [0, 1, 2].map((i) => ({ title: text(mattresses[i]?.title), thickness: text(mattresses[i]?.thickness), model: text(mattresses[i]?.model), firmness: normalizeCompactFirmness(mattresses[i]?.firmness) })) as WoodBedMultiOptions['mattresses'] };
}
export function woodBedMultiAreas(options: SingleTemplateOptions) {
  const value = normalizeWoodBedMulti(options.woodBedMultiCombination), rowBottom = 1363 - value.noteGap, rowTop = rowBottom - 350, bedBottom = rowTop - value.productGap;
  const width = (1380 - (value.mattressCount - 1) * 30) / value.mattressCount;
  return { rowTop, rowBottom, bedBottom,
    mattresses: Array.from({ length: value.mattressCount }, (_, i) => { const x = 30 + i * (width + 30); return { x, width,
      image: { x: x + 10, y: rowTop + 130, width: width - 20, height: 125 }, firmness: { x: x + 10, y: rowTop + 265, width: width - 20, height: 85 } }; }),
    cabinets: Array.from({ length: value.cabinetCount }, (_, i) => { const rowHeight = (rowTop - 15 - 370) / Math.max(1, value.cabinetCount), y = 370 + i * rowHeight; return {
      badge: { x: 960, y: y + rowHeight - 100, width: 450, height: 50 }, image: { x: 990, y, width: 390, height: rowHeight - 115 } }; }) };
}
export function getWoodBedMultiLayout(_widths: number[], options: SingleTemplateOptions): SingleLayout {
  const value = normalizeWoodBedMulti(options.woodBedMultiCombination), area = woodBedMultiAreas(options), width = value.cabinetCount ? 930 : 1380;
  return { modelBadge: { x: 60, y: 370, height: 52 }, productArea: { x: 170, y: 490, width: width - 200, height: area.bedBottom - 520 },
    subjectSafeArea: { x: 30, y: 500, width, height: area.bedBottom - 500 }, sellingPoints: [] };
}
export function woodBedMultiAccessories(options: SingleTemplateOptions) {
  const areas = woodBedMultiAreas(options), value = normalizeWoodBedMulti(options.woodBedMultiCombination);
  return [...areas.cabinets.map((item, i) => ({ id: `wood-bed-multi-cabinet-${i + 1}`, label: `搭配床头柜${i + 1}`, area: item.image, dimensions: bedsideDimensionSlot(value.cabinetDimensions[i]) })),
    ...areas.mattresses.map((item, i) => ({ id: `wood-bed-multi-mattress-${i + 1}`, label: `搭配床垫${i + 1}`, area: item.image }))];
}
export function woodBedMultiModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, WOOD_BED_MULTI_FONT, 960, 20, 33);
}
export function parseWoodBedMultiDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate'); return fields && Object.values(fields).every((value) => !value.includes('~') && value.split('/').length <= 3) ? fields : null;
}
export function woodBedMultiDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const values = (parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? String(annotation.value)).split('/');
  const parts = values.flatMap((value, i) => [...(i ? [{ text: ' / ', size: 25 }] : []), { text: `${value}cm`, size: 35 }]);
  const measured = parts.map((part) => { const font = `${part.size}px Montserrat, sans-serif`; context.font = font; return { ...part, font, width: context.measureText(part.text).width }; });
  const width = measured.reduce((sum, part) => sum + part.width, 0); let x = -width / 2;
  return { width, height: 35, runs: measured.map((part) => { const run = { text: part.text, font: part.font, x: x + part.width / 2, y: 0 }; x += part.width; return run; }) };
}
function lineIssue(context: TextMeasure, text: string, width: number, name: string) {
  context.font = `33px ${WOOD_BED_MULTI_FONT}`;
  return !text.trim() ? `请填写${name}，以真实产品资料为准` : /[\r\n\t]/.test(text) || context.measureText(text).width > width ? `${name}完整内容超出单行区域，请核对；不能缩小字号或截断` : null;
}
export function woodBedMultiIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeWoodBedMulti(options.woodBedMultiCombination), areas = woodBedMultiAreas(options), issues: Array<string | null> = [];
  areas.cabinets.forEach((_area, i) => issues.push(!value.cabinetModels[i].trim() ? `请填写床头柜${i + 1}型号及规格` : multilineModelBadge(context, value.cabinetModels[i], { modelBadge: _area.badge }, WOOD_BED_MULTI_FONT, 450, 18, 33).issue, ...bedsideDimensionIssues(value.cabinetDimensions[i]).map((issue) => `第${i + 1}款：${issue}`)));
  areas.mattresses.forEach((area, i) => {
    const mattress = value.mattresses[i], thickness = parseDimensionText(mattress.thickness, 'truncate');
    if (!thickness || /[~/]/.test(thickness.text)) issues.push(`请填写床垫${i + 1}的单个厚度（cm）`);
    issues.push(lineIssue(context, mattress.title, area.width - 56, `床垫${i + 1}名称`), lineIssue(context, `${mattress.title} | ${thickness?.text ?? mattress.thickness}cm`, area.width - 56, `床垫${i + 1}名称与厚度`), lineIssue(context, mattress.model, area.width - 20, `床垫${i + 1}型号`));
    issues.push(...compactFirmnessIssues(mattress.firmness, area.firmness, WOOD_BED_MULTI_FIRMNESS).map((issue) => `床垫${i + 1}：${issue}`));
  });
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('床体长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else {
      const annotation = { kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', value: parsed.value } as DimensionAnnotation;
      if (woodBedMultiDimensionLabel(context, annotation, fields).width > 850) issues.push('床体尺寸完整文字超出标注区域，请核对规格');
    }
  }
  return issues.filter((issue): issue is string => Boolean(issue));
}
export function drawWoodBedMulti(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const value = normalizeWoodBedMulti(options.woodBedMultiCombination), areas = woodBedMultiAreas(options);
  context.save(); context.letterSpacing = '0px'; context.textAlign = 'center'; context.textBaseline = 'middle';
  const badge = (text: string, center: number, y: number, maximum: number) => {
    context.font = `33px ${WOOD_BED_MULTI_FONT}`; const width = Math.min(maximum, context.measureText(text).width + 36);
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(center - width / 2, y, width, 50, 8); context.fill(); context.fillStyle = '#ffffff'; context.fillText(text, center, y + 25);
  };
  areas.cabinets.forEach((area, i) => {
    const model = multilineModelBadge(context, value.cabinetModels[i], { modelBadge: area.badge }, WOOD_BED_MULTI_FONT, 450, 18, 33), center = area.badge.x + area.badge.width / 2;
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(center - model.box.width / 2, model.box.y, model.box.width, model.box.height, 8); context.fill(); context.fillStyle = '#ffffff';
    (model.lines ?? [model.text]).forEach((line, j) => context.fillText(line, center, model.box.y + 25 + j * 50));
  });
  areas.mattresses.forEach((area, i) => {
    const mattress = value.mattresses[i], thickness = parseDimensionText(mattress.thickness, 'truncate')?.text ?? mattress.thickness;
    badge(`${mattress.title} | ${thickness}cm`, area.x + area.width / 2, areas.rowTop, area.width - 20);
    context.font = `33px ${WOOD_BED_MULTI_FONT}`; context.fillStyle = '#000000'; context.fillText(mattress.model, area.x + area.width / 2, areas.rowTop + 84);
    drawCompactFirmness(context, mattress.firmness, area.firmness, WOOD_BED_MULTI_FIRMNESS);
  });
  context.font = '42px "方正兰亭准黑_GBK", sans-serif'; context.fillStyle = '#5e5e5e'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(WOOD_BED_MULTI_NOTE, 720, 1363); context.restore();
}
