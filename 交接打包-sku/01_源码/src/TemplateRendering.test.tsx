import { completionFixture, completionIds, functionalCompletionFixture } from './TemplateCompletion.fixtures';
// @vitest-environment jsdom
import { act } from 'react';
import { batch11Fixture, batch11Ids } from './TemplateBatch11.fixtures';
import { batch12Fixture, batch12Ids } from './TemplateBatch12.fixtures';
import { batch14Fixture, batch14Ids } from './TemplateBatch14.fixtures';
import { batch15Fixture, batch15Ids } from './TemplateBatch15.fixtures';
import { batch17Fixture, batch17Ids } from './TemplateBatch17.fixtures';
import { batch16Fixture, batch16Ids } from './TemplateBatch16.fixtures';
import { batch13Fixture, batch13Ids } from './TemplateBatch13.fixtures';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SofaCombinationWorkbench } from './SofaCombinationWorkbench';
import { saveDraft, type WorkbenchDraft, type SofaCombinationDraft } from './storage/draftStorage';
import type { SofaBedCombinationDraft } from './domain/sofaBedCombinationLayout';
import type { DimensionAnnotation } from './domain/dimensionAnnotations';
import { SINGLE_TEMPLATE_RULES, COMBINATION_TEMPLATE_RULES, type SingleTemplateId } from './templates/registry';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(), loadDraft: async () => null, loadRecoveryHistory: async () => [], saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', flush: vi.fn(), open: vi.fn(), save: vi.fn(), saveAs: vi.fn() }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 900, height: name.startsWith('TEST14-tall') ? 1400 : 500 } }) }));

const annotations: DimensionAnnotation[] = [
  { kind: 'length', label: '长', value: 240, from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 } },
  { kind: 'width', label: '宽', value: 88, from: { x: 0, y: 1.1 }, to: { x: .4, y: 1.25 } },
  { kind: 'height', label: '高', value: 100, from: { x: -.1, y: 0 }, to: { x: -.1, y: 1 } },
];
const product = { name: 'fixture.png', blob: new Blob(['fixture'], { type: 'image/png' }) };
const single: WorkbenchDraft = { version: 1, templateId: 'sofa-single', model: 'TEST-A', modelManuallyEdited: true, sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: '240×88×100', dimensionFields: { length: '240', width: '88', height: '100' }, annotations, subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: product };
const softBed: WorkbenchDraft = { ...single, templateId: 'soft-bed-single', softBed: { sizeLabels: ['1.5m床', '1.8m床'], sellingPointCount: 3, dimensionGap: 60 }, sizeInput: '223×168/198×183/193×118', dimensionFields: { length: '223', width: '', headWidth: '168/198', footWidth: '183/193', height: '118' }, annotations: [annotations[0], annotations[2], { ...annotations[0], kind: 'headWidth', label: '床头宽', value: 168 }, { ...annotations[1], kind: 'footWidth', label: '床尾宽', value: 183 }] };
const combination: SofaCombinationDraft = { version: 1, templateId: 'sofa-combination', kind: 'standard', model: single.model, modelManuallyEdited: true, sizeInput: single.sizeInput, dimensionFields: single.dimensionFields, annotations, subjectAdjustment: single.subjectAdjustment, mainImage: product, optionalSizes: [{ id: 'spec', sizeInput: '210××', dimensionFields: { length: '210', width: '', height: '' }, annotations: [annotations[0]], image: product }], optionalLabelEnabled: true, optionalLabelOffsetY: 0, optionalLabelSide: 'left', noteEnabled: true, note: '测试备注' };
const sofaBed: SofaBedCombinationDraft = { ...combination, templateId: 'sofa-bed-combination', sizeInput: '162×100~196×95~54', dimensionFields: { length: '162', width: '100~196', height: '95~54' }, sofaBedSellingPoints: single.sellingPoints, sofaBedFeature: { enabled: true, text: '6档调节', x: 780, y: 530 } };
const fixtures = [single, softBed, combination, sofaBed, { ...sofaBed, optionalSizes: [] }];
const batch2Fixtures: WorkbenchDraft[] = [
  { ...single, templateId: 'footstool-single', model: 'TEST脚踏', sellingPoints: [] },
  { ...single, templateId: 'office-chair-single', model: 'TEST书椅' },
];
const batch3Fixtures: WorkbenchDraft[] = (['long-dining-table-single', 'round-extendable-table-single'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id];
  const fields = rules.parseQuickDimensions(id === 'long-dining-table-single' ? '140/160/180×80×74.8' : '81.6~130/91.6~150×75.3')!;
  return { ...single, templateId: id, model: 'TEST餐桌', sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), noteText: '测试备注', heightNote: '测试说明' }),
    annotations: id === 'long-dining-table-single' ? annotations : [{ ...annotations[0], kind: 'diameter', label: '直径', value: 81.6 }, annotations[2]] };
});
const batch4Fixtures: WorkbenchDraft[] = (['functional-sofa-single', 'bedside-cabinet-single'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  const fields = rules.parseQuickDimensions(id === 'functional-sofa-single' ? '92×105~162×98~77' : '50×45×55')!;
  return { ...single, templateId: id, model: 'TEST第四批', sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...options, quantity: 2,
      rocking: options.rocking ? { ...options.rocking, enabled: true, text: '测试摇动' } : undefined,
      rotation: options.rotation ? { ...options.rotation, enabled: true, text: '测试旋转' } : undefined }) };
});
const batch5Fixtures: WorkbenchDraft[] = (['long-dining-table-combination', 'round-extendable-table-combination'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id];
  const fields = rules.parseQuickDimensions(id === 'long-dining-table-combination' ? '140/160×80×74.8' : '81.6~130/91.6~150×75.3')!;
  return { ...single, templateId: id, model: 'TEST第五批餐桌', sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), noteText: '测试图示备注', heightNote: '测试脚垫',
      diningChairs: { count: id === 'long-dining-table-combination' ? 2 : 1, models: ['TEST餐椅甲', 'TEST长凳乙'], markers: [{ x: .25, y: .2 }, { x: .7, y: .8 }] } }),
    annotations: id === 'long-dining-table-combination' ? annotations : [{ ...annotations[0], kind: 'diameter', label: '直径', value: 81.6 }, annotations[2]] };
});

const batch6Fixtures: WorkbenchDraft[] = (['standing-desk-single', 'standing-desk-combination'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id];
  return { ...single, templateId: id, model: 'TEST升降桌', sizeInput: '140/160×70/80×73~122', dimensionFields: { length: '140/160', width: '70/80', height: '73~122' },
    ...rules.saveOptions({ ...rules.createOptions(), headline: 'TEST升降桌标题', standingDeskSet: { count: 3, riserModel: 'TEST增高架', chairModel: 'TEST椅', riserNote: '测试说明' } }),
    ...(id === 'standing-desk-combination' ? { accessories: ['riser', 'chair'].map((id) => ({ id, image: product, adjustment: { scale: .8, offsetX: 0, offsetY: 0 } })) } : {}) };
});

const batch7Fixtures: WorkbenchDraft[] = (['study-desk-single', 'study-desk-combination'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id];
  return { ...single, templateId: id, model: 'TEST学习桌', sizeInput: '120/140×65×65~115', dimensionFields: { length: '120/140', width: '65', height: '65~115' },
    ...rules.saveOptions({ ...rules.createOptions(), dimensionGap: 100, studyChairModel: 'TEST学习椅' }),
    ...(id === 'study-desk-combination' ? { accessories: [{ id: 'study-chair', image: product, adjustment: { scale: .8, offsetX: 0, offsetY: 0 } }] } : {}) };
});

const chairRules = SINGLE_TEMPLATE_RULES['dining-chair-single'];
const diningChairFixture: WorkbenchDraft = { ...single, templateId: 'dining-chair-single', model: 'TEST餐椅',
  sizeInput: '43×50.5×82', dimensionFields: { length: '43', width: '50.5', height: '82' },
  ...chairRules.saveOptions({ ...chairRules.createOptions(), diningChair: { quantity: 1, widthMode: 'standard', heightNote: '测试说明', outerWidth: '52.4' } }),
  accessories: [{ id: 'chair-rear', image: product, adjustment: { scale: .8, offsetX: 0, offsetY: 0 } }] };
const sideTableRules = SINGLE_TEMPLATE_RULES['lifting-side-table-single'];
const batch8Fixtures: WorkbenchDraft[] = [diningChairFixture, { ...single, templateId: 'lifting-side-table-single', model: 'TEST边桌',
  sizeInput: '60×40×72~107', dimensionFields: { length: '60', width: '40', height: '72~107' },
  ...sideTableRules.saveOptions({ ...sideTableRules.createOptions(), sideTableDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: '测试说明' })) }),
  accessories: Array.from({ length: 5 }, (_, index) => ({ id: `side-detail-${index + 1}`, image: product, adjustment: { scale: 1, offsetX: 0, offsetY: 0 } })) }];


const batch9Fixtures: WorkbenchDraft[] = (['computer-chair-single', 'ergonomic-chair-single'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], key = id === 'computer-chair-single' ? 'computerChairDetails' : 'ergonomicChairDetails';
  const options = { ...rules.createOptions(), [key]: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: index === 0 ? '第一行\n第二行' : '测试说明', textColor: index === 1 ? 'white' : 'black' })) };
  return { ...single, templateId: id, model: 'TEST椅', sizeInput: '65×70×105~115', dimensionFields: { length: '65', width: '70', height: '105~115' },
    ...rules.saveOptions(options), accessories: rules.accessories!(options, rules.layout([], options)).map((slot) => ({ id: slot.id, image: product, adjustment: { scale: 1.2, offsetX: -10, offsetY: -5 } })) };
});
const firmnessFixtures = [
  { value: '3.5', label: '支撑', x: 904 }, { value: '5', label: '软硬适中', x: 1029 },
  { value: '6.5', label: '舒软', x: 1115 }, { value: '8', label: '云软', x: 1171 },
].map((sample) => ({ ...single, ...SINGLE_TEMPLATE_RULES['sofa-single'].saveOptions({ ...SINGLE_TEMPLATE_RULES['sofa-single'].createOptions(),
  sofaFirmness: { enabled: true, value: sample.value, label: sample.label, position: (sample.x - 852.30566) / 378.69415 * 100 } }) }));

const batch10Fixtures: WorkbenchDraft[] = (['study-chair-single', 'mattress-single'] as const).map((id) => {
  const rules = SINGLE_TEMPLATE_RULES[id], options = rules.createOptions();
  options.studyChairDetails = Array.from({ length: 5 }, () => ({ title: '测试细节', description: '测试说明' }));
  options.mattressSingle = { headline: '测试床垫', subtitle: '测试说明', firmnessValue: '2.1', firmnessPosition: 30, materials: Array.from({ length: 3 }, () => ({ text: '测试材质', textColor: 'white' })) };
  const fields = rules.parseQuickDimensions(id === 'mattress-single' ? '27' : '65×70×80~90')!;
  return { ...single, templateId: id, model: 'TEST10', sizeInput: rules.formatFields(fields), dimensionFields: fields,
    annotations: id === 'mattress-single' ? [{ kind: 'height', label: '高', value: 27, from: { x: 1.03, y: .65 }, to: { x: 1.03, y: 1 } }] : annotations,
    ...rules.saveOptions(options), accessories: rules.accessories!(options, rules.layout([], options)).map((slot) => ({ id: slot.id, image: product, adjustment: { scale: 1, offsetX: 0, offsetY: 0 } })) };
});

const batch11Fixtures = batch11Ids.map(batch11Fixture);
const batch11Variants = [
  batch11Fixture('mattress-double'),
  ...['1.7', '1.1'].map((value) => {
    const draft = batch11Fixture('mattress-double'), rules = SINGLE_TEMPLATE_RULES['mattress-double'], options = rules.restoreOptions(draft);
    options.mattressDouble!.faces[1].value = value; return { ...draft, ...rules.saveOptions(options) };
  }),
  ...([1, 2] as const).map((quantity) => {
    const draft = batch11Fixture('pillow-single'), rules = SINGLE_TEMPLATE_RULES['pillow-single'], options = rules.restoreOptions(draft);
    options.pillowSingle!.quantity = quantity; return { ...draft, ...rules.saveOptions(options) };
  }),
];

const batch12Fixtures = batch12Ids.map(batch12Fixture);
const batch17Fixtures = batch17Ids.map(batch17Fixture);
const batch17Variants = batch17Ids.flatMap((id) => [false, true].map((multiple) => {
  const draft = batch17Fixture(id), rules = SINGLE_TEMPLATE_RULES[id], options = rules.restoreOptions(draft), value = options.woodLongTableSet ?? options.woodRoundTableSet!;
  value.sellingPointCount = multiple ? 3 : 2;
  if (!multiple) { value.chairCount = 1; if (options.woodRoundTableSet) options.woodRoundTableSet.diameterPlacement = 'outside'; }
  return { ...draft, ...rules.saveOptions(options) };
}));
const batch16Fixtures = batch16Ids.map(batch16Fixture);
const batch16Variants = batch16Ids.flatMap((id) => ([2, 3] as const).map((count) => {
  const draft = batch16Fixture(id), rules = SINGLE_TEMPLATE_RULES[id], options = rules.restoreOptions(draft), value = options.woodLongTable ?? options.woodRoundTable!;
  value.sellingPointCount = count;
  return { ...draft, ...rules.saveOptions(options) };
}));
const batch15Fixtures = batch15Ids.map(batch15Fixture);
const batch15Variants = batch15Ids.flatMap((id) => ([2, 3] as const).map((count) => {
  const draft = batch15Fixture(id), rules = SINGLE_TEMPLATE_RULES[id], options = rules.restoreOptions(draft), value = options.shapedVanity ?? options.woodDesk!;
  value.sellingPointCount = count;
  return { ...draft, ...rules.saveOptions(options) };
}));
const batch14Fixtures = batch14Ids.map((id) => batch14Fixture(id));
const batch14Variants = batch14Ids.flatMap((id) => ([2, 3] as const).map((count) => {
  const draft = batch14Fixture(id, count === 2 && id === 'shoe-cabinet-single'), rules = SINGLE_TEMPLATE_RULES[id], options = rules.restoreOptions(draft), value = options.wardrobe ?? options.shoeCabinet!;
  value.sellingPointCount = count; if (count === 2) value.noteText = '';
  return { ...draft, ...rules.saveOptions(options) };
}));
const batch13Fixtures = batch13Ids.map(batch13Fixture);
const batch13Variants = batch13Ids.flatMap((id) => ([2, 3] as const).map((count) => {
  const draft = batch13Fixture(id), rules = SINGLE_TEMPLATE_RULES[id], options = rules.restoreOptions(draft), value = options.woodBedside ?? options.drawerChest!;
  value.sellingPointCount = count; if (count === 2) value.noteText = '';
  return { ...draft, ...rules.saveOptions(options) };
}));
const batch12Variants = [
  ...(['both', 'mattress', 'cabinet'] as const).map((set) => {
    const draft = batch12Fixture('soft-bed-combination'), rules = SINGLE_TEMPLATE_RULES['soft-bed-combination'], options = rules.restoreOptions(draft);
    options.softBedCombination!.set = set; return { ...draft, ...rules.saveOptions(options) };
  }),
  ...([[3, 2], [2, 1], [3, 0]] as const).map(([mattressCount, cabinetCount]) => {
    const draft = batch12Fixture('soft-bed-multi-combination'), rules = SINGLE_TEMPLATE_RULES['soft-bed-multi-combination'], options = rules.restoreOptions(draft);
    options.softBedMultiCombination!.mattressCount = mattressCount; options.softBedMultiCombination!.cabinetCount = cabinetCount;
    return { ...draft, ...rules.saveOptions(options) };
  }),
];

let root: Root, container: HTMLDivElement;
const records = new Map<HTMLCanvasElement, unknown[]>();
beforeEach(() => {
  vi.mocked(saveDraft).mockClear();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    if (records.has(this)) return contexts.get(this)!;
    const record: unknown[] = []; records.set(this, record);
    let matrix = [1, 0, 0, 1, 0, 0]; const matrices: number[][] = [];
    const context = { font: '10px sans-serif', letterSpacing: '0px', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, textAlign: 'start', textBaseline: 'alphabetic',
      fillRect() { record.length = 0; },
      measureText(this: CanvasRenderingContext2D, value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 46) * .55, actualBoundingBoxAscent: 36, actualBoundingBoxDescent: 10 }; },
      fillText(this: CanvasRenderingContext2D, value: string, x: number, y: number) { record.push(['text', value, this.font, this.fillStyle, matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5], this.textAlign, this.textBaseline]); if (matrix[1] || matrix[2]) record.push(['rotation', Math.atan2(matrix[1], matrix[0])]); },
      roundRect(...args: unknown[]) { record.push(['box', ...args]); },
      drawImage(...args: unknown[]) { record.push(['image', ...args.slice(1)]); },
      beginPath() {}, fill(this: CanvasRenderingContext2D) { record.push(['fill', this.fillStyle]); }, stroke(this: CanvasRenderingContext2D) { record.push(['stroke', this.strokeStyle, this.lineWidth]); },
      save(this: CanvasRenderingContext2D) { matrices.push([...matrix]); stack.push([this.font, this.fillStyle, this.strokeStyle, this.lineWidth, this.textAlign, this.textBaseline]); },
      restore(this: CanvasRenderingContext2D) { matrix = matrices.pop() ?? matrix; const state = stack.pop(); if (state) [this.font, this.fillStyle, this.strokeStyle, this.lineWidth, this.textAlign, this.textBaseline] = state as [string,string,string,number,CanvasTextAlign,CanvasTextBaseline]; },
      translate(x: number, y: number) { matrix[4] += matrix[0] * x + matrix[2] * y; matrix[5] += matrix[1] * x + matrix[3] * y; },
      rotate(angle: number) { const [a,b,c,d,e,f] = matrix, co = Math.cos(angle), si = Math.sin(angle); matrix = [a*co+c*si,b*co+d*si,c*co-a*si,d*co-b*si,e,f]; },
      moveTo() {}, lineTo() {}, closePath() {}, clip() {}, bezierCurveTo() {}, setLineDash() {},
      arc(...args: unknown[]) { record.push(['arc', ...args]); }, ellipse(...args: unknown[]) { record.push(['ellipse', ...args]); }, quadraticCurveTo() {},
    } as unknown as CanvasRenderingContext2D;
    const stack: unknown[][] = []; contexts.set(this, context); return context;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);
});

const extensionFixtures = [...completionIds.map(completionFixture), functionalCompletionFixture(), ...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...batch13Fixtures, ...batch14Fixtures, ...batch15Fixtures, ...batch16Fixtures, ...batch17Fixtures].map((draft) => ({ draft, owner: 'main', templateId: draft.templateId }))
  .concat([combination, sofaBed].map((draft) => ({ draft, owner: 'spec', templateId: draft.templateId })));

it.each(extensionFixtures)('$templateId 的 $owner 所有尺寸均可调整两端辅助线并保存', async ({ draft, owner }) => {
  const drawing = await paint(draft);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  const canvas = container.querySelector('canvas')!;
  const label = drawing.find((item) => item[0] === 'text' && String(item[1]).endsWith('cm') && (owner === 'main' || item[1] === '210cm'))!;
  expect(label).toBeDefined();
  await act(async () => canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: Number(label[4]), clientY: Number(label[5]), bubbles: true })));
  const input = container.querySelector('.canvas-dimension-input input');
  if (input) await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const toggle = [...container.querySelectorAll('button')].find((button) => button.textContent === '辅助线')!;
  expect(toggle).toBeDefined(); await act(async () => toggle.click());
  const source = owner === 'main' ? draft.annotations : (draft as SofaCombinationDraft).optionalSizes[0].annotations;
  for (const annotation of source) {
    await act(async () => container.querySelector<HTMLElement>(`[aria-label="${annotation.label}尺寸微调"]`)!.click());
    expect(container.querySelectorAll('.dimension-extension-handle')).toHaveLength(2);
    expect(container.querySelectorAll('.dimension-endpoint:not(.dimension-extension-handle)')).toHaveLength(0);
    for (const [endpoint, label] of [['from', '起点'], ['to', '终点']] as const) {
      const handle = container.querySelector<HTMLButtonElement>(`[aria-label="${annotation.label}辅助线${label}"]`)!;
      const x = parseFloat(handle.style.left) * 14.4, y = parseFloat(handle.style.top) * 14.4;
      const horizontal = annotation.kind === 'height' || annotation.kind === 'secondaryHeight';
      const delta = annotation[endpoint][horizontal ? 'x' : 'y'] > .5 ? -12 : 12;
      for (const [type, movement] of [['pointerdown', 0], ['pointermove', delta], ['pointerup', delta]] as const) {
        await act(async () => handle.dispatchEvent(new MouseEvent(type, { clientX: x + (horizontal ? movement : 0), clientY: y + (horizontal ? 0 : movement), bubbles: true })));
      }
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    const changed = (owner === 'main' ? saved.annotations : saved.optionalSizes[0].annotations).find((item) => item.kind === annotation.kind)!;
    expect(changed.extensionOffsets?.from).toBeDefined(); expect(changed.extensionOffsets?.to).toBeDefined();
    for (const endpoint of ['from', 'to'] as const) for (const axis of ['x', 'y'] as const) expect(changed[endpoint][axis]).toBeCloseTo(annotation[endpoint][axis], 8);
  }
});
const contexts = new Map<HTMLCanvasElement, CanvasRenderingContext2D>();
const restoreRules: Array<() => void> = [];
afterEach(async () => { await act(async () => root.unmount()); container.remove(); records.clear(); contexts.clear(); vi.useRealTimers(); vi.restoreAllMocks(); restoreRules.splice(0).forEach((restore) => restore()); });

async function paint(draft: WorkbenchDraft | SofaBedCombinationDraft) {
  const launch = { projectId: 'render-fixture', fileName: 'fixture.skuwork', draft };
  const key = `${draft.templateId}-${'optionalSizes' in draft ? draft.optionalSizes.length : 'single'}-${JSON.stringify([(draft as WorkbenchDraft & { sofaFirmness?: unknown }).sofaFirmness, Reflect.get(draft, 'mattressDouble'), Reflect.get(draft, 'pillowSingle'), Reflect.get(draft, 'softBedCombination'), Reflect.get(draft, 'softBedMultiCombination'), Reflect.get(draft, 'woodBedside'), Reflect.get(draft, 'drawerChest')])}`;
  await act(async () => root.render('sellingPoints' in draft
    ? <SingleWorkbench key={key} templateId={draft.templateId as SingleTemplateId} initialProject={launch as typeof launch & { draft: WorkbenchDraft }} onBack={() => undefined}/>
    : <SofaCombinationWorkbench key={key} templateId={draft.templateId as 'sofa-combination' | 'sofa-bed-combination'} initialProject={launch as typeof launch & { draft: SofaCombinationDraft }} onBack={() => undefined}/>));
  const painted = records.get(container.querySelector('canvas')!)!;
  return JSON.parse(JSON.stringify(painted, (_key, value) => typeof value === 'number' ? Math.round(value * 1000) / 1000 : value)) as unknown[][];
}

it.each(fixtures)('保留 $templateId 的已存项目绘图结果（$optionalSizes.length 个附加规格）', async (draft) => {
  // 在规则拆分前记录：型号、尺寸、图片、卖点和备注的实际绘制位置/样式。
  expect(await paint(draft)).toMatchSnapshot();
});

it.each(batch2Fixtures)('第二批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  if (draft.templateId === 'footstool-single') {
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '*实际尺寸请以下单规格为准')).toBe(true);
    expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(0);
  } else {
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '总长240cm')).toBe(true);
    expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
  }
});

it.each(batch3Fixtures)('第三批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  expect(drawing.find((item) => item[0] === 'text' && item[1] === '测试备注')?.[2]).toContain('38px');
  expect(drawing.some((item) => item[0] === 'text' && String(item[1]).includes('测试说明'))).toBe(true);
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
});

it.each(batch4Fixtures)('第四批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  if (draft.templateId === 'functional-sofa-single') {
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试摇动')).toBe(true);
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试旋转')).toBe(true);
  } else expect(drawing.some((item) => item[0] === 'text' && item[1] === 'x2')).toBe(true);
});



it.each(batch8Fixtures)('第八批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft), isChair = draft.templateId === 'dining-chair-single';
  expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(isChair ? 2 : 6);
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(isChair ? 3 : 0);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST餐椅x1')).toBe(isChair);
  if (!isChair) {
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试细节1' && String(item[2]).includes('45px'))).toBe(true);
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试细节4' && String(item[2]).includes('35px'))).toBe(true);
  }
});
it('第八批餐椅特殊总宽与x2数量独立绘图基准', async () => {
  const options = chairRules.restoreOptions(diningChairFixture);
  const drawing = await paint({ ...diningChairFixture, ...chairRules.saveOptions({ ...options, diningChair: { ...options.diningChair!, quantity: 2, widthMode: 'outside' } }) });
  expect(drawing).toMatchSnapshot();
  expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST餐椅x2')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '50.5cm')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '总宽52.4cm')).toBe(true);
});
it.each(['dining-chair-single', 'lifting-side-table-single'] as const)('修改 %s 的线条不影响其余十七款模板', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures];
  const before = [];
  for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(batch7Fixtures)('第七批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft), isSet = draft.templateId === 'study-desk-combination';
  expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(isSet ? 2 : 1);
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain(isSet ? '35px' : '45px');
  expect(drawing.filter((item) => item[0] === 'text').every((item) => Number(item[5]) >= 350)).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && String(item[1]).includes('学习椅为推荐搭配'))).toBe(isSet);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '65~')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '115cm')).toBe(true);
});
it.each(['study-desk-single', 'study-desk-combination'] as const)('修改 %s 的线条不影响其余十五款模板', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures];
  const before = [];
  for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(batch6Fixtures)('第六批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  expect(drawing.find((item) => item[0] === 'text' && item[1] === 'TEST升降桌标题')?.[2]).toContain('80px');
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(draft.accessories ? 3 : 1);
});
it('第六批两件套隐藏电脑椅且保存的素材不进入绘图', async () => {
  const rules = SINGLE_TEMPLATE_RULES['standing-desk-combination'], draft = batch6Fixtures[1], options = rules.restoreOptions(draft);
  const drawing = await paint({ ...draft, ...rules.saveOptions({ ...options, standingDeskSet: { ...options.standingDeskSet!, count: 2 } }) });
  expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(2);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST椅')).toBe(false);
});
it.each(['standing-desk-single', 'standing-desk-combination'] as const)('修改 %s 的线条不影响其余模板', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures];
  const before = [];
  for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(batch5Fixtures)('第五批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain('35px');
  expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST餐椅甲')).toBe(true);
  expect(drawing.find((item) => item[0] === 'text' && item[1] === '测试图示备注')?.[2]).toContain('38px');
  if (draft.templateId === 'long-dining-table-combination') {
    expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST长凳乙')).toBe(true);
    expect(drawing.filter((item) => item[0] === 'arc')).toHaveLength(4);
  } else {
    expect(drawing.find((item) => item[0] === 'text' && String(item[1]).includes('81.6'))?.[3]).toBe('#ffffff');
    expect(drawing.find((item) => item[0] === 'text' && String(item[1]).includes('75.3'))?.[3]).toBe('#000000');
  }
});

it('第五批长餐桌单款搭配隐藏全部编号并保持完整型号', async () => {
  const rules = SINGLE_TEMPLATE_RULES['long-dining-table-combination'], draft = batch5Fixtures[0], options = rules.restoreOptions(draft);
  const drawing = await paint({ ...draft, ...rules.saveOptions({ ...options, diningChairs: { ...options.diningChairs!, count: 1 } }) });
  expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'arc')).toHaveLength(0);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST餐椅甲')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === 'TEST长凳乙')).toBe(false);
});

it.each(['long-dining-table-combination', 'round-extendable-table-combination'] as const)('修改 %s 的尺寸线不影响其余十一款模板', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures];
  const before = [];
  for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(['functional-sofa-single', 'bedside-cabinet-single'] as const)('修改 %s 不影响其余九个模板', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures];
  const before = [];
  for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(['long-dining-table-single', 'round-extendable-table-single'] as const)('单点修改 %s 不影响其余七个模板', async (id) => {
  const allFixtures = [...fixtures, ...batch2Fixtures, ...batch3Fixtures];
  const before = [];
  for (const fixture of allFixtures) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id];
  const color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of allFixtures.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(['footstool-single', 'office-chair-single'] as const)('单点修改 %s 不影响其余五个模板', async (id) => {
  const allFixtures = [...fixtures, ...batch2Fixtures];
  const before = [];
  for (const fixture of allFixtures) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id];
  const color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of allFixtures.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) {
      expect(after).not.toEqual(before[index]);
      expect(after.some((item) => item[0] === 'stroke' && item[1] === '#123456')).toBe(true);
    } else expect(after).toEqual(before[index]);
  }
});

it('单独调整软床卖点字号与位置，仅软床画布和编辑覆层改变', async () => {
  const before = [];
  for (const fixture of fixtures) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES['soft-bed-single'];
  const originalLayout = rules.layout;
  const fontSize = rules.sellingPoints.fontSize;
  restoreRules.push(() => { rules.sellingPoints.fontSize = fontSize; });
  rules.sellingPoints.fontSize = 44;
  vi.spyOn(rules, 'layout').mockImplementation((widths, options) => {
    const layout = originalLayout(widths, options);
    return { ...layout, sellingPoints: layout.sellingPoints.map((box) => ({ ...box, y: box.y - 20 })) };
  });
  for (const [index, fixture] of fixtures.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === 'soft-bed-single') {
      expect(after).not.toEqual(before[index]);
      expect(after.find((item) => item[0] === 'text' && item[1] === '测试卖点一')?.[2]).toContain('44px');
      expect(container.querySelector<HTMLElement>('.canvas-selling-editor')!.style.fontSize).toBe(`${44 / 1440 * 100}cqw`);
    } else expect(after).toEqual(before[index]);
  }
});

it('单独调整沙发床尺寸线颜色，普通组合、两个单品的绘图不变', async () => {
  const before = [];
  for (const fixture of fixtures) before.push(await paint(fixture));
  const rules = COMBINATION_TEMPLATE_RULES['sofa-bed-combination'];
  const color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  // 仅测试中模拟修改只读规则，检查其他模板没有共享同一对象。
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of fixtures.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === 'sofa-bed-combination') {
      expect(after).not.toEqual(before[index]);
      expect(after.some((item) => item[0] === 'stroke' && item[1] === '#123456')).toBe(true);
    } else expect(after).toEqual(before[index]);
  }
});

it('单品固定备注按本模板样式绘制，无卖点模板隐藏编辑面板', async () => {
  const rules = SINGLE_TEMPLATE_RULES['sofa-single'];
  const previousNote = rules.note;
  restoreRules.push(() => { rules.note = previousNote; });
  rules.note = { text: '模板专属备注', font: '40px test-font', color: '#123456', x: 70, y: 1375 };
  vi.spyOn(rules, 'visibleSellingPoints').mockReturnValue([]);
  const originalLayout = rules.layout;
  vi.spyOn(rules, 'layout').mockImplementation((widths, options) => ({ ...originalLayout(widths, options), sellingPoints: [] }));
  const drawing = await paint(single);
  expect(drawing.find((item) => item[0] === 'text' && item[1] === '模板专属备注'))
    .toEqual(['text', '模板专属备注', '40px test-font', '#123456', 70, 1375, 'start', 'alphabetic']);
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(0);
  expect([...container.querySelectorAll('.quick-section h3')].some((element) => element.textContent?.includes('卖点'))).toBe(false);
});


it.each(batch9Fixtures)('第九批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(6);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '总高')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '105~')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '115cm')).toBe(true);
});
it.each(firmnessFixtures)('软硬度组件四份源文件数值与独立位置绘图', async (draft) => {
  const drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'arc')).toHaveLength(3);
  expect(drawing.some((item) => item[0] === 'stroke' && item[1] === '#769aa7' && item[2] === 4.5)).toBe(true);
});
it.each(['computer-chair-single', 'ergonomic-chair-single'] as const)('第九批修改 %s 线条不影响其余模板及软硬度组件', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...firmnessFixtures];
  const before = [];
  for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); });
  Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture);
    if (fixture.templateId === id) expect(after).not.toEqual(before[index]);
    else expect(after).toEqual(before[index]);
  }
});

it.each(batch10Fixtures)('第十批 $templateId 独立绘图基准', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(draft.templateId === 'mattress-single' ? 4 : 6);
  if (draft.templateId === 'mattress-single') {
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '偏硬')).toBe(true);
    expect(drawing.find((item) => item[0] === 'text' && item[1] === '27cm')?.[2]).toContain('52px');
    expect(drawing.filter((item) => item[0] === 'text' && item[1] === '测试材质')).toHaveLength(3);
  }
});
it.each(['study-chair-single', 'mattress-single'] as const)('第十批修改 %s 不影响其余模板及沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch11Variants)('第十一批 $templateId 的独立数量与硬度变体绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(4);
  const options = SINGLE_TEMPLATE_RULES[draft.templateId as 'mattress-double' | 'pillow-single'].restoreOptions(draft);
  if (options.pillowSingle) expect(drawing.some((item) => item[0] === 'text' && item[1] === 'x2')).toBe(options.pillowSingle.quantity === 2);
  else {
    const equal = options.mattressDouble!.faces[1].value === '1.1';
    expect(drawing.filter((item) => item[0] === 'arc')).toHaveLength(equal ? 3 : 6);
    expect(drawing.some((item) => item[0] === 'text' && item[1] === '正反面')).toBe(equal);
  }
});
it.each(batch11Ids)('第十一批修改 %s 不影响已有22款模板及软硬度组件', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch12Variants)('第十二批 $templateId 搭配变体独立绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  const rules = SINGLE_TEMPLATE_RULES[draft.templateId as 'soft-bed-combination' | 'soft-bed-multi-combination'], options = rules.restoreOptions(draft);
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(1 + rules.accessories!(options, rules.layout([], options)).length);
  expect(drawing.filter((item) => item[0] === 'text' && item[1] === '*床头柜/床垫为推荐搭配，产品发货数量以最终下单选择为准')).toHaveLength(1);
});
it.each(batch12Ids)('第十二批修改 %s 不影响其余24款与沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch13Variants)('第十三批 $templateId 两三卖点独立绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  const rules = SINGLE_TEMPLATE_RULES[draft.templateId as typeof batch13Ids[number]], options = rules.restoreOptions(draft), value = options.woodBedside ?? options.drawerChest!;
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(1);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试卖点三')).toBe(value.sellingPointCount === 3);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试图示备注')).toBe(Boolean(value.noteText));
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain('45px');
});
it.each(batch13Ids)('第十三批修改 %s 线条不影响旧26款与沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...batch13Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch16Variants)('第十六批 $templateId 两三卖点独立绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  const rules = SINGLE_TEMPLATE_RULES[draft.templateId as typeof batch16Ids[number]], options = rules.restoreOptions(draft), value = options.woodLongTable ?? options.woodRoundTable!;
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(1);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试卖点三')).toBe(value.sellingPointCount === 3);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试图示备注')).toBe(true);
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain('45px');
});
it.each(batch16Ids)('第十六批修改 %s 线条不影响旧32款与沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...batch13Fixtures, ...batch14Fixtures, ...batch15Fixtures, ...batch16Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch15Variants)('第十五批 $templateId 两三卖点独立绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  const rules = SINGLE_TEMPLATE_RULES[draft.templateId as typeof batch15Ids[number]], options = rules.restoreOptions(draft), value = options.shapedVanity ?? options.woodDesk!;
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(1);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试卖点三')).toBe(value.sellingPointCount === 3);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试图示备注')).toBe(true);
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain('45px');
});
it.each(batch15Ids)('第十五批修改 %s 线条不影响旧30款与沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...batch13Fixtures, ...batch14Fixtures, ...batch15Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch14Variants)('第十四批 $templateId 两三卖点独立绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  const rules = SINGLE_TEMPLATE_RULES[draft.templateId as typeof batch14Ids[number]], options = rules.restoreOptions(draft), value = options.wardrobe ?? options.shoeCabinet!;
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(2);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试卖点三')).toBe(value.sellingPointCount === 3);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试图示备注')).toBe(Boolean(value.noteText));
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain('45px');
});
it.each(batch14Ids)('第十四批修改 %s 线条不影响旧28款与沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...batch13Fixtures, ...batch14Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});

it.each(batch17Variants)('第十七批 $templateId 两三卖点独立绘图', async (draft) => {
  const drawing = await paint(draft); expect(drawing).toMatchSnapshot();
  const rules = SINGLE_TEMPLATE_RULES[draft.templateId as typeof batch17Ids[number]], options = rules.restoreOptions(draft), value = options.woodLongTableSet ?? options.woodRoundTableSet!;
  expect(drawing.filter((item) => item[0] === 'image')).toHaveLength(1);
  expect(drawing.filter((item) => item[0] === 'text' && String(item[1]).startsWith('TEST17-'))).toHaveLength(value.chairCount);
  if (options.woodLongTableSet) expect(drawing.filter((item) => item[0] === 'arc')).toHaveLength(value.chairCount === 2 ? 4 : 0);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试卖点三')).toBe(value.sellingPointCount === 3);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '测试图示备注')).toBe(true);
  expect(drawing.find((item) => item[0] === 'text' && item[1] === draft.model)?.[2]).toContain('35px');
});
it.each(batch17Ids)('第十七批修改 %s 线条不影响旧34款与沙发坐感', async (id) => {
  const all = [...fixtures, ...batch2Fixtures, ...batch3Fixtures, ...batch4Fixtures, ...batch5Fixtures, ...batch6Fixtures, ...batch7Fixtures, ...batch8Fixtures, ...batch9Fixtures, ...batch10Fixtures, ...batch11Fixtures, ...batch12Fixtures, ...batch13Fixtures, ...batch14Fixtures, ...batch15Fixtures, ...batch16Fixtures, ...batch17Fixtures, ...firmnessFixtures];
  const before = []; for (const fixture of all) before.push(await paint(fixture));
  const rules = SINGLE_TEMPLATE_RULES[id], color = rules.lineStyle.color;
  restoreRules.push(() => { Reflect.set(rules.lineStyle, 'color', color); }); Reflect.set(rules.lineStyle, 'color', '#123456');
  for (const [index, fixture] of all.entries()) {
    const after = await paint(fixture); if (fixture.templateId === id) expect(after).not.toEqual(before[index]); else expect(after).toEqual(before[index]);
  }
});


it.each(completionIds)('规范收尾 $0 独立绘图基准', async (id) => {
  const draft = completionFixture(id), drawing = await paint(draft);
  expect(drawing).toMatchSnapshot();
  expect(drawing.some((item) => item[0] === 'text' && String(item[1]).includes('TEST收尾'))).toBe(true);
});
it('规范收尾 功能沙发完整范围绘图', async () => {
  const drawing = await paint(functionalCompletionFixture()); expect(drawing).toMatchSnapshot();
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '100~157cm')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '80~')).toBe(true);
  expect(drawing.some((item) => item[0] === 'text' && item[1] === '91cm')).toBe(true);
});
