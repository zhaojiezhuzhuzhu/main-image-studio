import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { WorkbenchDraft } from './storage/draftStorage';
import type { DimensionAnnotation } from './domain/dimensionAnnotations';

export const batch16Ids = ['wood-long-table-single', 'wood-round-table-single'] as const;
export function batch16Fixture(id: typeof batch16Ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  (options.woodLongTable ?? options.woodRoundTable!).noteText = '测试图示备注';
  const fields = rules.parseQuickDimensions(id === 'wood-long-table-single' ? '140.09/160.09/180.09×80.09×75.09' : '110.09×75.39')!;
  const annotations: DimensionAnnotation[] = id === 'wood-long-table-single' ? [
    { kind: 'length', label: '长', value: 140, from: { x: 0, y: -.1 }, to: { x: .8, y: -.2 } },
    { kind: 'width', label: '宽', value: 80, from: { x: .8, y: -.2 }, to: { x: 1, y: -.05 } },
    { kind: 'height', label: '高', value: 75, from: { x: -.1, y: .15 }, to: { x: -.1, y: .9 } },
  ] : [
    { kind: 'diameter', label: '直径', value: 110, from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 } },
    { kind: 'height', label: '高', value: 75.3, from: { x: 1.05, y: .2 }, to: { x: 1.05, y: 1 } },
  ];
  return { version: 1, templateId: id, model: id === 'wood-long-table-single' ? 'TEST16长餐桌' : 'TEST16圆餐桌', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields, annotations,
    subjectAdjustment: { scale: .9, offsetX: 0, offsetY: 0 }, image: { name: `TEST16-${id}.png`, blob: new Blob(['TEST16-table'], { type: 'image/png' }) }, ...rules.saveOptions(options) };
}
