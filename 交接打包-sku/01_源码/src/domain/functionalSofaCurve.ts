import type { Point, Rect } from './dimensionGeometry';
import type { FeaturePlacement } from '../templates/types';

export type FunctionalCurveKind = 'rocking' | 'rotation';
export type FunctionalCurve = { from: Point; to: Point; bend: Point };
export type FunctionalSofaFeature = FeaturePlacement & { curve?: FunctionalCurve };
type Arc = { center: Point; radiusX: number; radiusY: number; rotation: number; start: number; sweep: number };

const p = (x: number, y: number): Point => ({ x, y });
const TAU = Math.PI * 2;

function frame(curve: FunctionalCurve) {
  const dx = curve.to.x - curve.from.x, dy = curve.to.y - curve.from.y;
  const length = Math.hypot(dx, dy), normal = p(-dy / length, dx / length);
  const middle = p((curve.from.x + curve.to.x) / 2, (curve.from.y + curve.to.y) / 2);
  const height = (curve.bend.x - middle.x) * normal.x + (curve.bend.y - middle.y) * normal.y;
  return { length, normal, middle, height, rotation: Math.atan2(dy, dx) };
}

function centeredCurve(curve: FunctionalCurve): FunctionalCurve {
  const { middle, normal, height } = frame(curve);
  const bend = p(middle.x + normal.x * height, middle.y + normal.y * height);
  // 保持归一化幂等，避免保存/恢复时因浮点投影产生无意义历史。
  return { from: { ...curve.from }, to: { ...curve.to }, bend: Math.hypot(bend.x - curve.bend.x, bend.y - curve.bend.y) < 1e-8 ? { ...curve.bend } : bend };
}

export function defaultFunctionalCurve(kind: FunctionalCurveKind): FunctionalCurve {
  return centeredCurve(kind === 'rocking'
    ? { from: p(8, 16), to: p(100, 90), bend: p(80.25, 29.75) }
    : { from: p(32, 8), to: p(408, 8), bend: p(220, 94) });
}

export function normalizeFunctionalCurve(value: unknown): FunctionalCurve | undefined {
  if (!value || typeof value !== 'object') return;
  const curve = value as FunctionalCurve;
  if (!(['from', 'to', 'bend'] as const).every((key) => curve[key] && Number.isFinite(curve[key].x) && Number.isFinite(curve[key].y))) return;
  if (Math.hypot(curve.to.x - curve.from.x, curve.to.y - curve.from.y) < 1) return;
  return centeredCurve(curve);
}

export function adjustFunctionalCurve(curve: FunctionalCurve, part: keyof FunctionalCurve, target: Point): FunctionalCurve {
  const before = centeredCurve(curve);
  if (part === 'bend') return centeredCurve({ ...before, bend: target });
  const next = { ...before, [part]: target };
  if (Math.hypot(next.to.x - next.from.x, next.to.y - next.from.y) < 1) return before;
  const original = frame(before), updated = frame(next);
  // 端点变化时保留弓高/弦长比例；圆弧张角和椭圆扁率因此保持不变。
  const height = original.height * updated.length / original.length;
  return { ...next, bend: p(updated.middle.x + updated.normal.x * height, updated.middle.y + updated.normal.y * height) };
}

function arrow(tip: Point, direction: Point): Point[] {
  const length = Math.hypot(direction.x, direction.y) || 1;
  const x = direction.x / length, y = direction.y / length;
  return [p(tip.x - x * 12 - y * 8, tip.y - y * 12 + x * 8), tip, p(tip.x - x * 12 + y * 8, tip.y - y * 12 - x * 8)];
}

export function functionalArcPoint(arc: Arc, t: number): Point {
  const angle = arc.start + arc.sweep * t, x = arc.radiusX * Math.cos(angle), y = arc.radiusY * Math.sin(angle);
  return p(arc.center.x + x * Math.cos(arc.rotation) - y * Math.sin(arc.rotation), arc.center.y + x * Math.sin(arc.rotation) + y * Math.cos(arc.rotation));
}

export function functionalCurveGeometry(kind: FunctionalCurveKind, feature: FunctionalSofaFeature) {
  const curve = normalizeFunctionalCurve(feature.curve) ?? defaultFunctionalCurve(kind);
  const { length, normal, middle, height, rotation } = frame(curve);
  const offset = (point: Point) => p(feature.x + point.x, feature.y + point.y);
  const handles = { from: offset(curve.from), to: offset(curve.to), bend: offset(curve.bend) };
  let arc: Arc | undefined;
  if (Math.abs(height) > 1e-6) {
    if (kind === 'rocking') {
      const centerHeight = height / 2 - length * length / (8 * height);
      const radius = Math.hypot(length / 2, centerHeight);
      arc = { center: offset(p(middle.x + normal.x * centerHeight, middle.y + normal.y * centerHeight)), radiusX: radius, radiusY: radius, rotation,
        start: Math.atan2(-centerHeight, -length / 2), sweep: -4 * Math.atan(2 * height / length) };
    } else {
      // 固定 240° 弧段（120° 缺口），保留底部包围产品的透视形状；三点只决定位置、朝向和扁率。
      arc = { center: offset(p(middle.x + normal.x * height / 3, middle.y + normal.y * height / 3)), radiusX: length / Math.sqrt(3), radiusY: Math.abs(height) * 2 / 3, rotation,
        start: height > 0 ? Math.PI * 7 / 6 : Math.PI * 5 / 6, sweep: -Math.sign(height) * Math.PI * 4 / 3 };
    }
  }
  const pointAt = (t: number) => arc ? functionalArcPoint(arc, t) : p(handles.from.x + (handles.to.x - handles.from.x) * t, handles.from.y + (handles.to.y - handles.from.y) * t);
  const tangentAt = (t: number) => {
    if (!arc) return p(handles.to.x - handles.from.x, handles.to.y - handles.from.y);
    const angle = arc.start + arc.sweep * t, x = -arc.radiusX * Math.sin(angle) * Math.sign(arc.sweep), y = arc.radiusY * Math.cos(angle) * Math.sign(arc.sweep);
    return p(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation));
  };
  const firstDirection = tangentAt(0);
  const arrows = kind === 'rocking' ? [arrow(handles.from, p(-firstDirection.x, -firstDirection.y)), arrow(handles.to, tangentAt(1))]
    : [.3, .7].map((t) => arrow(pointAt(t), tangentAt(t)));
  const path = `M ${handles.from.x} ${handles.from.y} ` + (arc
    ? `A ${arc.radiusX} ${arc.radiusY} ${rotation * 180 / Math.PI} ${Math.abs(arc.sweep) > Math.PI ? 1 : 0} ${arc.sweep > 0 ? 1 : 0} ${handles.to.x} ${handles.to.y}`
    : `L ${handles.to.x} ${handles.to.y}`);
  return { arc, arrows, handles, path, pointAt, text: p(feature.x + (kind === 'rocking' ? 112 : 458), feature.y + (kind === 'rocking' ? 8 : 80)) };
}

export function editedFunctionalCurveBounds(kind: FunctionalCurveKind, feature: FunctionalSofaFeature, textWidth: number): Rect {
  const geometry = functionalCurveGeometry(kind, feature), arc = geometry.arc;
  const points = [geometry.handles.from, geometry.handles.to, ...geometry.arrows.flat(), geometry.text, p(geometry.text.x + textWidth, geometry.text.y + 46)];
  if (arc) {
    // 旋转后的椭圆在 x/y 方向的真实极值，并只纳入当前弧段上的点。
    const xAngle = Math.atan2(-arc.radiusY * Math.sin(arc.rotation), arc.radiusX * Math.cos(arc.rotation));
    const yAngle = Math.atan2(arc.radiusY * Math.cos(arc.rotation), arc.radiusX * Math.sin(arc.rotation));
    for (const angle of [xAngle, xAngle + Math.PI, yAngle, yAngle + Math.PI]) {
      const distance = ((angle - arc.start) * Math.sign(arc.sweep) % TAU + TAU) % TAU;
      if (distance <= Math.abs(arc.sweep)) points.push(functionalArcPoint(arc, distance / Math.abs(arc.sweep)));
    }
  }
  const x = Math.min(...points.map((point) => point.x)) - 2, y = Math.min(...points.map((point) => point.y)) - 2;
  return { x, y, width: Math.max(...points.map((point) => point.x)) + 2 - x, height: Math.max(...points.map((point) => point.y)) + 2 - y };
}
