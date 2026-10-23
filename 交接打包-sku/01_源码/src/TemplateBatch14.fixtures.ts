import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { WorkbenchDraft } from './storage/draftStorage';

export const batch14Ids = ['wardrobe-single', 'shoe-cabinet-single'] as const;
export function batch14Fixture(id: typeof batch14Ids[number], low = false): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions(), value = options.wardrobe ?? options.shoeCabinet!;
  value.noteText = '测试图示备注';
  const fields = rules.parseQuickDimensions(id === 'wardrobe-single' ? '159.39×200.39' : `122.39×37.09×${low ? '101.69' : '200.39'}`)!;
  return { version: 1, templateId: id, model: id === 'wardrobe-single' ? 'TEST14衣柜' : 'TEST14鞋柜', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: rules.dimensionKinds.map((kind) => ({ kind, label: ({ length: '长', width: '宽', height: '高' } as const)[kind as 'length' | 'width' | 'height'], value: Number(fields[kind]),
      from: kind === 'height' ? { x: -.08, y: 0 } : kind === 'width' ? { x: 0, y: 1.05 } : { x: 0, y: -.09 },
      to: kind === 'height' ? { x: -.08, y: 1 } : kind === 'width' ? { x: .4, y: 1.1 } : { x: 1, y: -.09 } })),
    subjectAdjustment: { scale: .95, offsetX: 0, offsetY: 0 },
    image: { name: `TEST14-${low ? 'low' : 'tall'}-closed.png`, blob: new Blob(['TEST14-closed'], { type: 'image/png' }) },
    accessories: [{ id: `${id}-open`, image: { name: `TEST14-${low ? 'low' : 'tall'}-open.png`, blob: new Blob(['TEST14-open'], { type: 'image/png' }) }, adjustment: { scale: .9, offsetX: 10, offsetY: 5 } }],
    ...rules.saveOptions(options) };
}
