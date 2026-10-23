import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import type { SingleTemplateRules } from './templates/types';
import type { WorkbenchDraft, SofaCombinationDraft } from './storage/draftStorage';
import { normalizeWoodBedCombination } from './domain/woodBedCombinationLayout';
import { normalizeWoodBedMulti } from './domain/woodBedMultiCombinationLayout';
import { dimensionTask, type DimensionKind } from './domain/dimensionAnnotations';
import { dimensionsFromFields } from './domain/dimensions';

export const completionIds = ['wardrobe-combination', 'shoe-cabinet-combination', 'vanity-dresser-single', 'vanity-dresser-combination', 'shaped-vanity-combination', 'drawer-chest-combination', 'wood-desk-combination', 'wood-desk-multi-combination', 'wood-bed-combination', 'wood-bed-multi-combination', 'wood-bed-single', 'wood-dining-chair-single'] as const;
export const completionSamples = {
  'wardrobe-combination': '199.69×250.39', 'shoe-cabinet-combination': '171.89×200.39',
  'vanity-dresser-single': '190.39~211.49×40.09×74.99×68.79', 'vanity-dresser-combination': '190.39~211.49×40.09×74.99×68.79',
  'shaped-vanity-combination': '72.19×60.09×92.29', 'drawer-chest-combination': '180.19×43.29×113.49×74.99',
  'wood-desk-combination': '120.09×60.09×76.09', 'wood-desk-multi-combination': '120.09×60.09×76.09×60.09×35.09×196.59',
  'wood-bed-combination': '223.99×157.99/187.99×106.99', 'wood-bed-multi-combination': '223.99×157.99/187.99×106.99',
  'wood-bed-single': '223.99×157.99/187.99×106.99', 'wood-dining-chair-single': '47.29×41.89×77.09',
};
export function completionFixture(id: typeof completionIds[number]): WorkbenchDraft {
  const rules: SingleTemplateRules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  if (options.woodBedCombination) options.woodBedCombination = normalizeWoodBedCombination({ cabinetModel: 'TEST柜', cabinetDimensions: { length: '44.49', height: '52.29' },
    mattress: { title: '测试床垫', model: 'TEST垫', thickness: '20.09', points: ['测试一', '测试二', '测试三'], firmness: { mode: 'double', faces: [{ value: '1.1', position: 10 }, { value: '2.8', position: 30 }] } } });
  if (options.woodBedMultiCombination) options.woodBedMultiCombination = normalizeWoodBedMulti({ cabinetCount: 1, mattressCount: 2, cabinetModels: ['TEST柜一', 'TEST柜二'],
    cabinetDimensions: [{ length: '44.49', height: '52.29' }, { length: '50.59', height: '62.29' }],
    mattresses: Array.from({ length: 3 }, (_, i) => ({ title: `测试床垫${i + 1}`, thickness: '20.09', model: `TEST垫${i + 1}`, firmness: { mode: 'single', faces: [{ value: '2.5', position: 30 }] } })) });
  const fields = rules.parseQuickDimensions(completionSamples[id])!, dimensions = dimensionsFromFields(fields, 'truncate');
  const image = (name: string) => ({ name, blob: new Blob([`TEST:${name}`], { type: 'image/png' }) });
  return { version: 1, templateId: id, model: 'TEST收尾完整规格', modelManuallyEdited: true, sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: (Object.keys(dimensions) as DimensionKind[]).map((kind) => ({ ...dimensionTask(dimensions, kind)!,
      from: kind === 'secondaryLength' ? { x: .6, y: -.1 } : kind === 'secondaryWidth' ? { x: .7, y: 1.08 } : kind === 'height' ? { x: -.08, y: 0 } : kind === 'secondaryHeight' ? { x: 1.08, y: .3 } : { x: 0, y: kind === 'length' ? -.1 : 1.08 },
      to: kind === 'secondaryLength' ? { x: 1, y: -.1 } : kind === 'secondaryWidth' ? { x: 1, y: 1.15 } : kind === 'height' ? { x: -.08, y: 1 } : kind === 'secondaryHeight' ? { x: 1.08, y: 1 } : { x: kind === 'length' ? (id === 'wood-desk-multi-combination' ? .45 : .8) : .35, y: kind === 'length' ? -.15 : 1.15 } })),
    subjectAdjustment: { scale: .85, offsetX: 0, offsetY: 0 }, image: image(`TEST-${id}.png`), ...rules.saveOptions(options),
    accessories: (rules.accessories?.(options, rules.layout([], options)) ?? []).map((slot) => ({ id: slot.id, image: image(`${slot.id}.png`), adjustment: { scale: .8, offsetX: 0, offsetY: 0 } })) };
}
export function functionalCompletionFixture(): SofaCombinationDraft {
  const base = completionFixture('wood-desk-combination');
  return { version: 1, templateId: 'functional-sofa-combination', kind: 'functional', model: 'TEST功能沙发', modelManuallyEdited: true,
    sizeInput: '293×100~157×80~91', dimensionFields: { length: '293', width: '100~157', height: '80~91' }, annotations: base.annotations, subjectAdjustment: base.subjectAdjustment,
    mainImage: base.image, optionalSizes: [{ id: 'optional-one', sizeInput: '249××', dimensionFields: { length: '249', width: '', height: '' }, annotations: [base.annotations[0]], image: base.image }],
    optionalLabelEnabled: true, optionalLabelOffsetY: 0, optionalLabelSide: 'left', noteEnabled: true, note: '*实际尺寸请以下单规格为准' };
}
