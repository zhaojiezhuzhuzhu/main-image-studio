import { expect, it } from 'vitest';
import { filenameNameCandidate, modelFromFilename, parseProductFilename, resolveModelOnUpload } from './modelFromFilename';
import { SINGLE_TEMPLATE_RULES, COMBINATION_TEMPLATE_RULES } from '../templates/registry';
it('extracts leading model from product filename',()=>expect(modelFromFilename('PS060-A1-透明素材-沙发.png')).toBe('PS060-A1'));
it('keeps a manually entered model when a file is uploaded',()=>expect(resolveModelOnUpload('手动型号',true,'G386-A-透明素材.png')).toBe('手动型号'));
it('fills an empty untouched model from the filename',()=>expect(resolveModelOnUpload('',false,'G386-A-透明素材.png')).toBe('G386-A'));

it.each(['YZ2R-A', 'AB12C3-X9-02', 'PS060-A1', 'BY13-A', 'G370-A'])('完整识别字母数字交错及多段型号 %s', (model) => {
  expect(modelFromFilename(`${model}-透明素材-电脑椅.png`)).toBe(model);
});

it('用户案例正确提取完整型号和1.6m长餐桌，素材说明和材质独立保留', () => {
  const filename = 'YZ2R-A-透明素材-1.6m长餐桌-（罗马洞石）(1).PNG';
  expect(parseProductFilename(filename)).toEqual({ model: 'YZ2R-A', specification: '1.6m长餐桌', details: ['罗马洞石'], ambiguous: false });
  expect(filenameNameCandidate(filename, { includeSpecification: true })).toMatchObject({ value: 'YZ2R-A 1.6m长餐桌', issue: '' });
  expect(filenameNameCandidate('YZ2R-A 透明素材 1.6m长餐桌.png', { includeSpecification: true }).value).toBe('YZ2R-A 1.6m长餐桌');
});

it.each(['1.6m长餐桌', '160cm-长餐桌', '160×80×75cm-长餐桌'])('尺寸规格 %s 不被当作型号后缀或丢失', (specification) => {
  expect(filenameNameCandidate(`YZ2R-A-${specification}.png`, { includeSpecification: true }).value).toBe(`YZ2R-A ${specification.replace('-', '')}`);
});

it('保留带扶手等规格限定，去重品类名并保留颜色信息', () => {
  expect(parseProductFilename('G370-A-透明素材-沙发床-贝母白-双人沙发床(1).png')).toMatchObject({ model: 'G370-A', specification: '双人沙发床', details: ['贝母白'] });
  expect(parseProductFilename('BY13-A电脑椅（带扶手）.png').specification).toBe('电脑椅（带扶手）');
});

it('不能确定规格时只填型号并明确待补充，不把材料或多个规格当作完整名称', () => {
  expect(filenameNameCandidate('YZ2R-A-透明素材-罗马洞石.png', { includeSpecification: true })).toMatchObject({ value: 'YZ2R-A', issue: '仅识别到型号，规格待补充' });
  const ambiguous = filenameNameCandidate('YZ2R-A-1.6m长餐桌-1.8m长餐桌.png', { includeSpecification: true });
  expect(ambiguous.value).toBe('YZ2R-A');
  expect(ambiguous.issue).toContain('多个规格候选');
  expect(ambiguous.parts.details).toEqual(['1.6m长餐桌', '1.8m长餐桌']);
  expect(modelFromFilename('透明素材-长餐桌.png')).toBeNull();
  expect(modelFromFilename('AB12.5长餐桌.png')).toBeNull();
});

it('各模板独立决定型号及规格展示，新增餐桌保留完整规格', () => {
  const filename = 'YZ2R-A-透明素材-1.6m长餐桌-（罗马洞石）.png';
  const allRules = { ...SINGLE_TEMPLATE_RULES, ...COMBINATION_TEMPLATE_RULES };
  const expected = { 'functional-sofa-combination': 'YZ2R-A',  'wood-dining-chair-single': 'YZ2R-A 1.6m长餐桌',  'wood-bed-single': 'YZ2R-A 1.6m长餐桌',  'wood-bed-multi-combination': 'YZ2R-A 1.6m长餐桌',  'wood-bed-combination': 'YZ2R-A 1.6m长餐桌',  'wardrobe-combination': 'YZ2R-A 1.6m长餐桌', 'shoe-cabinet-combination': 'YZ2R-A 1.6m长餐桌', 'vanity-dresser-single': 'YZ2R-A 1.6m长餐桌', 'vanity-dresser-combination': 'YZ2R-A 1.6m长餐桌', 'shaped-vanity-combination': 'YZ2R-A 1.6m长餐桌', 'drawer-chest-combination': 'YZ2R-A 1.6m长餐桌', 'wood-desk-combination': 'YZ2R-A 1.6m长餐桌', 'wood-desk-multi-combination': 'YZ2R-A 1.6m长餐桌',  'wood-long-table-combination': 'YZ2R-A 1.6m长餐桌', 'wood-round-table-combination': 'YZ2R-A 1.6m长餐桌', 'wood-long-table-single': 'YZ2R-A 1.6m长餐桌', 'wood-round-table-single': 'YZ2R-A 1.6m长餐桌', 'shaped-vanity-single': 'YZ2R-A 1.6m长餐桌', 'wood-desk-single': 'YZ2R-A 1.6m长餐桌', 'wardrobe-single': 'YZ2R-A 1.6m长餐桌', 'shoe-cabinet-single': 'YZ2R-A 1.6m长餐桌', 'wood-bedside-single': 'YZ2R-A 1.6m长餐桌', 'drawer-chest-single': 'YZ2R-A 1.6m长餐桌', 'soft-bed-combination': 'YZ2R-A 1.6m长餐桌', 'soft-bed-multi-combination': 'YZ2R-A 1.6m长餐桌', 'mattress-double': 'YZ2R-A 1.6m长餐桌', 'pillow-single': 'YZ2R-A 1.6m长餐桌', 'study-chair-single': 'YZ2R-A 1.6m长餐桌', 'mattress-single': 'YZ2R-A 1.6m长餐桌', 'computer-chair-single': 'YZ2R-A 1.6m长餐桌', 'ergonomic-chair-single': 'YZ2R-A 1.6m长餐桌', 'dining-chair-single': 'YZ2R-A 1.6m长餐桌', 'lifting-side-table-single': 'YZ2R-A 1.6m长餐桌', 'study-desk-single': 'YZ2R-A 1.6m长餐桌', 'study-desk-combination': 'YZ2R-A 1.6m长餐桌', 'standing-desk-single': 'YZ2R-A 1.6m长餐桌', 'standing-desk-combination': 'YZ2R-A 1.6m长餐桌', 'sofa-single': 'YZ2R-A', 'sofa-combination': 'YZ2R-A', 'sofa-bed-combination': 'YZ2R-A', 'soft-bed-single': 'YZ2R-A床', 'office-chair-single': 'YZ2R-A 1.6m长餐桌', 'footstool-single': 'YZ2R-A 1.6m长餐桌', 'long-dining-table-single': 'YZ2R-A 1.6m长餐桌', 'round-extendable-table-single': 'YZ2R-A 1.6m长餐桌', 'functional-sofa-single': 'YZ2R-A', 'bedside-cabinet-single': 'YZ2R-A 1.6m长餐桌', 'long-dining-table-combination': 'YZ2R-A 1.6m长餐桌', 'round-extendable-table-combination': 'YZ2R-A 1.6m长餐桌' };
  for (const id of Object.keys(allRules) as Array<keyof typeof allRules>) {
    expect(resolveModelOnUpload('', false, filename, allRules[id].filenameName)).toBe(expected[id]);
    expect(resolveModelOnUpload('手动完整名称', true, filename, allRules[id].filenameName)).toBe('手动完整名称');
    expect(resolveModelOnUpload('', true, filename, allRules[id].filenameName)).toBe('');
    expect(resolveModelOnUpload('已存名称', false, filename, allRules[id].filenameName)).toBe('已存名称');
  }
  expect(filenameNameCandidate('PS060-A1-透明素材-大号脚踏（75×65.5）.png', allRules['footstool-single'].filenameName).value).toBe('PS060-A1 大号脚踏（75×65.5）');
});
