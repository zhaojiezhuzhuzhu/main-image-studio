import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { WorkbenchDraft } from './storage/draftStorage';

export const batch13Ids = ['wood-bedside-single', 'drawer-chest-single'] as const;
export function batch13Fixture(id: typeof batch13Ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  if (options.woodBedside) options.woodBedside.noteText = '测试图示备注';
  if (options.drawerChest) { options.drawerChest.noteText = '测试图示备注'; options.drawerChest.widthNote = '测试说明'; }
  const fields = rules.parseQuickDimensions(id === 'wood-bedside-single' ? '44.49×41.89×53.39' : '119.59×43.29×74.99')!;
  return { version: 1, templateId: id, model: id === 'wood-bedside-single' ? 'TEST13床头柜' : 'TEST13斗柜', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: [
      { kind: 'length', label: '长', value: Number(fields.length), from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 } },
      { kind: 'width', label: '宽', value: Number(fields.width), from: { x: 0, y: 1.05 }, to: { x: .55, y: 1.15 } },
      { kind: 'height', label: '高', value: Number(fields.height), from: { x: 1.05, y: 0 }, to: { x: 1.05, y: 1 } },
    ], subjectAdjustment: { scale: .85, offsetX: -10, offsetY: 0 }, image: { name: 'TEST13-cabinet.png', blob: new Blob(['TEST13-cabinet'], { type: 'image/png' }) }, ...rules.saveOptions(options) };
}
