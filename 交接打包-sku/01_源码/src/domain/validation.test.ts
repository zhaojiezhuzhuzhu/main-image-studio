import { describe, expect, it } from 'vitest';
import { validateProject } from './validation';

describe('validateProject', () => {
  it('缺少产品或型号时禁止导出', () => {
    expect(validateProject({ model: '', hasProduct: false })).toEqual(['请上传透明 PNG 产品图', '请填写产品型号']);
  });
  it('完整基础资料可导出', () => {
    expect(validateProject({ model: 'G260', hasProduct: true })).toEqual([]);
  });
});
