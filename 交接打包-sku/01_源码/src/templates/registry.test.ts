import { expect, it } from 'vitest';
import { TEMPLATES, TEMPLATE_IDS } from '../domain/templates';
import { COMBINATION_TEMPLATE_RULES, SINGLE_TEMPLATE_RULES, isCombinationTemplateId, isSingleTemplateId } from './registry';

it('所有开放模板只登记到一个匹配的编辑器，独立创建选项', () => {
  for (const id of TEMPLATE_IDS.filter((template) => TEMPLATES[template].available)) {
    expect(Number(isSingleTemplateId(id)) + Number(isCombinationTemplateId(id))).toBe(1);
    expect(isSingleTemplateId(id) ? 'single' : 'combination').toBe(TEMPLATES[id].kind);
    const rules = isSingleTemplateId(id) ? SINGLE_TEMPLATE_RULES[id] : isCombinationTemplateId(id) ? COMBINATION_TEMPLATE_RULES[id] : undefined;
    expect(rules).toBeDefined();
    expect(rules!.createOptions()).not.toBe(rules!.createOptions());
  }
});
