// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(), loadDraft: async () => null, loadRecoveryHistory: async () => [], saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn(), flush: vi.fn(async () => undefined) }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => {
  const element = new Image(); element.alt = name;
  return { blob, name, element, visible: { x: 0, y: 0, width: name.includes('第二视图') ? 420 : 800, height: name.includes('细节') ? 400 : 650 } };
} }));

const ids = ['dining-chair-single', 'lifting-side-table-single'] as const;
type BatchId = typeof ids[number];
const mainName = 'TEST主图.png', rearName = 'TEST第二视图.png';
const detailNames = Array.from({ length: 5 }, (_, index) => `TEST细节${index + 1}.png`);
function fixture(id: BatchId): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], chair = id === ids[0];
  const fields = rules.parseQuickDimensions(chair ? '48×50.5×80' : '60×40×52~76')!;
  return {
    version: 1, templateId: id, model: chair ? 'TEST餐椅完整型号' : 'TEST升降边桌60cm', modelManuallyEdited: false,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), diningChair: { quantity: 1, widthMode: 'standard', heightNote: '', outerWidth: '52.4' },
      sideTableDetails: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: `测试说明${index + 1}` })),
    }),
    annotations: rules.dimensionKinds.map((kind, index) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高',
      value: Number((fields[kind] ?? '').split(/[~/]/)[0]), from: { x: kind === 'height' ? -.1 : 0, y: kind === 'height' ? 0 : -.1 - index * .15 },
      to: { x: kind === 'height' ? -.1 : 1, y: kind === 'height' ? 1 : -.1 - index * .15 } })),
    subjectAdjustment: { scale: .85, offsetX: 0, offsetY: 0 }, image: { name: mainName, blob: new Blob(['TEST主图']) },
    accessories: (chair ? ['chair-rear'] : Array.from({ length: 5 }, (_, index) => `side-detail-${index + 1}`)).map((accessory, index) => ({
      id: accessory, adjustment: { scale: chair ? .8 : 1, offsetX: 0, offsetY: 0 }, image: { name: chair ? rearName : detailNames[index], blob: new Blob([`TEST配图${index}`]) },
    })),
  };
}

let root: Root, container: HTMLDivElement;
let texts: Array<{ value: string; x: number; y: number }>, products: Array<{ name: string; args: number[] }>, downloads: string[];
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); texts = []; products = []; downloads = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  const stack: string[][] = [];
  const context = { font: '', fillStyle: '', strokeStyle: '', textAlign: '', textBaseline: '',
    fillRect() { texts.length = 0; products.length = 0; },
    measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 }; },
    fillText(value: string, x: number, y: number) { texts.push({ value, x, y }); }, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    save() { stack.push([this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline]); },
    restore() { const state = stack.pop(); if (state) [this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline] = state; },
    moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage(element: HTMLImageElement, ...args: number[]) { products.push({ name: element.alt, args }); } };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as BatchId} initialProject={{ projectId: 'batch8-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const clickText = async (value: string) => act(async () => [...container.querySelectorAll('button')].find((item) => item.textContent === value)!.click());
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
const label = (value: string) => [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith(value))!;
const field = (value: string) => label(value).querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
const values = () => texts.map((item) => item.value);
const allText = () => values().join('').replace(/\s/g, '');
const product = (name: string) => products.find((item) => item.name === name)!.args.slice();
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  expect(input).toBeTruthy();
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function select(value: string, option: string) {
  const control = label(value).querySelector('select')!;
  await act(async () => { control.value = option; control.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }
async function pointer(element: Element, type: string, x: number, y: number) { await act(async () => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }))); }
async function upload(labelText: string, name: string) {
  const input = container.querySelector<HTMLInputElement>(`[aria-label="上传${labelText} PNG"]`)!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['TEST替换配图'], name, { type: 'image/png' })] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

it('餐椅数量版只改变展示和导出名称，原始完整型号、高度说明及历史保持独立', async () => {
  const original = fixture(ids[0]), rules = SINGLE_TEMPLATE_RULES[ids[0]]; await render(original);
  expect(allText()).toContain(`${original.model}x1`);
  await click('.header-export'); expect(downloads).toHaveLength(1);
  await select('输出数量', '2'); await flush();
  expect(allText()).toContain(`${original.model}x2`); expect(field('产品型号').value).toBe(original.model);
  await click('[aria-label="撤销"]'); expect(allText()).toContain(`${original.model}x1`);
  await click('[aria-label="重做"]'); expect(allText()).toContain(`${original.model}x2`);
  await fill(field('高度补充说明'), '测试软包最高点'); await flush();
  expect(allText()).toContain('测试软包最高点');
  const saved = savedDraft(); expect(saved.model).toBe(original.model); expect(saved.modelManuallyEdited).toBe(false);
  expect(rules.restoreOptions(saved).diningChair).toMatchObject({ quantity: 2, heightNote: '测试软包最高点' });
  await reopen(saved); expect(allText()).toContain(`${original.model}x2`); expect(field('高度补充说明').value).toBe('测试软包最高点');
  await click('.header-export'); expect(downloads).toHaveLength(2); expect(downloads[1]).not.toBe(downloads[0]);
  expect(window.alert).not.toHaveBeenCalled();
});

it('餐椅常规总宽与特殊腿间宽各有独立数值，第二视图移动时只移动对应总宽标注', async () => {
  const original = fixture(ids[0]), rules = SINGLE_TEMPLATE_RULES[ids[0]]; await render(original);
  expect(allText()).toContain('总宽50.5cm');
  await select('总宽标法', 'outside'); await flush();
  expect(allText()).toContain('50.5cm'); expect(allText()).toContain('总宽52.4cm');
  const main = product(mainName), rear = product(rearName), [x, y, width, height] = rear.slice(4);
  const annotation = texts.find((item) => item.value.includes('52.4'))!;
  const canvas = container.querySelector('canvas')!, wrap = container.querySelector('.canvas-wrap')!;
  await pointer(canvas, 'pointerdown', x + width / 2, y + height / 2);
  await pointer(wrap, 'pointermove', x + width / 2 + 18, y + height / 2 + 12);
  await pointer(wrap, 'pointerup', x + width / 2 + 18, y + height / 2 + 12); await flush();
  expect(product(mainName)).toEqual(main); expect(product(rearName)).not.toEqual(rear);
  expect(texts.find((item) => item.value.includes('52.4'))).not.toEqual(annotation);
  const saved = savedDraft(); expect(saved.dimensionFields).toEqual(original.dimensionFields);
  expect(rules.restoreOptions(saved).diningChair!.outerWidth).toBe('52.4');
  await select('总宽标法', 'standard'); expect(allText()).toContain('总宽50.5cm'); expect(allText()).not.toContain('52.4');
  await select('总宽标法', 'outside'); expect(allText()).toContain('总宽52.4cm');
  await reopen(saved); expect(allText()).toContain('总宽52.4cm'); expect(product(mainName)).toEqual(main);
});

it('餐椅缺第二视图或特殊模式缺独立总宽时拦截，补全后可导出', async () => {
  const original = fixture(ids[0]); original.accessories = [];
  await render(original); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传第二视图 PNG'));
  await upload('第二视图', rearName); await select('总宽标法', 'outside');
  await fill(field('第二视图总宽'), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('第二视图总宽'), '52.4'); await click('.header-export'); expect(downloads).toHaveLength(1);
});

it('边桌五张细节文案可撤销重做和重开，不出现底部卖点输入或画布卖点', async () => {
  const rules = SINGLE_TEMPLATE_RULES[ids[1]]; await render(fixture(ids[1]));
  expect(products).toHaveLength(6); expect(container.querySelectorAll('textarea')).toHaveLength(10);
  expect([...container.querySelectorAll('label')].some((item) => /^卖点 \d/.test(item.textContent ?? ''))).toBe(false);
  expect(allText()).not.toContain('测试卖点');
  await fill(field('细节3标题'), '测试新细节'); await flush();
  await fill(field('细节3说明'), '测试新说明'); await flush();
  expect(allText()).toContain('测试新细节'); expect(allText()).toContain('测试新说明');
  await click('[aria-label="撤销"]'); expect(field('细节3说明').value).toBe('测试说明3');
  await click('[aria-label="重做"]'); expect(field('细节3说明').value).toBe('测试新说明');
  await fill(field('细节5说明'), ''); await flush();
  const saved = savedDraft(); expect(rules.restoreOptions(saved).sideTableDetails![2]).toEqual({ title: '测试新细节', description: '测试新说明' });
  await reopen(saved); expect(field('细节3标题').value).toBe('测试新细节'); expect(field('细节5说明').value).toBe('');
  await click('.header-export'); expect(downloads).toHaveLength(1); expect(window.alert).not.toHaveBeenCalled();
});

it('边桌缺细节图片或标题、文案超出容量时禁止导出，修复后恢复', async () => {
  const original = fixture(ids[1]); original.accessories = original.accessories!.filter((item) => item.id !== 'side-detail-3');
  await render(original); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传细节3 PNG'));
  await upload('细节3', detailNames[2]); await fill(field('细节1标题'), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('细节1标题'), '测试标题过长'.repeat(25)); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('细节1标题'), '测试标题'); await fill(field('细节1说明'), '测试说明过长'.repeat(25));
  await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('细节1说明'), '测试说明'); await click('.header-export'); expect(downloads).toHaveLength(1);
});

it('单张细节缩放和平移各自进入历史，其他四卡与主图不变且重开可还原', async () => {
  const original = fixture(ids[1]); await render(original);
  const others = () => products.filter((item) => item.name !== detailNames[0]).map((item) => ({ ...item, args: item.args.slice() }));
  const before = others(), detailBefore = product(detailNames[0]);
  await clickText('微调细节1'); await fill(field('缩放比例（%）'), '150'); await flush();
  expect(product(detailNames[0])).not.toEqual(detailBefore); expect(others()).toEqual(before);
  await fill(field('横向偏移（px）'), '-20'); await flush();
  const saved = savedDraft(), detailAfter = product(detailNames[0]);
  expect(saved.accessories!.find((item) => item.id === 'side-detail-1')!.adjustment).toMatchObject({ scale: 1.5, offsetX: -20 });
  expect(saved.subjectAdjustment).toEqual(original.subjectAdjustment); expect(saved.model).toBe(original.model);
  await click('[aria-label="撤销"]'); expect(product(detailNames[0])).not.toEqual(detailAfter);
  await click('[aria-label="重做"]'); expect(product(detailNames[0])).toEqual(detailAfter); expect(others()).toEqual(before);
  await reopen(saved); expect(product(detailNames[0])).toEqual(detailAfter); expect(others()).toEqual(before);
});

it('替换一张细节图只重置自身位置，保留文案、其他素材和主型号，撤销及重开不串图', async () => {
  const original = fixture(ids[1]); original.accessories![2].adjustment = { scale: 1.4, offsetX: 8, offsetY: 5 };
  await render(original); const main = product(mainName);
  await upload('细节3', 'OTHER-细节3新图.png'); await flush();
  const saved = savedDraft(); expect(saved.model).toBe(original.model); expect(saved.modelManuallyEdited).toBe(false);
  expect(saved.accessories!.find((item) => item.id === 'side-detail-3')).toMatchObject({ id: 'side-detail-3', adjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'OTHER-细节3新图.png' } });
  for (const index of [0, 1, 3, 4]) expect(saved.accessories!.find((item) => item.id === original.accessories![index].id)).toEqual(original.accessories![index]);
  expect(SINGLE_TEMPLATE_RULES[ids[1]].restoreOptions(saved).sideTableDetails).toEqual(SINGLE_TEMPLATE_RULES[ids[1]].restoreOptions(original).sideTableDetails);
  expect(product(mainName)).toEqual(main);
  await click('[aria-label="撤销"]'); expect(products.map((item) => item.name)).toEqual([mainName, ...detailNames]);
  await click('[aria-label="重做"]'); expect(products[3].name).toBe('OTHER-细节3新图.png');
  await reopen(saved); expect(products[3].name).toBe('OTHER-细节3新图.png'); expect(product(mainName)).toEqual(main);
});
