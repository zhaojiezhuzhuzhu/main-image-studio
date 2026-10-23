export type Dimensions = { length: number; width: number; height: number; headWidth?: number; footWidth?: number; diameter?: number; secondaryLength?: number; secondaryWidth?: number; secondaryHeight?: number };
export type DimensionFields = { length: string; width: string; height: string; headWidth?: string; footWidth?: string; diameter?: string; secondaryLength?: string; secondaryWidth?: string; secondaryHeight?: string };
export type DimensionPrecision = 'round' | 'truncate';
export const STANDARD_DIMENSION_KINDS = ['length', 'width', 'height'] as const;

export const normalizeDimension = (value: number, precision: DimensionPrecision = 'round') =>
  (precision === 'truncate' ? Math.trunc(value * 10 + 1e-8) : Math.round(value * 10)) / 10;

// 首值用于标注几何，text 保留范围或并列规格；旧调用仍默认四舍五入。
export function parseDimensionText(input: string, precision: DimensionPrecision = 'round', allowText = false): { value: number; text: string } | null {
  const text = input.trim().replace(/(?:cm|厘米)/gi, '').replace(/～/g, '~').replace(/\s/g, '');
  if (allowText && /\p{Script=Han}/u.test(text)) {
    const caption = text.match(/^([\p{Script=Han}：:（）()，,、。；;]*?)((?:\d+(?:\.\d*)?|\.\d+)(?:[~/](?:\d+(?:\.\d*)?|\.\d+))*)([\p{Script=Han}：:（）()，,、。；;]*)$/u);
    if (!caption) return null;
    const parsed = parseDimensionText(caption[2], precision);
    return parsed ? { value: parsed.value, text: caption[1] + parsed.text + caption[3] } : null;
  }
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[~/](?:\d+(?:\.\d*)?|\.\d+))*$/.test(text)) return null;
  const parts = text.split(/([~/])/);
  const values = parts.filter((_, index) => index % 2 === 0).map((value) => normalizeDimension(Number(value), precision));
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return { value: values[0], text: parts.map((part, index) => index % 2 ? part : String(values[index / 2])).join('') };
}

export function parseDimensionFields(input: string, precision: DimensionPrecision = 'round', allowText = false): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((part) => parseDimensionText(part, precision, allowText));
  if (parts.length !== 3 || parts.some((part) => !part)) return null;
  return { length: parts[0]!.text, width: parts[1]!.text, height: parts[2]!.text };
}

export function parseDimensions(input: string): Dimensions | null {
  const parts = input.trim().toLowerCase().replace(/厘米|cm/g, '').split(/[x×]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part <= 0)) return null;
  const [length, width, height] = parts.map((value) => normalizeDimension(value));
  return { length, width, height };
}

export function dimensionFieldsFromDimensions(dimensions: Dimensions): DimensionFields {
  return {
    length: String(dimensions.length),
    width: String(dimensions.width),
    height: String(dimensions.height),
    ...(dimensions.headWidth === undefined ? {} : { headWidth: String(dimensions.headWidth) }),
    ...(dimensions.footWidth === undefined ? {} : { footWidth: String(dimensions.footWidth) }),
    ...(dimensions.secondaryLength === undefined ? {} : { secondaryLength: String(dimensions.secondaryLength) }),
    ...(dimensions.secondaryWidth === undefined ? {} : { secondaryWidth: String(dimensions.secondaryWidth) }),
    ...(dimensions.secondaryHeight === undefined ? {} : { secondaryHeight: String(dimensions.secondaryHeight) }),
    ...(dimensions.diameter === undefined ? {} : { diameter: String(dimensions.diameter) }),
  };
}

export function dimensionsFromFields(fields: DimensionFields, precision: DimensionPrecision = 'round', allowText = false): Partial<Dimensions> {
  const result: Partial<Dimensions> = {};
  (Object.keys(fields) as Array<keyof DimensionFields>).forEach((kind) => {
    const parsed = parseDimensionText(fields[kind] ?? '', precision, allowText);
    if (parsed) result[kind] = parsed.value;
  });
  return result;
}

export function formatDimensionFields(fields: DimensionFields): string {
  return `${fields.length}×${fields.width}×${fields.height}`;
}
