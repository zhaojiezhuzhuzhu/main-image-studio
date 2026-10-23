import { parseDimensionText, type DimensionFields } from './dimensions';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { DimensionAnnotation } from './dimensionAnnotations';
import type { DimensionLabel, SingleLayout, SingleTemplateOptions, TextMeasure } from '../templates/types';

export type MattressFace = { description: string; value: string; position: number };
export type MattressDoubleOptions = { headline: string; faces: [MattressFace, MattressFace]; materials: Array<{ text: string; textColor: 'black' | 'white' }> };
export type MattressDoubleDraft = WorkbenchDraft & { mattressDouble?: MattressDoubleOptions };
export const DOUBLE_MATTRESS_TEXT_FONT = 'Montserrat, "方正兰亭准黑_GBK", sans-serif';
export const DOUBLE_MATTRESS_HEADLINE_FONT = '"Montserrat Semi Bold", "方正兰亭中黑_GBK", sans-serif';
export const DOUBLE_MATTRESS_BANDS = ['硬', '偏硬', '适中', '偏软', '软'] as const;
export const MATTRESS_FACE_NAMES = ['正面', '反面'] as const;

export function normalizeMattressDouble(input: unknown): MattressDoubleOptions {
  const saved = input && typeof input === 'object' ? input as Partial<MattressDoubleOptions> : {};
  const faces = Array.isArray(saved.faces) ? saved.faces : [], materials = Array.isArray(saved.materials) ? saved.materials : [];
  return { headline: typeof saved.headline === 'string' ? saved.headline : '',
    faces: [0, 1].map((i) => ({ description: typeof faces[i]?.description === 'string' ? faces[i].description : '', value: typeof faces[i]?.value === 'string' ? faces[i].value : '',
      position: typeof faces[i]?.position === 'number' && Number.isFinite(faces[i].position) ? Math.max(0, Math.min(100, faces[i].position)) : 10 + i * 20 })) as [MattressFace, MattressFace],
    materials: Array.from({ length: 3 }, (_, i) => ({ text: typeof materials[i]?.text === 'string' ? materials[i].text : '', textColor: materials[i]?.textColor === 'black' ? 'black' : 'white' })) };
}
export function doubleMattressBand(value: string): number | null {
  const text = value.trim();
  return /^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/.test(text) && Number(text) > 0 ? Math.ceil(Number(text) / 2) - 1 : null;
}
export function doubleMattressMode(value: MattressDoubleOptions): 'same-value' | 'same-band' | 'different-bands' {
  const [front, back] = value.faces, a = doubleMattressBand(front.value), b = doubleMattressBand(back.value);
  if (a !== null && b !== null && Number(front.value) === Number(back.value)) return 'same-value';
  return a !== null && a === b ? 'same-band' : 'different-bands';
}
export function doubleMattressMarkers(value: MattressDoubleOptions) {
  const mode = doubleMattressMode(value), band = doubleMattressBand(value.faces[0].value) ?? 2;
  if (mode === 'same-value') return [{ label: '正反面', value: value.faces[0].value.trim(), band, x: 220 + (band * 20 + 10) * 10 }];
  // 同区间采用成对固定位置；较小数值在左，面名始终跟随自己的数值。
  const frontFirst = Number(value.faces[0].value) <= Number(value.faces[1].value);
  return value.faces.map((face, i) => ({ label: MATTRESS_FACE_NAMES[i], value: face.value.trim(), band: doubleMattressBand(face.value),
    x: 220 + (mode === 'same-band' ? band * 20 + ((i === 0) === frontFirst ? 4 : 16) : face.position) * 10 }));
}
export function getMattressDoubleLayout(): SingleLayout {
  return { modelBadge: { x: 1000, y: 351, height: 60 }, productArea: { x: 150, y: 558, width: 965, height: 300 },
    subjectSafeArea: { x: 60, y: 545, width: 1320, height: 317 }, sellingPoints: [] };
}
export const doubleMattressCards = () => Array.from({ length: 3 }, (_, i) => ({ x: 60 + i * 444, y: 1130, width: 432, height: 264 }));
export const doubleMattressAccessories = () => doubleMattressCards().map((area, i) => ({ id: `double-mattress-material-${i + 1}`, label: `材质卖点${i + 1}`, area, fit: 'cover' as const, clipRadius: 8 }));
export function doubleMattressModel(context: TextMeasure, model: string, layout: SingleLayout) {
  const text = model.trim() || '床垫型号'; context.font = '45px Montserrat, sans-serif'; const width = context.measureText(text).width + 50;
  return { text, fontSize: 45, box: { ...layout.modelBadge, x: 1350 - width, width }, issue: /[\r\n\t]/.test(text) || width > 350 ? '床垫型号过长或包含换行，请核对完整型号，不能缩小或截断内容' : null };
}
export function parseDoubleMattressThickness(input: string): DimensionFields | null {
  const value = parseDimensionText(input, 'truncate'); return value && !/[~/]/.test(value.text) ? { length: '', width: '', height: value.text } : null;
}
export function doubleMattressThicknessLabel(context: TextMeasure, annotation: DimensionAnnotation, fields: DimensionFields): DimensionLabel {
  const text = `${parseDimensionText(fields.height, 'truncate')?.text ?? annotation.value}cm`, font = '52px "Montserrat Semi Bold", sans-serif'; context.font = font;
  return { width: context.measureText(text).width, height: 52, letterSpacing: -1.3, runs: [{ text, font, x: 0, y: 0 }] };
}
function lineIssue(context: TextMeasure, text: string, font: string, width: number, name: string): string | null {
  context.font = font;
  if (!text.trim()) return `请填写${name}，内容须依据真实产品资料`;
  return /[\r\n\t]/.test(text) || context.measureText(text).width > width ? `${name}需单行且不能超出规定字号区域，请核对完整内容` : null;
}
function descriptionRuns(value: MattressDoubleOptions) {
  return value.faces.flatMap((face, i) => face.description.trim() ? [
    { text: `${i === 1 && value.faces[0].description.trim() ? '； ' : ''}${MATTRESS_FACE_NAMES[i]}：`, font: '33px "方正兰亭中粗黑_GBK", sans-serif', color: '#000000' },
    { text: face.description, font: '33px "方正兰亭黑_GBK", sans-serif', color: '#5e5e5e' },
  ] : []);
}
export function doubleMattressIssues(context: TextMeasure, options: SingleTemplateOptions, _layout: SingleLayout, fields?: DimensionFields): string[] {
  const value = normalizeMattressDouble(options.mattressDouble), mode = doubleMattressMode(value);
  const issues = [lineIssue(context, value.headline, `100px ${DOUBLE_MATTRESS_HEADLINE_FONT}`, 900, '床垫标题'),
    ...value.materials.map((m, i) => lineIssue(context, m.text, `35px ${DOUBLE_MATTRESS_TEXT_FONT}`, 392, `材质卖点${i + 1}文案`))];
  const runs = descriptionRuns(value), width = runs.reduce((sum, run) => { context.font = run.font; return sum + context.measureText(run.text).width; }, 0);
  if (width > 1250 || runs.some((run) => /[\r\n\t]/.test(run.text))) issues.push('正反面说明合计需单行且不超过规定区域，请核对完整内容');
  value.faces.forEach((face, i) => {
    const band = doubleMattressBand(face.value), name = MATTRESS_FACE_NAMES[i];
    if (band === null) issues.push(`${name}软硬度须大于0且不超过10，最多保留1位小数`);
    else if (mode === 'different-bands' && (face.position < band * 20 || face.position > (band + 1) * 20)) issues.push(`${name}${DOUBLE_MATTRESS_BANDS[band]}指示位置须在${band * 20}%–${(band + 1) * 20}%内`);
  });
  const markers = doubleMattressMarkers(value);
  if (mode === 'different-bands' && Math.abs(markers[0].x - markers[1].x) < 116) issues.push('正反面圆标距离过近，请在各自区间内调开，避免重叠');
  if (fields) {
    const thickness = parseDoubleMattressThickness(fields.height);
    issues.push(thickness ? lineIssue(context, `${thickness.height}cm`, '52px "Montserrat Semi Bold", sans-serif', 220, '床垫厚度') : '请依据床垫信息表填写单个厚度（cm）');
  }
  return issues.filter((issue): issue is string => Boolean(issue));
}
export function drawDoubleMattress(context: CanvasRenderingContext2D, options: SingleTemplateOptions): void {
  const value = normalizeMattressDouble(options.mattressDouble);
  context.save(); context.letterSpacing = '0px'; context.textAlign = 'left'; context.textBaseline = 'top';
  context.fillStyle = '#000000'; context.font = `100px ${DOUBLE_MATTRESS_HEADLINE_FONT}`; context.fillText(value.headline, 85, 342);
  let descriptionX = 85;
  descriptionRuns(value).forEach((run) => { context.font = run.font; context.fillStyle = run.color; context.fillText(run.text, descriptionX, 472); descriptionX += context.measureText(run.text).width; });
  const lineY = 970;
  context.strokeStyle = '#769aa7'; context.lineWidth = 4.5; context.lineCap = 'round';
  context.beginPath(); context.moveTo(160, lineY); context.lineTo(1280, lineY); context.stroke();
  doubleMattressMarkers(value).forEach((marker) => {
    context.save(); context.strokeStyle = '#769aa7'; context.lineWidth = 4.5;
    context.save(); context.beginPath(); context.roundRect(0, lineY, 1440, 1440 - lineY, 0); context.clip();
    context.beginPath(); context.arc(marker.x, 943, 53.469, 0, Math.PI * 2); context.fillStyle = '#1b576c'; context.fill();
    context.beginPath(); context.arc(marker.x, 943, 55.719, 0, Math.PI * 2); context.stroke(); context.restore();
    context.beginPath(); context.arc(marker.x, 944, 49.133, 0, Math.PI * 2); context.fillStyle = '#00586d'; context.fill(); context.strokeStyle = '#ffffff'; context.lineWidth = 8; context.stroke();
    context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.letterSpacing = '-1.15px'; context.font = '46px Montserrat, sans-serif'; context.fillStyle = '#ffffff'; context.fillText(marker.value, marker.x, 960);
    context.fillStyle = '#00586d'; context.letterSpacing = '-0.875px'; context.font = '35px "方正兰亭中黑_GBK", sans-serif';
    context.fillText(marker.label, marker.x, 1038); context.fillText(marker.band === null ? '' : DOUBLE_MATTRESS_BANDS[marker.band], marker.x, 1080); context.restore();
  });
  context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.fillStyle = 'rgba(0,0,0,0.5)'; context.font = '35px Montserrat, sans-serif'; context.letterSpacing = '-0.875px'; context.fillText('0', 135, 941); context.fillText('10', 1305, 941);
  context.font = '32px "方正兰亭中黑_GBK", sans-serif'; context.letterSpacing = '-0.8px'; context.fillText('硬', 135, 984); context.fillText('软', 1305, 984);
  context.letterSpacing = '0px'; context.font = `35px ${DOUBLE_MATTRESS_TEXT_FONT}`;
  doubleMattressCards().forEach((card, i) => {
    context.save(); context.beginPath(); context.roundRect(card.x, card.y, card.width, card.height, 8); context.clip();
    context.fillStyle = 'rgba(0,0,0,0.28)'; context.beginPath(); context.roundRect(card.x, card.y + card.height - 70, card.width, 70, 0); context.fill();
    context.fillStyle = value.materials[i].textColor === 'black' ? '#000000' : '#ffffff'; context.fillText(value.materials[i].text, card.x + card.width / 2, card.y + card.height - 25); context.restore();
  });
  context.restore();
}
