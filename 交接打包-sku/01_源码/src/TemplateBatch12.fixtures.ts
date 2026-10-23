import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { WorkbenchDraft } from './storage/draftStorage';
import { normalizeSoftBedCombination } from './domain/softBedCombinationLayout';
import { normalizeSoftBedMulti } from './domain/softBedMultiCombinationLayout';

export const batch12Ids = ['soft-bed-combination', 'soft-bed-multi-combination'] as const;
export function batch12Fixture(id: typeof batch12Ids[number]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  const firmness = { mode: 'double', faces: [{ value: '1.1', position: 10 }, { value: '2.8', position: 30 }] };
  options.softBedCombination = normalizeSoftBedCombination({ cabinetModel: 'TEST柜', mattress: { title: '测试床垫', thickness: '21.99', model: 'TEST垫', points: ['测试卖点一', '测试卖点二', '测试卖点三'], firmness } });
  options.softBedMultiCombination = normalizeSoftBedMulti({ cabinetModels: ['TEST柜一', 'TEST柜二'], mattresses: Array.from({ length: 3 }, (_, i) => ({ title: `测试床垫${i + 1}`, thickness: '21.99', model: `TEST垫${i + 1}`, firmness: i === 0 ? firmness : { mode: 'double', faces: [{ value: '1.1', position: 10 }, { value: i === 1 ? '1.7' : '1.1', position: 30 }] } })) });
  const fields = rules.parseQuickDimensions('223.99×168.99/198.99/208.99×118.99')!;
  const image = (name: string) => ({ name, blob: new Blob([`TEST:${name}`], { type: 'image/png' }) });
  return { version: 1, templateId: id, model: 'TEST12床', modelManuallyEdited: true, sellingPoints: [], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: rules.dimensionKinds.map((kind) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', value: Number(fields[kind]!.split('/')[0]),
      from: kind === 'height' ? { x: -.04, y: 0 } : { x: 0, y: kind === 'length' ? 1.08 : -.1 },
      to: kind === 'height' ? { x: -.04, y: 1 } : { x: 1, y: kind === 'length' ? 1.08 : -.1 } })),
    subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: image('TEST-bed.png'), ...rules.saveOptions(options),
    accessories: rules.accessories!(options, rules.layout([], options)).map((slot) => ({ id: slot.id, image: image(`${slot.id}.png`), adjustment: { scale: .8, offsetX: 0, offsetY: 0 } })) };
}
