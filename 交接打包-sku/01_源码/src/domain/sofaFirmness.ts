import type { WorkbenchDraft } from '../storage/draftStorage';

export type SofaFirmness = { enabled: boolean; value: string; label: string; position: number };
export type SofaFirmnessDraft = WorkbenchDraft & { sofaFirmness?: SofaFirmness };

// 数值、文案与指示位置分别记录。四份TIF的圆心并非按数值线性分布。
export function normalizeSofaFirmness(value: unknown): SofaFirmness {
  const saved = value && typeof value === 'object' ? value as Partial<SofaFirmness> : {};
  return { enabled: saved.enabled === true,
    value: typeof saved.value === 'string' ? saved.value : '',
    label: typeof saved.label === 'string' ? saved.label : '',
    position: typeof saved.position === 'number' && Number.isFinite(saved.position) ? Math.min(100, Math.max(0, saved.position)) : 50 };
}

export function hasSofaFirmness(value: SofaFirmness): boolean {
  return value.enabled || Boolean(value.value || value.label) || value.position !== 50;
}

// 采用 BS672-A-软坐感.tif 的局部圆弧结构；其余样例的横/纵位置不作为公式。
export const SOFA_FIRMNESS_GEOMETRY = {
  lineLeft: 792.30566, lineRight: 1290.99981, lineY: 1047,
  outerY: 1033, outerRadius: 53.468935, outerStrokeRadius: 55.718935,
  circleY: 1034, circleRadius: 49.13277, valueBaseline: 1050, labelBaseline: 1127.483,
  markerInset: 60, top: 975,
} as const;
export const SOFA_FIRMNESS_FONT = '"方正兰亭中黑_GBK", sans-serif';

export function sofaFirmnessCenter(position: number): number {
  const g = SOFA_FIRMNESS_GEOMETRY;
  return g.lineLeft + g.markerInset + (g.lineRight - g.lineLeft - g.markerInset * 2) * Math.max(0, Math.min(100, position)) / 100;
}

export function sofaFirmnessIssues(context: Pick<CanvasRenderingContext2D, 'font' | 'measureText'>, value: SofaFirmness): string[] {
  if (!value.enabled) return [];
  const issues: string[] = [];
  if (!/^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/.test(value.value.trim())) issues.push('坐感数值请填写0–10，最多保留1位小数，依据实际产品资料');
  context.font = '46px Montserrat, sans-serif';
  if (context.measureText(value.value.trim()).width > SOFA_FIRMNESS_GEOMETRY.circleRadius * 2 - 8) issues.push('坐感数值超出圆内显示范围，请核对数值写法');
  context.font = `35px ${SOFA_FIRMNESS_FONT}`;
  if (!value.label.trim()) issues.push('请填写实际坐感说明');
  else if (/[\r\n\t]/.test(value.label) || context.measureText(value.label).width > 180) issues.push('坐感说明需单行且不超出180px，请核对完整文案，不截断文字');
  return issues;
}

export function drawSofaFirmness(context: CanvasRenderingContext2D, value: SofaFirmness): void {
  if (!value.enabled) return;
  const g = SOFA_FIRMNESS_GEOMETRY, x = sofaFirmnessCenter(value.position);
  context.save();
  context.strokeStyle = '#769aa7'; context.lineWidth = 4.5; context.lineCap = 'round';
  context.beginPath(); context.moveTo(g.lineLeft, g.lineY); context.lineTo(g.lineRight, g.lineY); context.stroke();
  // TIF 外圆上半部被蒙版隐藏，仅在横线以下形成凹弧。
  context.save(); context.beginPath(); context.roundRect(0, g.lineY, 1440, 1440 - g.lineY, 0); context.clip();
  context.beginPath(); context.arc(x, g.outerY, g.outerRadius, 0, Math.PI * 2); context.fillStyle = '#1b576c'; context.fill();
  context.beginPath(); context.arc(x, g.outerY, g.outerStrokeRadius, 0, Math.PI * 2); context.stroke(); context.restore();
  context.beginPath(); context.arc(x, g.circleY, g.circleRadius, 0, Math.PI * 2);
  context.fillStyle = '#00586d'; context.fill(); context.strokeStyle = '#ffffff'; context.lineWidth = 8; context.stroke();
  context.textAlign = 'center'; context.textBaseline = 'alphabetic'; context.letterSpacing = '-1.15px';
  context.font = '46px Montserrat, sans-serif'; context.fillStyle = '#ffffff'; context.fillText(value.value.trim(), x - .091184, g.valueBaseline);
  context.font = `35px ${SOFA_FIRMNESS_FONT}`; context.fillStyle = '#00586d'; context.letterSpacing = '-0.875px';
  context.fillText(value.label, x + .504404, g.labelBaseline);
  context.textAlign = 'left'; context.fillStyle = 'rgba(0,0,0,0.5)';
  context.font = '35px Montserrat, sans-serif'; context.fillText('0', 755.334371, 1017.48254); context.fillText('10', 1296.334371, 1018.48254);
  context.letterSpacing = '-0.8px'; context.font = `32px ${SOFA_FIRMNESS_FONT}`;
  context.fillText('硬', 751.334371, 1058.48254); context.fillText('软', 1300.334371, 1060.48254);
  context.restore();
}
