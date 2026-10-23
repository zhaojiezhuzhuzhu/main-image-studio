import { describe, expect, it } from 'vitest';
import { resolveTemplateId, templateDraftSlot, TEMPLATE_IDS } from './templates';

describe('模板身份与旧项目兼容', () => {
  it('keeps old projects and their temporary workspaces in their original sofa templates', () => {
    expect(resolveTemplateId('single')).toBe('sofa-single');
    expect(resolveTemplateId('combination')).toBe('sofa-combination');
    expect(templateDraftSlot('sofa-single')).toBe('single');
    expect(templateDraftSlot('sofa-combination')).toBe('combination');
  });

  it('gives every template an independent temporary workspace', () => {
    expect(new Set(TEMPLATE_IDS.map(templateDraftSlot)).size).toBe(TEMPLATE_IDS.length);
  });

  it('rejects unknown templates or a template opened as the wrong project kind', () => {
    expect(() => resolveTemplateId('single', 'sofa-bed-combination')).toThrow('不匹配');
    expect(() => resolveTemplateId('single', 'unknown')).toThrow('无法识别');
    expect(() => resolveTemplateId('single', '__proto__')).toThrow('无法识别');
  });
});
