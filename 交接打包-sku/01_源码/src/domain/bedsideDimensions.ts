import type { DimensionAnnotation } from './dimensionAnnotations';
import { parseDimensionText, type DimensionFields } from './dimensions';
import type { SingleAccessorySlot } from '../templates/types';

export type BedsideDimensions = { length: string; height: string; annotations?: DimensionAnnotation[] };
export function normalizeBedsideDimensions(input: unknown): BedsideDimensions {
  const value = input && typeof input === 'object' ? input as Partial<BedsideDimensions> : {};
  const annotations = Array.isArray(value.annotations) ? value.annotations.filter((item) => item && ['length', 'height'].includes(item.kind)
    && [item.from?.x, item.from?.y, item.to?.x, item.to?.y].every((n) => typeof n === 'number' && Number.isFinite(n)))
    .map((item) => ({ ...item, from: { ...item.from }, to: { ...item.to }, ...(item.extensionOffsets ? { extensionOffsets: { ...item.extensionOffsets } } : {}) })) : undefined;
  return { length: typeof value.length === 'string' ? value.length : '', height: typeof value.height === 'string' ? value.height : '', ...(annotations ? { annotations } : {}) };
}
export function bedsideDimensionIssues(input: BedsideDimensions): string[] {
  return (['length', 'height'] as const).flatMap((kind) => {
    const parsed = parseDimensionText(input[kind], 'truncate');
    return !parsed || /[~/]/.test(parsed.text) ? [`请填写床头柜${kind === 'length' ? '长' : '高'}的单个有效数值（cm）`] : [];
  });
}
export function bedsideDimensionSlot(value: BedsideDimensions): NonNullable<SingleAccessorySlot['dimensions']> {
  const fields: DimensionFields = { length: value.length, width: '', height: value.height };
  const annotations = (['length', 'height'] as const).flatMap((kind): DimensionAnnotation[] => {
    const parsed = parseDimensionText(value[kind], 'truncate'); if (!parsed) return [];
    const saved = value.annotations?.find((item) => item.kind === kind);
    return [{ ...(saved ?? { kind, label: kind === 'length' ? '长' : '高',
      from: kind === 'length' ? { x: 0, y: -.12 } : { x: 1.15, y: 0 },
      to: kind === 'length' ? { x: 1, y: -.12 } : { x: 1.15, y: 1 } }), value: parsed.value }];
  });
  return { fields, annotations, label(context, annotation) {
    const text = `${parseDimensionText(fields[annotation.kind] ?? '', 'truncate')?.text ?? annotation.value}cm`, font = '35px Montserrat, sans-serif';
    context.font = font;
    return { width: context.measureText(text).width, height: 35, orientation: 'line', runs: [{ text, font, x: 0, y: 0 }] };
  } };
}
