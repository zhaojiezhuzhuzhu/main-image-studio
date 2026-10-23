import { bedsideDimensionIssues, bedsideDimensionSlot, normalizeBedsideDimensions, type BedsideDimensions } from './bedsideDimensions';
import { multilineModelBadge } from './multilineModelBadge';
import { parseDimensionFields, parseDimensionText, type DimensionFields } from './dimensions';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';
import { compactFirmnessIssues, drawCompactFirmness, normalizeCompactFirmness, type CompactFirmness, type CompactFirmnessStyle } from './compactFirmness';

export type WoodBedCombinationOptions = { cabinetDimensions: BedsideDimensions; bedKind: 'standard' | 'storage'; set: 'mattress' | 'cabinet' | 'both'; productGap: number; noteGap: number; cabinetModel: string;
  mattress: { title: string; thickness: string; model: string; points: [string, string, string]; firmness: CompactFirmness } };
export type WoodBedCombinationDraft = WorkbenchDraft & { woodBedCombination?: WoodBedCombinationOptions };
export const WOOD_BED_COMBINATION_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const WOOD_BED_COMBINATION_FIRMNESS: CompactFirmnessStyle = { bands: [{ max: 2, label: '硬' }, { max: 4, label: '偏硬' }, { max: 6, label: '适中' }, { max: 8, label: '偏软' }, { max: 10, label: '软' }],
  font: 'Montserrat, sans-serif', labelFont: '"方正兰亭中黑_GBK", sans-serif', fontSize: 20, color: '#00586d', lineColor: '#769aa7', radius: 20, lineWidth: 2, letterSpacing: -.5 };
export const WOOD_BED_COMBINATION_NOTE = '*床头柜/床垫为推荐搭配，产品发货数量以最终下单选择为准';
export function normalizeWoodBedCombination(input: unknown): WoodBedCombinationOptions {
  const value = input && typeof input === 'object' ? input as Partial<WoodBedCombinationOptions> : {}, mattress = value.mattress;
  const text = (raw: unknown) => typeof raw === 'string' ? raw : '';
  const gap = (raw: unknown, min: number, fallback: number) => typeof raw === 'number' && Number.isFinite(raw) ? Math.min(160, Math.max(min, raw)) : fallback;
  const storage = value.bedKind === 'storage', points = Array.isArray(mattress?.points) ? mattress.points : [];
  return { cabinetDimensions: normalizeBedsideDimensions(value.cabinetDimensions), bedKind: storage ? 'storage' : 'standard', set: value.set === 'cabinet' || value.set === 'mattress' ? value.set : 'both',
    productGap: gap(value.productGap, 30, storage ? 30 : 100), noteGap: gap(value.noteGap, 40, storage ? 40 : 80), cabinetModel: text(value.cabinetModel),
    mattress: { title: text(mattress?.title), thickness: text(mattress?.thickness), model: text(mattress?.model), points: [0, 1, 2].map((i) => text(points[i])) as [string, string, string], firmness: normalizeCompactFirmness(mattress?.firmness) } };
}
export function woodBedCombinationAreas(options: SingleTemplateOptions) {
  const value = normalizeWoodBedCombination(options.woodBedCombination), mattress = value.set !== 'cabinet', cabinet = value.set !== 'mattress';
  const rowBottom = 1363 - value.noteGap, rowTop = rowBottom - 225, bedBottom = mattress ? rowTop - value.productGap : rowBottom;
  return { mattress, cabinet, rowTop, rowBottom, bedBottom,
    firmness: { x: 190, y: rowTop + 140, width: 460, height: 85 }, mattressImage: { x: 190, y: rowTop, width: 460, height: 125 },
    cabinetBadge: { x: 960, y: bedBottom - 100, width: 450, height: 50 }, cabinetImage: { x: 990, y: 500, width: 390, height: bedBottom - 620 } };
}
export function getWoodBedCombinationLayout(_widths: number[], options: SingleTemplateOptions): SingleLayout {
  const area = woodBedCombinationAreas(options), width = area.cabinet ? 930 : 1380;
  return { modelBadge: { x: 60, y: 370, height: 52 }, productArea: { x: 160, y: 505, width: width - 190, height: area.bedBottom - 535 },
    subjectSafeArea: { x: 30, y: 500, width, height: area.bedBottom - 500 }, sellingPoints: [] };
}
export function woodBedCombinationAccessories(options: SingleTemplateOptions) {
  const areas = woodBedCombinationAreas(options), value = normalizeWoodBedCombination(options.woodBedCombination);
  return [...(areas.cabinet ? [{ id: 'wood-bed-set-cabinet', label: '搭配床头柜', area: areas.cabinetImage, dimensions: bedsideDimensionSlot(value.cabinetDimensions) }] : []),
    ...(areas.mattress ? [{ id: 'wood-bed-set-mattress', label: '搭配床垫', area: areas.mattressImage }] : [])];
}
export function woodBedCombinationModel(context: TextMeasure, model: string, layout: SingleLayout) {
  return multilineModelBadge(context, model, layout, WOOD_BED_COMBINATION_FONT, 960, 20, 33);
}
export function parseWoodBedCombinationDimensions(input: string): DimensionFields | null {
  const fields = parseDimensionFields(input, 'truncate'); return fields && Object.values(fields).every((value) => !value.includes('~') && value.split('/').length <= 3) ? fields : null;
}
export function woodBedCombinationDimensionLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const values = (parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? String(annotation.value)).split('/');
  const parts = values.flatMap((value, i) => [...(i ? [{ text: ' / ', size: 25 }] : []), { text: `${value}cm`, size: 35 }]);
  const measured = parts.map((part) => { const font = `${part.size}px Montserrat, sans-serif`; context.font = font; return { ...part, font, width: context.measureText(part.text).width }; });
  const width = measured.reduce((sum, part) => sum + part.width, 0); let x = -width / 2;
  return { width, height: 35, runs: measured.map((part) => { const run = { text: part.text, font: part.font, x: x + part.width / 2, y: 0 }; x += part.width; return run; }) };
}
function lineIssue(context: TextMeasure, text: string, size: number, width: number, name: string) {
  context.font = `${size}px ${WOOD_BED_COMBINATION_FONT}`;
  return !text.trim() ? `请填写${name}，以真实产品资料为准` : /[\r\n\t]/.test(text) || context.measureText(text).width > width ? `${name}完整内容超出单行区域，请核对；不能缩小字号或截断` : null;
}
export function woodBedCombinationIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeWoodBedCombination(options.woodBedCombination), areas = woodBedCombinationAreas(options), issues: Array<string | null> = [];
  if (areas.cabinet) issues.push(!value.cabinetModel.trim() ? '请填写床头柜型号及规格' : multilineModelBadge(context, value.cabinetModel, { modelBadge: areas.cabinetBadge }, WOOD_BED_COMBINATION_FONT, 450, 18, 33).issue, ...bedsideDimensionIssues(value.cabinetDimensions));
  if (areas.mattress) {
    const mattress = value.mattress, thickness = parseDimensionText(mattress.thickness, 'truncate');
    if (!thickness || /[~/]/.test(thickness.text)) issues.push('请填写搭配床垫的单个厚度（cm）');
    issues.push(lineIssue(context, mattress.title, 33, 520, '床垫名称'), lineIssue(context, `${mattress.title} | ${thickness?.text ?? mattress.thickness}cm`, 33, 548, '床垫名称与厚度'), lineIssue(context, mattress.model, 28, 548, '床垫型号'));
    mattress.points.forEach((point, i) => issues.push(lineIssue(context, point, 30, 232, `床垫卖点${i + 1}`)));
    issues.push(...compactFirmnessIssues(mattress.firmness, areas.firmness, WOOD_BED_COMBINATION_FIRMNESS).map((issue) => `搭配床垫：${issue}`));
  }
  if (fields) for (const kind of ['length', 'width', 'height'] as const) {
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || parsed.text.includes('~') || parsed.text.split('/').length > 3) issues.push('床体长宽高须为正数，最多三种 / 并列规格，不使用范围');
    else {
      const annotation = { kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', value: parsed.value } as DimensionAnnotation;
      if (woodBedCombinationDimensionLabel(context, annotation, fields).width > 850) issues.push('床体尺寸完整文字超出标注区域，请核对规格');
    }
  }
  return issues.filter((issue): issue is string => Boolean(issue));
}
export function drawWoodBedCombination(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const value = normalizeWoodBedCombination(options.woodBedCombination), areas = woodBedCombinationAreas(options);
  context.save(); context.letterSpacing = '0px'; context.textAlign = 'left'; context.textBaseline = 'middle';
  const badge = (text: string, x: number, y: number, max: number) => {
    context.font = `33px ${WOOD_BED_COMBINATION_FONT}`; const width = Math.min(max, context.measureText(text).width + 36);
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(x, y, width, 50, 8); context.fill(); context.fillStyle = '#ffffff'; context.fillText(text, x + 18, y + 25);
  };
  if (areas.cabinet) {
    const model = multilineModelBadge(context, value.cabinetModel, { modelBadge: areas.cabinetBadge }, WOOD_BED_COMBINATION_FONT, 450, 18, 33);
    context.fillStyle = '#00586d'; context.beginPath(); context.roundRect(model.box.x, model.box.y, model.box.width, model.box.height, 8); context.fill(); context.fillStyle = '#ffffff';
    (model.lines ?? [model.text]).forEach((line, i) => context.fillText(line, model.box.x + 18, model.box.y + 25 + i * 50));
  }
  if (areas.mattress) {
    const y = areas.rowTop, mattress = value.mattress, thickness = parseDimensionText(mattress.thickness, 'truncate')?.text ?? mattress.thickness;
    context.fillStyle = '#eeeeee'; context.beginPath(); context.roundRect(725, y, 620, 225, 20); context.fill();
    context.beginPath(); context.moveTo(725, y + 100); context.lineTo(698, y + 120); context.lineTo(725, y + 138); context.closePath(); context.fill();
    badge(`${mattress.title} | ${thickness}cm`, 745, y + 18, 584);
    context.fillStyle = '#525054'; context.font = `28px ${WOOD_BED_COMBINATION_FONT}`; context.fillText(mattress.model, 755, y + 94);
    context.strokeStyle = '#858585'; context.lineWidth = 1; context.beginPath(); context.moveTo(755, y + 116); context.lineTo(1310, y + 116); context.stroke();
    mattress.points.forEach((point, i) => {
      const x = i === 1 ? 1055 : 755, py = y + (i === 2 ? 195 : 155);
      context.fillStyle = '#00586d'; context.beginPath(); context.arc(x + 12, py, 12, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#ffffff'; context.font = '20px Montserrat, sans-serif'; context.textAlign = 'center'; context.fillText(String(i + 1), x + 12, py);
      context.textAlign = 'left'; context.fillStyle = '#525054'; context.font = `30px ${WOOD_BED_COMBINATION_FONT}`; context.fillText(point, x + 34, py);
    });
    drawCompactFirmness(context, mattress.firmness, areas.firmness, WOOD_BED_COMBINATION_FIRMNESS);
  }
  context.font = '42px "方正兰亭准黑_GBK", sans-serif'; context.fillStyle = '#5e5e5e'; context.textAlign = 'center'; context.textBaseline = 'top'; context.fillText(WOOD_BED_COMBINATION_NOTE, 720, 1363); context.restore();
}
