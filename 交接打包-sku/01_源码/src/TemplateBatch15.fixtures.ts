import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { WorkbenchDraft } from './storage/draftStorage';

export const batch15Ids = ['shaped-vanity-single', 'wood-desk-single'] as const;
export function batch15Fixture(id: typeof batch15Ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  if (options.shapedVanity) options.shapedVanity.noteText = '测试图示备注';
  if (options.woodDesk) options.woodDesk.noteText = '测试图示备注';
  const fields = rules.parseQuickDimensions(id === 'shaped-vanity-single' ? '72.19×60.09×92.29' : '120.09×60.09×76.09')!;
  return { version: 1, templateId: id, model: id === 'shaped-vanity-single' ? 'TEST15妆台' : 'TEST15书桌', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: [
      { kind: 'length', label: '长', value: Number(fields.length), from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 } },
      { kind: 'width', label: '宽', value: Number(fields.width), from: { x: 0, y: 1.05 }, to: { x: .55, y: 1.15 } },
      { kind: 'height', label: '高', value: Number(fields.height), from: { x: 1.05, y: 0 }, to: { x: 1.05, y: 1 } },
    ], subjectAdjustment: { scale: .85, offsetX: -10, offsetY: 0 }, image: { name: 'TEST15-cabinet.png', blob: new Blob(['TEST15-cabinet'], { type: 'image/png' }) }, ...rules.saveOptions(options) };
}
