import { describe, expect, it, vi } from 'vitest';
import type { DimensionAnnotation } from './dimensionAnnotations';
import { defaultFunctionalSofaFeature, functionalSofaDimensionIssue, functionalSofaDimensionLabel, functionalSofaFeatureBounds, functionalSofaFeatureIssues, functionalSofaModelBadge, getFunctionalSofaSingleLayout, normalizeFunctionalSofaOptions, parseFunctionalSofaDimensions } from './functionalSofaSingleLayout';
import { drawFunctionalSofaFeatures } from '../templates/functional-sofa-feature';

const context = { font: '', measureText(text: string) { return { width: text.length * parseFloat(this.font) * .6 } as TextMetrics; } };
const fields = { length: '92.99', width: '105.29~162.39', height: '98.89~77.99' };
const annotation: DimensionAnnotation = { kind: 'height', label: '高', value: 98.8, from: { x: 100, y: 450 }, to: { x: 100, y: 1050 } };

describe('功能单人沙发：PPT第2、3、15、16、18页', () => {
  it('固定型号、卖点位置及框高，两三卖点和不等长文案均留在安全区', () => {
    for (const widths of [[250, 350, 250], [350, 350], [700, 100, 100]]) {
      const layout = getFunctionalSofaSingleLayout(widths);
      expect(layout.modelBadge).toEqual({ x: 70, y: 250, height: 78 });
      expect(layout.issue).toBeNull();
      layout.sellingPoints.forEach((box, index) => {
        expect(box.y).toBe(1182); expect(box.height).toBe(98);
        expect(box.width).toBeGreaterThanOrEqual(widths[index] + 52);
        expect(box.x - 2).toBeGreaterThanOrEqual(70);
        expect(box.x + box.width + 2).toBeLessThanOrEqual(1370);
      });
      expect(layout.subjectSafeArea.y).toBeGreaterThanOrEqual(layout.modelBadge.y + layout.modelBadge.height);
      expect(layout.subjectSafeArea.y + layout.subjectSafeArea.height).toBe(1132);
    }
    expect(getFunctionalSofaSingleLayout([700, 700, 700]).issue).toContain('超出安全区');
  });

  it('型号保持60号字，长型号或换行不能进入右上禁区', () => {
    const layout = getFunctionalSofaSingleLayout([200, 200, 200]);
    expect(functionalSofaModelBadge(context, 'TEST-A', layout)).toMatchObject({ text: 'TEST-A', fontSize: 60, issue: null });
    expect(functionalSofaModelBadge(context, 'TEST'.repeat(12), layout).issue).toContain('禁区');
    expect(functionalSofaModelBadge(context, 'TEST\nA', layout).issue).toContain('一行');
  });

  it('范围和并列尺寸截断一位小数，长尺寸折行仍保留全部规格与cm', () => {
    expect(parseFunctionalSofaDimensions('92.99×105.29～162.39×98.89~77.99cm')).toEqual({ length: '92.9', width: '105.2~162.3', height: '98.8~77.9' });
    for (const kind of ['length', 'width', 'height'] as const) {
      const label = functionalSofaDimensionLabel(context, { ...annotation, kind }, fields);
      expect(label.runs.map((run) => run.text).join('')).toBe(`${{ length: '92.9', width: '105.2~162.3', height: '98.8~77.9' }[kind]}cm`);
      expect(label.runs.every((run) => run.font.startsWith('46px Montserrat'))).toBe(true);
      if (kind === 'height') expect(label.runs.length).toBeGreaterThan(1);
    }
    expect(parseFunctionalSofaDimensions('92/102×105~162×98~77')).toEqual({ length: '92/102', width: '105~162', height: '98~77' });
    expect(functionalSofaDimensionIssue(fields)).toBeNull();
    for (const value of ['', '0', '-1', '98~', 'abc']) expect(functionalSofaDimensionIssue({ ...fields, height: value })).not.toBeNull();
    expect(functionalSofaDimensionIssue({ ...fields, height: '98/97/96/95/94/93/92/91/90/89' })).toContain('过长');
  });

  it('默认不声明真实功能，恢复时两个标注及不同模板实例没有共享对象', () => {
    const a = normalizeFunctionalSofaOptions(undefined), b = normalizeFunctionalSofaOptions(undefined);
    expect(a.rocking).toMatchObject({ enabled: false, text: '' });
    expect(a.rotation).toMatchObject({ enabled: false, text: '' });
    a.rocking.text = '测试文案'; a.rotation.x = 10;
    expect(b.rocking.text).toBe(''); expect(b.rotation.x).toBe(535);
    const saved = { rocking: { enabled: true, text: '测试摇动', x: 850, y: 430 } };
    const restored = normalizeFunctionalSofaOptions(saved);
    restored.rocking.x = 100;
    expect(saved.rocking.x).toBe(850);
    expect(normalizeFunctionalSofaOptions({ rocking: { enabled: 'true', text: 20, x: NaN, y: Infinity } }).rocking).toEqual(defaultFunctionalSofaFeature('rocking'));
  });

  it('启用后的空文案、换行、长文案及越界均阻止导出，关闭后保留原始编辑内容', () => {
    for (const kind of ['rocking', 'rotation'] as const) {
      const feature = { ...defaultFunctionalSofaFeature(kind), enabled: true, text: '测试功能' };
      expect(functionalSofaFeatureIssues(kind, feature)).toEqual([]);
      expect(functionalSofaFeatureIssues(kind, { ...feature, text: '' }).join()).toContain('请填写');
      expect(functionalSofaFeatureIssues(kind, { ...feature, text: '测试\n功能' }).join()).toContain('单行');
      for (const changes of [{ x: 0 }, { x: 1400 }, { y: 200 }, { y: 1130 }, { text: '测试长文案'.repeat(20) }]) {
        expect(functionalSofaFeatureIssues(kind, { ...feature, ...changes }).join()).toContain('超出安全区');
      }
      expect(functionalSofaFeatureIssues(kind, { ...feature, enabled: false, x: -10, text: '' })).toEqual([]);
    }
  });
});

it('两种功能绘制独立虚线曲线、实线箭头和真实文案，曲线实际轨迹包含在检查边界中', () => {
  for (const kind of ['rocking', 'rotation'] as const) {
    const points: Array<{ x: number; y: number }> = [];
    const ctx = { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), stroke: vi.fn(), fillText: vi.fn(), setLineDash: vi.fn(),
      moveTo: vi.fn((x: number, y: number) => { points.push({ x, y }); }),
      lineTo: vi.fn((x: number, y: number) => { points.push({ x, y }); }),
      ellipse: vi.fn((cx: number, cy: number, rx: number, ry: number, rotation: number, start: number, end: number, anticlockwise: boolean) => {
        expect(anticlockwise).toBe(end < start);
        if (kind === 'rocking') expect(rx).toBe(ry);
        for (let i = 0; i <= 100; i++) {
          const angle = start + (end - start) * i / 100;
          points.push({ x: cx + rx * Math.cos(angle) * Math.cos(rotation) - ry * Math.sin(angle) * Math.sin(rotation),
            y: cy + rx * Math.cos(angle) * Math.sin(rotation) + ry * Math.sin(angle) * Math.cos(rotation) });
        }
      }) };
    const options = normalizeFunctionalSofaOptions(undefined);
    options[kind] = { ...options[kind], enabled: true, text: '测试功能' };
    drawFunctionalSofaFeatures(ctx as unknown as CanvasRenderingContext2D, options);
    expect(ctx.ellipse).toHaveBeenCalledTimes(1);
    expect(ctx.setLineDash.mock.calls).toEqual([[[6, 4]], [[]]]);
    expect(ctx.fillText.mock.calls[0][0]).toBe('测试功能');
    expect(ctx).toMatchObject({ strokeStyle: '#545454', lineWidth: 2, fillStyle: '#000000' });
    expect(ctx.save).toHaveBeenCalledTimes(1); expect(ctx.restore).toHaveBeenCalledTimes(1);
    const bounds = functionalSofaFeatureBounds(kind, options[kind], 4 * 46);
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(bounds.x); expect(point.x).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(point.y).toBeGreaterThanOrEqual(bounds.y); expect(point.y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  }
});
