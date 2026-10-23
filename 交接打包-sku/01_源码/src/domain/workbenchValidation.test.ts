import { describe, expect, it } from 'vitest';
import { validateCombinationWorkbench, validateSingleWorkbench } from './workbenchValidation';

describe('工作台统一检查规则', () => {
  it('启用中文说明的尺寸仍须完成标注才可导出', () => {
    const input = { model: '测试餐桌', hasImage: true, allowDimensionText: true,
      dimensionFields: { length: '尺寸可选：140/160', width: '', height: '' },
      annotations: [], annotationInProgress: false, sellingPoints: [] };
    expect(validateSingleWorkbench(input).blockers).toEqual(['请完成已填写尺寸的标注：长']);
    expect(validateSingleWorkbench({ ...input, annotations: [{ kind: 'length', label: '长', value: 140,
      from: { x: 0, y: .2 }, to: { x: 1, y: .6 } }] }).blockers).toEqual([]);
  });
  it('圆桌只要求已填写的直径和高，直径未标注时阻止导出', () => {
    const input = { model: 'TEST圆餐桌', hasImage: true,
      dimensionFields: { length: '', width: '', height: '', diameter: '81.6~130/91.6~150' },
      annotations: [], annotationInProgress: false, sellingPoints: [] };
    expect(validateSingleWorkbench(input).blockers).toEqual(['请完成已填写尺寸的标注：直径']);
    expect(validateSingleWorkbench({ ...input, annotations: [{ kind: 'diameter', label: '直径', value: 81.6,
      from: { x: 0, y: .2 }, to: { x: 1, y: .6 } }] }).blockers).toEqual([]);
  });
  it('床头、床尾及范围首值均参与未完成标注检查', () => {
    const result = validateSingleWorkbench({ model: 'BC553-A床', hasImage: true,
      dimensionFields: { length: '100~196', width: '', height: '', headWidth: '168/198', footWidth: '183/193' },
      annotations: [], annotationInProgress: false, sellingPoints: [] });
    expect(result.blockers).toContain('请完成已填写尺寸的标注：长、床头宽、床尾宽');
  });
  it('treats untouched optional single-product fields as complete', () => {
    const result = validateSingleWorkbench({
      model: 'A1', hasImage: true, dimensionFields: { length: '', width: '', height: '' }, annotations: [],
      annotationInProgress: false, sellingPoints: ['', '', ''],
      fontIssue: '',
    });
    expect(result.blockers).toEqual([]);
    expect(result.completed).toBe(5);
  });

  it('blocks export when a selected dimension has no annotation', () => {
    const result = validateSingleWorkbench({
      model: 'A1', hasImage: true, dimensionFields: { length: '240', width: '', height: '' }, annotations: [],
      annotationInProgress: false, sellingPoints: ['', '', ''],
      fontIssue: '',
    });
    expect(result.blockers).toContain('请完成已填写尺寸的标注：长');
  });

  it('allows a partial selling-point group with a visible warning', () => {
    const result = validateSingleWorkbench({
      model: 'A1', hasImage: true, dimensionFields: { length: '', width: '', height: '' }, annotations: [],
      annotationInProgress: false, sellingPoints: ['舒适', '', ''],
      fontIssue: '',
    });
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });

  it('requires every enabled combination dimension to be annotated', () => {
    const result = validateCombinationWorkbench({
      model: 'A1', hasMainImage: true, mainDimensionFields: { length: '', width: '', height: '' }, mainAnnotations: [],
      mainAnnotationInProgress: false,
      optionalSizes: [{
        hasImage: true,
        dimensionFields: { length: '210', width: '88', height: '' },
        annotations: [{ kind: 'length', label: '长', value: 210, from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
        annotationInProgress: false,
      }],
      noteEnabled: false, note: '', layoutIssues: [], fontIssue: '',
    });
    expect(result.blockers).toContain('规格 1 请完成已填写尺寸的标注：宽');
  });
});
