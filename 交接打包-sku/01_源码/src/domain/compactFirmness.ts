import type { Rect } from './dimensionGeometry';

export type CompactFirmness = { mode: 'single' | 'double'; faces: [{ value: string; position: number }, { value: string; position: number }] };
export type CompactFirmnessStyle = { bands: readonly { max: number; label: string }[]; font: string; labelFont: string; fontSize: number; color: string; lineColor: string; radius: number; lineWidth: number; letterSpacing: number };
export function normalizeCompactFirmness(input: unknown): CompactFirmness {
  const saved = input && typeof input === 'object' ? input as Partial<CompactFirmness> : {}, faces = Array.isArray(saved.faces) ? saved.faces : [];
  return { mode: saved.mode === 'double' ? 'double' : 'single', faces: [0, 1].map((i) => ({ value: typeof faces[i]?.value === 'string' ? faces[i].value : '',
    position: typeof faces[i]?.position === 'number' && Number.isFinite(faces[i].position) ? Math.min(100, Math.max(0, faces[i].position)) : 10 + i * 20 })) as CompactFirmness['faces'] };
}
export function compactFirmnessBand(value: string, style: CompactFirmnessStyle): number | null {
  const text = value.trim(); if (!/^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/.test(text) || Number(text) <= 0) return null;
  const index = style.bands.findIndex((band) => Number(text) <= band.max); return index < 0 ? null : index;
}
export function compactFirmnessMarkers(value: CompactFirmness, area: Rect, style: CompactFirmnessStyle) {
  const [a, b] = value.faces, bandA = compactFirmnessBand(a.value, style), bandB = compactFirmnessBand(b.value, style), step = 100 / style.bands.length;
  const sameBand = bandA !== null && bandA === bandB, equal = sameBand && Number(a.value) === Number(b.value), frontFirst = Number(a.value) <= Number(b.value);
  const faces = value.mode === 'single' || equal ? [a] : value.faces;
  return faces.map((face, i) => {
    const band = compactFirmnessBand(face.value, style), position = value.mode === 'double' && sameBand ? bandA! * step + (equal ? step / 2 : ((i === 0) === frontFirst ? step * .15 : step * .85)) : face.position;
    return { value: face.value.trim(), band, label: value.mode === 'single' ? '' : equal ? '正反面' : i === 0 ? '正面' : '反面', x: area.x + 28 + (area.width - 56) * position / 100 };
  });
}
export function compactFirmnessIssues(value: CompactFirmness, area: Rect, style: CompactFirmnessStyle): string[] {
  const issues: string[] = [], step = 100 / style.bands.length, sameBand = compactFirmnessBand(value.faces[0].value, style) !== null && compactFirmnessBand(value.faces[0].value, style) === compactFirmnessBand(value.faces[1].value, style);
  (value.mode === 'single' ? value.faces.slice(0, 1) : value.faces).forEach((face, i) => {
    const band = compactFirmnessBand(face.value, style), name = value.mode === 'single' ? '' : i === 0 ? '正面' : '反面';
    if (band === null) issues.push(`${name}软硬度须大于0且不超过10，最多1位小数`);
    else if (!(value.mode === 'double' && sameBand) && (face.position < band * step || face.position > (band + 1) * step)) issues.push(`${name}${style.bands[band].label}指示位置须在${band * step}%–${(band + 1) * step}%内`);
  });
  const markers = compactFirmnessMarkers(value, area, style);
  if (markers.length === 2 && Math.abs(markers[0].x - markers[1].x) < style.radius * 2 + 10) issues.push('两个软硬度圆标过近，请在各自区间内调开');
  return issues;
}
// 只共用绘图机制；字体、颜色、尺寸、档位均由调用模板独立声明。
export function drawCompactFirmness(context: CanvasRenderingContext2D, value: CompactFirmness, area: Rect, style: CompactFirmnessStyle) {
  const cy = area.y + 22, lineY = area.y + 33;
  context.save(); context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.letterSpacing = `${style.letterSpacing}px`;
  context.strokeStyle = style.lineColor; context.lineWidth = style.lineWidth;
  context.beginPath(); context.moveTo(area.x, lineY); context.lineTo(area.x + area.width, lineY); context.stroke();
  for (const marker of compactFirmnessMarkers(value, area, style)) {
    context.save(); context.beginPath(); context.roundRect(area.x - 30, lineY, area.width + 60, area.height, 0); context.clip();
    context.beginPath(); context.arc(marker.x, cy, style.radius + 4, 0, Math.PI * 2); context.fillStyle = '#ffffff'; context.fill(); context.stroke(); context.restore();
    context.beginPath(); context.arc(marker.x, cy, style.radius, 0, Math.PI * 2); context.fillStyle = style.color; context.fill(); context.strokeStyle = '#ffffff'; context.lineWidth = 3; context.stroke();
    context.font = `${style.fontSize}px ${style.font}`; context.fillStyle = '#ffffff'; context.fillText(marker.value, marker.x, cy + 7);
    context.font = `${style.fontSize}px ${style.labelFont}`; context.fillStyle = style.color;
    if (marker.label) context.fillText(marker.label, marker.x, area.y + 63);
    context.fillText(marker.band === null ? '' : style.bands[marker.band].label, marker.x, area.y + (marker.label ? 84 : 68));
    context.strokeStyle = style.lineColor; context.lineWidth = style.lineWidth;
  }
  context.fillStyle = 'rgba(0,0,0,0.5)'; context.font = `${style.fontSize}px ${style.font}`; context.letterSpacing = '0px';
  context.fillText('0', area.x, area.y + 22); context.fillText('10', area.x + area.width, area.y + 22);
  context.font = `${style.fontSize}px ${style.labelFont}`; context.letterSpacing = `${style.letterSpacing}px`; context.fillText('硬', area.x, area.y + 55); context.fillText('软', area.x + area.width, area.y + 55); context.restore();
}
