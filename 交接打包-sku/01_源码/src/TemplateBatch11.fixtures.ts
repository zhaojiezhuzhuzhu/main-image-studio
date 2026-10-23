import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { WorkbenchDraft } from './storage/draftStorage';

export const batch11Ids = ['mattress-double', 'pillow-single'] as const;
export function batch11Fixture(id: typeof batch11Ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  options.mattressDouble = { headline: '测试双面床垫', faces: [{ description: '测试正面说明', value: '1.1', position: 10 }, { description: '测试反面说明', value: '2.8', position: 30 }], materials: Array.from({ length: 3 }, () => ({ text: '测试材质', textColor: 'white' })) };
  options.pillowSingle = { headline: '测试枕头', subtitle: '测试说明', quantity: 2, zoneText: '测试区8cm', zoneX: 50, zoneY: 30, materials: Array.from({ length: 3 }, () => ({ text: '测试材质', textColor: 'black' })) };
  const fields = rules.parseQuickDimensions(id === 'mattress-double' ? '27.99' : '57.99×37.99×11.99')!;
  const image = (name: string) => ({ name, blob: new Blob([`TEST:${name}`], { type: 'image/png' }) });
  return { version: 1, templateId: id, model: 'TEST11', modelManuallyEdited: true, sellingPoints: [], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: rules.dimensionKinds.map((kind) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', value: Number(fields[kind]),
      from: kind === 'height' ? { x: 1.04, y: .6 } : { x: 0, y: kind === 'length' ? -.1 : 1.1 },
      to: kind === 'height' ? { x: 1.04, y: 1 } : { x: 1, y: kind === 'length' ? -.1 : 1.1 } })),
    subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: image('TEST-main.png'), ...rules.saveOptions(options),
    accessories: rules.accessories!(options, rules.layout([], options)).map((slot) => ({ id: slot.id, image: image(`${slot.id}.png`), adjustment: { scale: 1.5, offsetX: -20, offsetY: -10 } })) };
}
