import { describe, expect, it } from 'vitest';
import { adjustFunctionalCurve, defaultFunctionalCurve, functionalCurveGeometry, normalizeFunctionalCurve, type FunctionalCurve } from './functionalSofaCurve';
import { defaultFunctionalSofaFeature, functionalSofaFeatureBounds, functionalSofaFeatureIssues, normalizeFunctionalSofaOptions } from './functionalSofaSingleLayout';

function bendRatio(curve: FunctionalCurve) {
  const dx = curve.to.x - curve.from.x, dy = curve.to.y - curve.from.y;
  return ((curve.bend.x - (curve.from.x + curve.to.x) / 2) * -dy + (curve.bend.y - (curve.from.y + curve.to.y) / 2) * dx) / (dx * dx + dy * dy);
}
function expectCentered(curve: FunctionalCurve) {
  expect(Math.hypot(curve.bend.x - curve.from.x, curve.bend.y - curve.from.y)).toBeCloseTo(Math.hypot(curve.bend.x - curve.to.x, curve.bend.y - curve.to.y), 8);
}

describe.each(['rocking', 'rotation'] as const)('%s 规则弧线', (kind) => {
  it.each(['from', 'to'] as const)('移动%s后控制点自动居中，保持弯曲比例，另一端固定', (part) => {
    const curve = defaultFunctionalCurve(kind), untouched = structuredClone(curve);
    const next = adjustFunctionalCurve(curve, part, { x: curve[part].x - 65, y: curve[part].y + 120 });
    expectCentered(next);
    expect(next.bend).not.toEqual(curve.bend);
    expect(next[part === 'from' ? 'to' : 'from']).toEqual(curve[part === 'from' ? 'to' : 'from']);
    expect(bendRatio(next)).toBeCloseTo(bendRatio(curve), 10);
    expect(curve).toEqual(untouched);
  });

  it('菱形沿中线移动，忽略沿端点连线的拖动分量，不移动端点', () => {
    const curve = defaultFunctionalCurve(kind), dx = curve.to.x - curve.from.x, dy = curve.to.y - curve.from.y;
    const next = adjustFunctionalCurve(curve, 'bend', { x: curve.bend.x + dx * .3 - dy * .2, y: curve.bend.y + dy * .3 + dx * .2 });
    expect(next.from).toEqual(curve.from); expect(next.to).toEqual(curve.to); expectCentered(next);
    expect(bendRatio(next)).toBeCloseTo(bendRatio(curve) + .2, 10);
  });

  it.each([-.9, -.1, .1, .9])('弯曲比例%s时整条轨迹满足圆/椭圆方程，经过三个点，边界覆盖全部轨迹', (ratio) => {
    const from = { x: -40, y: 50 }, to = { x: 250, y: 160 };
    const curve = { from, to, bend: { x: 105 - 110 * ratio, y: 105 + 290 * ratio } };
    const feature = { ...defaultFunctionalSofaFeature(kind), enabled: true, text: '测试', curve };
    const geometry = functionalCurveGeometry(kind, feature), arc = geometry.arc!;
    if (kind === 'rocking') expect(arc.radiusX).toBe(arc.radiusY);
    for (const [t, point] of [[0, geometry.handles.from], [.5, geometry.handles.bend], [1, geometry.handles.to]] as const) {
      expect(geometry.pointAt(t).x).toBeCloseTo(point.x, 8); expect(geometry.pointAt(t).y).toBeCloseTo(point.y, 8);
    }
    const bounds = functionalSofaFeatureBounds(kind, feature, 92);
    for (let i = 0; i <= 200; i++) {
      const point = geometry.pointAt(i / 200), dx = point.x - arc.center.x, dy = point.y - arc.center.y;
      const x = dx * Math.cos(arc.rotation) + dy * Math.sin(arc.rotation), y = -dx * Math.sin(arc.rotation) + dy * Math.cos(arc.rotation);
      expect((x / arc.radiusX) ** 2 + (y / arc.radiusY) ** 2).toBeCloseTo(1, 10);
      expect(point.x).toBeGreaterThanOrEqual(bounds.x); expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(point.y).toBeGreaterThanOrEqual(bounds.y); expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    for (const [left, tip, right] of geometry.arrows) {
      expect(Math.hypot(left.x - tip.x, left.y - tip.y)).toBeCloseTo(Math.hypot(12, 8));
      expect(Math.hypot(right.x - tip.x, right.y - tip.y)).toBeCloseTo(Math.hypot(12, 8));
    }
    const moved = functionalCurveGeometry(kind, { ...feature, x: feature.x + 41, y: feature.y - 20 });
    expect(moved.text).toEqual({ x: geometry.text.x + 41, y: geometry.text.y - 20 });
    expect(moved.handles.bend).toEqual({ x: geometry.handles.bend.x + 41, y: geometry.handles.bend.y - 20 });
  });

  it('压平时为直线，端点重合操作不产生无效圆弧', () => {
    const curve = defaultFunctionalCurve(kind), midpoint = { x: (curve.from.x + curve.to.x) / 2, y: (curve.from.y + curve.to.y) / 2 };
    const flat = functionalCurveGeometry(kind, { ...defaultFunctionalSofaFeature(kind), curve: { ...curve, bend: midpoint } });
    expect(flat.arc).toBeUndefined(); expect(flat.path).toContain(' L ');
    expect(flat.pointAt(.5)).toEqual(flat.handles.bend);
    expect(adjustFunctionalCurve(curve, 'from', curve.to)).toEqual(curve);
    expect(normalizeFunctionalCurve({ ...curve, to: curve.from })).toBeUndefined();
  });

  it('修改后的实际曲线越界会阻止导出', () => {
    const curve = defaultFunctionalCurve(kind);
    const feature = { ...defaultFunctionalSofaFeature(kind), enabled: true, text: '测试', curve: { ...curve, bend: { x: -2000, y: -2000 } } };
    expect(functionalSofaFeatureIssues(kind, feature).join()).toContain('超出安全区');
  });
});

it('旧偏斜形状自动居中且归一化幂等；深拷贝保存，损坏形状回到默认', () => {
  const old = normalizeFunctionalSofaOptions(undefined);
  expect(old.rocking).not.toHaveProperty('curve');
  const curve = { from: { x: 8, y: 16 }, to: { x: 100, y: 90 }, bend: { x: 200, y: 30 } };
  const next = normalizeFunctionalSofaOptions({ ...old, rocking: { ...old.rocking, curve } });
  expect(next.rocking.curve!.from).toEqual(curve.from); expect(next.rocking.curve!.to).toEqual(curve.to);
  expectCentered(next.rocking.curve!);
  expect(normalizeFunctionalSofaOptions(next)).toEqual(next);
  next.rocking.curve!.from.x = 900;
  expect(curve.from.x).toBe(8);
  expect(normalizeFunctionalCurve({ ...curve, bend: { x: NaN, y: 4 } })).toBeUndefined();
  expect(normalizeFunctionalCurve({ from: curve.from })).toBeUndefined();
});
