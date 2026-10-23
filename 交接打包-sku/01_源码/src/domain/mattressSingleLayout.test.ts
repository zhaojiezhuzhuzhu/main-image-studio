import { describe, expect, it } from 'vitest';
import { mattressSingleRules as rules } from '../templates/mattress-single';
import { mattressFirmnessBand, mattressFirmnessCenter, normalizeMattressSingle, mattressMaterialCards, type MattressSingleOptions } from './mattressSingleLayout';
import { adjustAnnotatedProduct, fitAnnotatedProduct } from './annotatedProductFit';

const context = { font: '', measureText(text: string) { return { width: text.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 } as TextMetrics; } };
const fields = { length: '', width: '', height: '27.9' };
const valid = (): MattressSingleOptions => ({ headline: '测试床垫', subtitle: '测试说明', firmnessValue: '2.1', firmnessPosition: 30, materials: Array.from({ length: 3 }, () => ({ text: '测试材质', textColor: 'white' })) });
const options = () => ({ ...rules.createOptions(), mattressSingle: valid() });
describe('P10单面睡床垫', () => {
  it.each([['0', null], ['0.1', 0], ['2', 0], ['2.1', 1], ['4', 1], ['4.1', 2], ['6', 2], ['6.1', 3], ['8', 3], ['8.1', 4], ['10.0', 4], ['10.1', null], ['00.5', null], ['1e0', null], ['2.11', null], ['', null]] as const)('数值%s按P10明确边界归档', (raw, expected) => {
    expect(mattressFirmnessBand(raw)).toBe(expected);
  });
  it('在对应档位中独立调位置，越界拦截，不根据数值自动换位置', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.extraIssues!(context, value, layout, fields)).toEqual([]);
    value.mattressSingle.firmnessValue = '8';
    expect(value.mattressSingle.firmnessPosition).toBe(30);
    expect(rules.extraIssues!(context, value, layout, fields).join('')).toContain('偏软指示位置须在60%–80%');
    value.mattressSingle.firmnessPosition = 75; expect(rules.extraIssues!(context, value, layout, fields)).toEqual([]);
    expect(mattressFirmnessCenter(0)).toBe(220); expect(mattressFirmnessCenter(100)).toBe(1220);
  });
  it('只填厚度并截断一位，拒绝长宽高串、范围、零和负数', () => {
    expect(rules.dimensionKinds).toEqual(['height']); expect(rules.parseQuickDimensions('27.99cm')).toEqual(fields);
    for (const raw of ['', '200×180×27', '0', '-1', '20~27', '20/27']) expect(rules.parseQuickDimensions(raw)).toBeNull();
    expect(rules.formatFields(fields)).toBe('27.9');
    const annotation = { kind: 'height' as const, label: '高' as const, value: 27, from: { x: 1.03, y: .6 }, to: { x: 1.03, y: 1 } };
    expect(rules.dimensionLabel(context, annotation, fields, options())).toMatchObject({ letterSpacing: -1.3, runs: [{ text: '27.9cm', font: '52px "Montserrat Semi Bold", sans-serif' }] });
  });
  it('标题、单行材质文案与厚度均按完整内容校验，无样例事实默认值', () => {
    const value = options(), layout = rules.layout([], value);
    expect(rules.hasOptions(rules.createOptions())).toBe(false);
    expect(rules.extraIssues!(context, rules.createOptions(), layout, fields).join('')).toContain('床垫标题');
    value.mattressSingle.headline = '完整标题'.repeat(20);
    value.mattressSingle.materials[0].text = '第一行\n第二行';
    const issues = rules.extraIssues!(context, value, layout, { ...fields, height: '20000000' }).join('');
    expect(issues).toContain('床垫标题需单行'); expect(issues).toContain('材质卖点1文案需单行'); expect(issues).toContain('床垫厚度需单行');
    expect(value.mattressSingle.headline).toBe('完整标题'.repeat(20));
  });
  it('型号右对齐、保留45pt，超长不缩小；三材质卡与主图厚度完全分区', () => {
    const value = options(), layout = rules.layout([], value), badge = rules.modelBadge(context, 'TEST01', layout);
    expect(badge.box.x + badge.box.width).toBe(1350); expect(badge.fontSize).toBe(45);
    expect(rules.model.letterSpacing).toBe(-1.125); expect(rules.modelBadge(context, '测试完整型号'.repeat(20), layout).issue).toContain('不能缩小');
    const annotation = { kind: 'height' as const, label: '高' as const, value: 27.9, from: { x: 1.03, y: .6 }, to: { x: 1.03, y: 1 } };
    const labelSize = rules.dimensionLabel(context, annotation, fields, value);
    const fit = fitAnnotatedProduct(layout.productArea, [{ annotation, labelSize }], layout.subjectSafeArea);
    const moved = adjustAnnotatedProduct(fit.productRect, fit.annotations.map((annotation) => ({ annotation, labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 900, offsetY: 900 });
    expect(moved.bounds.y + moved.bounds.height).toBeLessThanOrEqual(862.001);
    expect(moved.bounds.x + moved.bounds.width).toBeLessThanOrEqual(1380.001);
    expect(mattressMaterialCards()).toHaveLength(3); expect(mattressMaterialCards()[2]).toEqual({ x: 948, y: 1130, width: 432, height: 264 });
  });
  it('保存复制独立内容，恢复保留超长文字与颜色，异常字段回落为空', () => {
    const value = valid(), normalized = normalizeMattressSingle(value); normalized.materials[0].text = '新内容';
    expect(value.materials[0].text).toBe('测试材质');
    expect(normalizeMattressSingle({ headline: 123, materials: [null, { text: 123 }], firmnessPosition: Infinity })).toEqual(normalizeMattressSingle(undefined));
    expect(rules.requiredFonts).toContain('方正兰亭黑_GBK');
    expect(rules.visibleSellingPoints(['不适用旧卖点'], options())).toEqual([]);
  });
});
