import { describe, expect, it } from 'vitest';
import { adjustAnnotatedProduct, annotationCollisionRects, fitAnnotatedProduct } from './annotatedProductFit';
import { completeDimension, type DimensionAnnotation } from './dimensionAnnotations';
import { dimensionsFromFields } from './dimensions';
import { encodeProjectFile, decodeProjectFile } from '../project/projectFile';
import { createRoundExtendableTableFields, formatRoundExtendableTableFields, getRoundExtendableTableSingleLayout, normalizeRoundExtendableTableOptions, parseRoundExtendableTableDimensions, roundExtendableTableDimensionIssue, roundExtendableTableDimensionLabel, roundExtendableTableModelBadge, roundExtendableTableNote, roundExtendableTableTextIssues, type RoundExtendableTableDraft } from './roundExtendableTableSingleLayout';
import { roundExtendableTableSingleRules as rules } from '../templates/round-extendable-table-single';

const context = { font: '', measureText(text: string) { return { width: Array.from(text).reduce((sum, character) => sum + (/[^\x00-\x7f]/.test(character) ? 1 : .6), 0) * parseFloat(this.font) } as TextMetrics; } };
// 以下数值仅为测试参数，不代表任何实物产品。
const fields = { length: '', width: '', diameter: '81.69~130.99/91.69~150.99', height: '75.39' };
const annotation: DimensionAnnotation = { kind: 'diameter', label: '直径', value: 81.6, from: { x: 420, y: 560 }, to: { x: 1020, y: 720 } };
const options = normalizeRoundExtendableTableOptions(undefined);

describe('圆伸缩餐桌：第38页独立规范', () => {
  it('快速尺寸使用真实直径，支持单值、范围和多规格，截断一位且不生成长宽', () => {
    expect(createRoundExtendableTableFields()).toEqual({ length: '', width: '', height: '', diameter: '' });
    expect(parseRoundExtendableTableDimensions('81.69～130.99/91.69~150.99cm×75.39厘米')).toEqual({ length: '', width: '', diameter: '81.6~130.9/91.6~150.9', height: '75.3' });
    expect(parseRoundExtendableTableDimensions('90.99x75.99')).toEqual({ length: '', width: '', diameter: '90.9', height: '75.9' });
    expect(parseRoundExtendableTableDimensions('80/90×75/76')).toEqual({ length: '', width: '', diameter: '80/90', height: '75/76' });
    expect(formatRoundExtendableTableFields(fields)).toBe('81.69~130.99/91.69~150.99×75.39');
    const dimensions = dimensionsFromFields(fields, 'truncate');
    expect(dimensions).toEqual({ diameter: 81.6, height: 75.3 });
    expect(completeDimension([], dimensions, annotation.from, annotation.to, 'diameter')[0]).toMatchObject({ kind: 'diameter', label: '直径', value: 81.6 });
  });

  it('缺项、零、负数、连续范围、逆向范围和不对应的高度均给出明确提示', () => {
    for (const value of ['', '0×75', '-80×75', '130~80×75', '80~100~130×75', '80/×75', '80×75×90', '80×75~80', '80/90×75/76/77', 'abc×75']) {
      expect(parseRoundExtendableTableDimensions(value), value).toBeNull();
    }
    expect(roundExtendableTableDimensionIssue({ ...fields, diameter: '' })).toContain('直径');
    expect(roundExtendableTableDimensionIssue({ ...fields, height: '' })).toContain('高度');
    expect(roundExtendableTableDimensionIssue({ ...fields, height: '75/76/77' })).toContain('逐项对应');
    expect(roundExtendableTableDimensionIssue(fields)).toBeNull();
  });

  it('每个规格带cm，长直径折行时保留所有规格、分隔符和完整边界', () => {
    const manyFields = { ...fields, diameter: '81.69~130.99/91.69~150.99/101.69~170.99' };
    const label = roundExtendableTableDimensionLabel(context, annotation, manyFields, options);
    expect(label.runs.length).toBeGreaterThan(1);
    expect(label.runs.map((run) => run.text).join('').replace(/\s/g, '')).toBe('81.6~130.9cm/91.6~150.9cm/101.6~170.9cm');
    expect(label.width).toBeLessThanOrEqual(660);
    expect(label.height).toBe(45 + (label.runs.length - 1) * 54);
    for (const run of label.runs) {
      expect(Math.abs(run.y) + 22.5).toBeLessThanOrEqual(label.height / 2);
      expect(run.font).toBe('45px Montserrat, "方正兰亭准黑_GBK", sans-serif');
    }
    const plain = roundExtendableTableDimensionLabel(context, annotation, { ...fields, diameter: '90.99' }, options);
    expect(plain.runs.map((run) => run.text)).toEqual(['90.9cm']);
  });

  it('高度说明按需显示并折行，真实字体的上下边界纳入标签高度', () => {
    const height = { ...annotation, kind: 'height' as const, label: '高' as const };
    expect(roundExtendableTableDimensionLabel(context, height, fields, options).runs).toHaveLength(1);
    const withNote = { ...options, heightNote: '测试参数说明一行\n测试参数说明第二行' };
    const label = roundExtendableTableDimensionLabel(context, height, fields, withNote);
    expect(label.runs.map((run) => run.text).join('')).toBe('75.3cm（测试参数说明一行测试参数说明第二行）');
    expect(label.runs.length).toBeGreaterThan(3);
    expect(label.width).toBeLessThanOrEqual(380);
    const metricContext = { font: '', textBaseline: 'alphabetic' as CanvasTextBaseline, measureText(text: string) { expect(this.textBaseline === 'middle' || this.textBaseline === 'alphabetic').toBe(true); return { width: text.length * 25, actualBoundingBoxAscent: 28, actualBoundingBoxDescent: 20 } as TextMetrics; } };
    const measured = roundExtendableTableDimensionLabel(metricContext, height, fields, options);
    expect(measured.height).toBe(56);
    expect(metricContext.textBaseline).toBe('alphabetic');
  });

  it('两至三个卖点间距固定30px，底部路径留白80px；备注启用后预留完整50px字面', () => {
    for (const noteText of ['', '测试参数：仅用于布局验证']) {
      for (const dimensionGap of [30, 60, 120]) {
        for (const widths of [[250, 350, 250], [250, 350], [700, 100, 100]]) {
          const selected = { ...options, dimensionGap, noteText };
          const layout = getRoundExtendableTableSingleLayout(widths, selected);
          expect(layout.issue).toBeNull();
          expect(layout.sellingPoints).toHaveLength(widths.length);
          layout.sellingPoints.forEach((box, index) => {
            expect(box.width).toBeGreaterThanOrEqual(widths[index] + 50);
            expect(box.x).toBeGreaterThanOrEqual(94 - .001);
            expect(box.x + box.width).toBeLessThanOrEqual(1346 + .001);
            expect(box.height).toBe(98);
            expect(1440 - box.y - box.height).toBe(80);
            if (index) expect(box.x - layout.sellingPoints[index - 1].x - layout.sellingPoints[index - 1].width).toBeCloseTo(30);
          });
          const bottom = layout.subjectSafeArea.y + layout.subjectSafeArea.height;
          expect((noteText ? 1180 : 1260) - bottom).toBe(dimensionGap);
        }
      }
    }
    expect(getRoundExtendableTableSingleLayout([800, 800, 800], options).issue).toContain('超出安全区');
    expect(roundExtendableTableNote(options)).toBeUndefined();
    expect(roundExtendableTableNote({ ...options, noteText: '测试备注' })).toMatchObject({ text: '测试备注', font: '38px Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#545454' });
  });

  it('外置多行直径标注和高度说明经缩放拖动后，全部范围仍在安全区内', () => {
    const selected = { ...options, noteText: '测试参数', heightNote: '含测试脚垫' };
    const layout = getRoundExtendableTableSingleLayout([200, 200, 200], selected);
    const outside = { ...annotation, from: { x: 420, y: 510 }, to: { x: 1050, y: 520 } };
    const height: DimensionAnnotation = { kind: 'height', label: '高', value: 75.3, from: { x: 280, y: 600 }, to: { x: 280, y: 1060 } };
    const measured = [outside, height].map((item) => ({ annotation: item, labelSize: roundExtendableTableDimensionLabel(context, item, fields, selected) }));
    const fitted = fitAnnotatedProduct(layout.productArea, measured, layout.subjectSafeArea);
    const adjusted = adjustAnnotatedProduct(fitted.productRect, fitted.annotations.map((item, index) => ({ annotation: item, labelSize: measured[index].labelSize })), layout.subjectSafeArea, { scale: 3, offsetX: 900, offsetY: 900 });
    adjusted.annotations.forEach((item, index) => {
      for (const box of annotationCollisionRects({ annotation: item, labelSize: measured[index].labelSize }, adjusted.productRect)) {
        expect(box.x).toBeGreaterThanOrEqual(layout.subjectSafeArea.x - .01);
        expect(box.y).toBeGreaterThanOrEqual(layout.subjectSafeArea.y - .01);
        expect(box.x + box.width).toBeLessThanOrEqual(layout.subjectSafeArea.x + layout.subjectSafeArea.width + .01);
        expect(box.y + box.height).toBeLessThanOrEqual(layout.subjectSafeArea.y + layout.subjectSafeArea.height + .01);
      }
    });
  });

  it('长标题、超长尺寸、多规格和备注溢出保留文字并提示调整，绝不省略规格', () => {
    const layout = getRoundExtendableTableSingleLayout([200, 200, 200], options);
    const full = 'RQ3R-A 圆伸缩餐桌 1.3m/1.5m 测试参数';
    expect(roundExtendableTableModelBadge(context, full, layout)).toMatchObject({ text: full, fontSize: 45, issue: null });
    const tooLong = '完整型号规格'.repeat(20);
    expect(roundExtendableTableModelBadge(context, tooLong, layout)).toMatchObject({ text: tooLong, fontSize: 45 });
    expect(roundExtendableTableModelBadge(context, tooLong, layout).issue).toContain('不能省略规格');
    for (const model of ['完整型号\n完整规格', '完整型号\t完整规格', '\n完整型号规格']) {
      expect(roundExtendableTableModelBadge(context, model, layout).issue).toContain('换行或制表符');
    }
    expect(roundExtendableTableTextIssues(context, { ...fields, diameter: Array(30).fill('81.6~130').join('/') }, options).join()).toContain('直径规格过长');
    expect(roundExtendableTableTextIssues(context, { ...fields, diameter: '123456789012345~123456789012346' }, options).join()).toContain('直径规格过长');
    expect(roundExtendableTableTextIssues(context, fields, { ...options, heightNote: '测试'.repeat(50), noteText: '完整备注'.repeat(50) }).join()).toContain('高度及说明过长');
    expect(roundExtendableTableTextIssues(context, fields, { ...options, noteText: '测试\n备注' })).toContain('底部备注超出单行安全区，请调整为一行完整说明');
  });

  it('源文件往返保持原始数值文本、空长宽字段、备注空格和高度换行', async () => {
    const selected = { ...options, sellingPointCount: 2 as const, dimensionGap: 48, noteText: '  测试参数备注  ', heightNote: '  测试高度说明\n第二行  ' };
    const draft: RoundExtendableTableDraft = { version: 1, templateId: 'round-extendable-table-single', model: '测试参数：完整型号规格', modelManuallyEdited: true, sizeInput: '81.69~130.99/91.69~150.99×75.39', dimensionFields: fields, sellingPoints: ['测试一', '测试二', '测试三'], annotations: [annotation], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, ...rules.saveOptions(selected) };
    const restored = await decodeProjectFile(await encodeProjectFile(draft, 'single', 'round-extendable-table-test'));
    expect(restored.draft).toEqual(draft);
    expect(rules.restoreOptions(restored.draft as RoundExtendableTableDraft)).toEqual(selected);
  });
});
