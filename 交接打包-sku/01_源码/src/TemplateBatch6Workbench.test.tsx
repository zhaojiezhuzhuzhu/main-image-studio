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
  return { blob, name, element, visible: { x: 0, y: 0, width: name.includes('增高架') ? 600 : 800, height: name.includes('增高架') ? 80 : 650 } };
} }));

const ids = ['standing-desk-single', 'standing-desk-combination'] as const;
type BatchId = typeof ids[number];
const productNames = ['TEST升降桌.png', 'TEST增高架.png', 'TEST电脑椅.png'];
function fixture(id: BatchId = ids[1]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], fields = rules.parseQuickDimensions('140×70×73~122')!;
  return { version: 1, templateId: id, model: 'TEST主型号140cm', modelManuallyEdited: false,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), headline: 'TEST升降桌系列', standingDeskSet: { count: 3, riserModel: 'TEST增高架100cm', chairModel: 'TEST电脑椅A', riserNote: '测试搭配说明' } }),
    annotations: rules.dimensionKinds.map((kind, index) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高',
      value: Number((fields[kind] ?? '').split(/[~/]/)[0]), from: { x: kind === 'height' ? -.1 : 0, y: kind === 'height' ? 0 : -.1 - index * .15 },
      to: { x: kind === 'height' ? -.1 : 1, y: kind === 'height' ? 1 : -.1 - index * .15 } })),
    subjectAdjustment: { scale: .85, offsetX: 0, offsetY: 0 }, image: { name: productNames[0], blob: new Blob(['TEST主图']) },
    ...(id === ids[1] ? { accessories: ['riser', 'chair'].map((accessory, index) => ({ id: accessory,
      adjustment: { scale: .8, offsetX: index ? 4 : 3, offsetY: 2 }, image: { name: productNames[index + 1], blob: new Blob([`TEST配件${index}`]) } })) } : {}),
  };
}

let root: Root, container: HTMLDivElement;
let texts: string[], products: Array<{ name: string; rect: number[] }>, downloads: string[];
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
    fillText(value: string) { texts.push(value); }, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    save() { stack.push([this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline]); },
    restore() { const state = stack.pop(); if (state) [this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline] = state; },
    moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage(element: HTMLImageElement, ...args: number[]) { products.push({ name: element.alt, rect: args.slice(4) }); } };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as BatchId} initialProject={{ projectId: 'batch6-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const clickText = async (value: string) => act(async () => [...container.querySelectorAll('button')].find((item) => item.textContent === value)!.click());
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
const field = (label: string) => [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith(label))!.querySelector<HTMLInputElement>('input')!;
const rect = (index: number) => products.find((item) => item.name === productNames[index])!.rect.slice();
async function fill(input: HTMLInputElement, value: string) {
  expect(input).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function selectSet(count: 2 | 3) {
  const control = [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith('套装选择'))!.querySelector('select')!;
  await act(async () => { control.value = String(count); control.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }
async function pointer(element: Element, type: string, x: number, y: number) { await act(async () => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }))); }
async function upload(label: string, name: string) {
  const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['TEST替换素材'], name, { type: 'image/png' })] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

it('三件套切回两件套只绘制当前素材，撤销重做及重开保留隐藏电脑椅', async () => {
  const rules = SINGLE_TEMPLATE_RULES[ids[1]], original = fixture();
  await render(original); expect(products).toHaveLength(3);
  await fill(field('电脑椅型号'), 'TEST电脑椅B'); await flush();
  const chairRect = rect(2);
  await selectSet(2); await flush();
  expect(products.map((item) => item.name)).toEqual(productNames.slice(0, 2));
  expect(texts).not.toContain('TEST电脑椅B');
  const saved = savedDraft();
  expect(saved.accessories).toEqual(original.accessories);
  expect(rules.restoreOptions(saved).standingDeskSet).toMatchObject({ count: 2, chairModel: 'TEST电脑椅B' });
  await click('[aria-label="撤销"]'); expect(products).toHaveLength(3); expect(rect(2)).toEqual(chairRect);
  await click('[aria-label="重做"]'); expect(products).toHaveLength(2);
  await reopen(saved); expect(products).toHaveLength(2);
  await selectSet(3); expect(products).toHaveLength(3); expect(texts).toContain('TEST电脑椅B'); expect(rect(2)).toEqual(chairRect);
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads[0]).toContain('三件套');
});

it('配件拖动允许越界预览，松开适配配件区域且可撤销，Esc取消不影响主图', async () => {
  const original = fixture(), rules = SINGLE_TEMPLATE_RULES[ids[1]];
  await render(original);
  const canvas = container.querySelector('canvas')!, wrap = container.querySelector('.canvas-wrap')!, main = rect(0), before = rect(1);
  const area = rules.accessories!(rules.restoreOptions(original), rules.layout([], rules.restoreOptions(original))).find((item) => item.id === 'riser')!.area;
  const [x, y, width, height] = before;
  await pointer(canvas, 'pointerdown', x + width / 2, y + height / 2);
  await pointer(wrap, 'pointermove', x + width / 2 + 1000, y + height / 2 + 500);
  expect(rect(1)[0]).toBeCloseTo(x + 1000); expect(rect(1)[0]).toBeGreaterThan(area.x + area.width); expect(rect(0)).toEqual(main);
  await pointer(wrap, 'pointerup', x + width / 2 + 1000, y + height / 2 + 500); await flush();
  const fitted = rect(1);
  expect(fitted[0]).toBeGreaterThanOrEqual(area.x); expect(fitted[0] + fitted[2]).toBeLessThanOrEqual(area.x + area.width + .001);
  expect(fitted[1] + fitted[3]).toBeLessThanOrEqual(area.y + area.height + .001); expect(rect(0)).toEqual(main);
  expect(savedDraft().subjectAdjustment).toEqual(original.subjectAdjustment);
  await click('[aria-label="撤销"]'); expect(rect(1)).toEqual(before);
  await click('[aria-label="重做"]'); expect(rect(1)).toEqual(fitted);
  const [cx, cy, cw, ch] = fitted;
  await pointer(canvas, 'pointerdown', cx + cw / 2, cy + ch / 2);
  await pointer(wrap, 'pointermove', cx + cw / 2 - 50, cy + ch / 2 - 20);
  expect(rect(1)).not.toEqual(fitted);
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(rect(1)).toEqual(fitted); expect(rect(0)).toEqual(main);
  await click('[aria-label="撤销"]'); expect(rect(1)).toEqual(before);
  await click('[aria-label="重做"]'); expect(rect(1)).toEqual(fitted);
});

it('配件角点缩放和数值位置各自进入历史，重开保留结果且主图不变', async () => {
  await render(fixture());
  const main = rect(0), before = rect(1), [x, y, width, height] = before;
  await clickText('微调增高架');
  const wrap = container.querySelector('.canvas-wrap')!;
  await pointer(container.querySelector('[aria-label="增高架等比例缩放 se"]')!, 'pointerdown', x + width, y + height);
  await pointer(wrap, 'pointermove', x + width * .65, y + height * .65);
  await pointer(wrap, 'pointerup', x + width * .65, y + height * .65); await flush();
  const scaled = rect(1); expect(scaled[2]).toBeCloseTo(width * .65); expect(rect(0)).toEqual(main);
  await click('[aria-label="撤销"]'); expect(rect(1)).toEqual(before);
  await click('[aria-label="重做"]'); expect(rect(1)).toEqual(scaled);
  await clickText('微调增高架');
  await fill(field('缩放比例（%）'), '50'); await flush();
  await fill(field('横向偏移（px）'), '20'); await flush();
  await fill(field('纵向偏移（px）'), '5'); await flush();
  const saved = savedDraft(), position = saved.accessories!.find((item) => item.id === 'riser')!.adjustment;
  expect(position).toEqual({ scale: .5, offsetX: 20, offsetY: 5 }); expect(rect(0)).toEqual(main);
  const adjusted = rect(1);
  await click('[aria-label="撤销"]'); expect(rect(1)[1]).not.toEqual(adjusted[1]);
  await click('[aria-label="重做"]'); expect(rect(1)).toEqual(adjusted);
  await reopen(saved); expect(rect(1)).toEqual(adjusted); expect(rect(0)).toEqual(main);
});

it.each(ids)('%s 标题缺失或过长时阻止导出，修复后可导出并保存重开', async (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id]; await render(fixture(id));
  expect(container.querySelector('.production-notes-card')!.textContent).toContain(rules.productionNotes.sourcePages);
  const title = () => field(id === ids[0] ? '主标题' : '组合标题');
  await fill(title(), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(title(), '测试超长标题'.repeat(20)); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(title(), 'TEST新标题'); await flush(); await click('.header-export'); expect(downloads).toHaveLength(1);
  const saved = savedDraft(); expect(rules.restoreOptions(saved).headline).toBe('TEST新标题');
  await reopen(saved); expect(title().value).toBe('TEST新标题'); expect(texts).toContain('TEST新标题');
  expect(window.alert).toHaveBeenCalledTimes(2);
});

it('组合当前配件图片或型号缺失时阻止导出，切两件套只校验增高架，补图可导出', async () => {
  const original = fixture(); original.accessories = original.accessories!.filter((item) => item.id !== 'chair');
  await render(original); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传电脑椅 PNG'));
  await selectSet(2); await click('.header-export'); expect(downloads).toHaveLength(1);
  await selectSet(3); await upload('上传电脑椅 PNG', productNames[2]);
  await fill(field('电脑椅型号'), ''); await click('.header-export'); expect(downloads).toHaveLength(1);
  await fill(field('电脑椅型号'), 'TEST新电脑椅'); await click('.header-export'); expect(downloads).toHaveLength(2);
  await fill(field('增高架型号'), ''); await click('.header-export'); expect(downloads).toHaveLength(2);
  await fill(field('增高架型号'), 'TEST新增高架'); await click('.header-export'); expect(downloads).toHaveLength(3);
});

it('更换配件素材只重置对应配件的位置，不改主型号与其他图片，撤销可恢复', async () => {
  const original = fixture(); await render(original);
  const main = rect(0), chair = rect(2);
  await upload('上传增高架 PNG', 'OTHER-新增高架.png'); await flush();
  const saved = savedDraft();
  expect(saved.model).toBe(original.model); expect(saved.modelManuallyEdited).toBe(false); expect(saved.image).toEqual(original.image);
  expect(saved.accessories!.find((item) => item.id === 'chair')).toEqual(original.accessories![1]);
  expect(saved.accessories!.find((item) => item.id === 'riser')).toMatchObject({ adjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'OTHER-新增高架.png' } });
  expect(rect(0)).toEqual(main); expect(rect(2)).toEqual(chair);
  await click('[aria-label="撤销"]'); expect(products.map((item) => item.name)).toEqual(productNames);
  await click('[aria-label="重做"]'); expect(products.map((item) => item.name)).toEqual([productNames[0], 'OTHER-新增高架.png', productNames[2]]);
});
