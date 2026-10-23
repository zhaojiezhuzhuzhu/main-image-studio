import type { DimensionFields } from './dimensions';
import { parseDimensionText } from './dimensions';
import type { SingleLayout } from '../templates/types';

// 第18页脚踏案例的独立布局。坐标为1440×1440画布中的像素值。
export function getFootstoolSingleLayout(): SingleLayout {
  return {
    modelBadge: { x: 70, y: 250, height: 74 },
    productArea: { x: 270, y: 530, width: 840, height: 410 },
    subjectSafeArea: { x: 70, y: 380, width: 1300, height: 760 },
    sellingPoints: [],
  };
}

export function formatFootstoolModel(model: string): string {
  const text = model.trim();
  return text ? text.includes('脚踏') ? text : `${text}脚踏` : '产品型号脚踏';
}

export function parseFootstoolDimensions(input: string): DimensionFields | null {
  const parts = input.split(/[x×]/i).map((part) => parseDimensionText(part, 'truncate'));
  if (parts.length !== 3 || parts.some((part) => !part || /[~/]/.test(part.text))) return null;
  return { length: parts[0]!.text, width: parts[1]!.text, height: parts[2]!.text };
}

export function footstoolDimensionIssue(fields: DimensionFields): string | null {
  for (const [kind, label] of [['length', '长'], ['width', '宽'], ['height', '高']] as const) {
    if (!fields[kind].trim()) return `请填写脚踏${label}尺寸`;
    const parsed = parseDimensionText(fields[kind], 'truncate');
    if (!parsed || /[~/]/.test(parsed.text)) return `脚踏${label}尺寸无效：请填写一个正数，单位为cm`;
  }
  return null;
}
