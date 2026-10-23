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
  return { blob, name, element, visible: { x: 0, y: 0, width: name.includes('学习椅') ? 350 : 800, height: name.includes('学习椅') ? 550 : 650 } };
} }));

const ids = ['study-desk-single', 'study-desk-combination'] as const;
type BatchId = typeof ids[number];
const productNames = ['TEST学习桌.png', 'TEST学习椅.png'];
const note = '*学习椅为推荐搭配，产品发货数量以最终下单选择为准';
function fixture(id: BatchId = ids[1]): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], fields = rules.parseQuickDimensions('120/140×60/65×52~76')!;
  return {
    version: 1, templateId: id, model: 'TEST学习桌120/140cm', modelManuallyEdited: false,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), studyChairModel: 'TEST学习椅A' }),
    annotations: rules.dimensionKinds.map((kind, index) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高',
      value: Number((fields[kind] ?? '').split(/[~/]/)[0]), from: { x: kind === 'height' ? -.1 : 0, y: kind === 'height' ? 0 : -.1 - index * .15 },
      to: { x: kind === 'height' ? -.1 : 1, y: kind === 'height' ? 1 : -.1 - index * .15 } })),
    subjectAdjustment: { scale: .85, offsetX: 0, offsetY: 0 }, image: { name: productNames[0], blob: new Blob(['TEST主图']) },
    ...(id === ids[1] ? { accessories: [{ id: 'study-chair', adjustment: { scale: .8, offsetX: 4, offsetY: 2 }, image: { name: productNames[1], blob: new Blob(['TEST学习椅图']) } }] } : {}),
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
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as BatchId} initialProject={{ projectId: 'batch7-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
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
async function selectSellingPoints(count: 2 | 3) {
  const control = [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith('卖点数量'))!.querySelector('select')!;
  await act(async () => { control.value = String(count); control.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }
async function pointer(element: Element, type: string, x: number, y: number) { await act(async () => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }))); }
async function upload(name: string) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="上传学习椅 PNG"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['TEST替换学习椅'], name, { type: 'image/png' })] });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
}

it.each(ids)('%s 卖点数量与最小间距进入历史，撤销重做和重开后保留隐藏第三卖点', async (id) => {
  const rules = SINGLE_TEMPLATE_RULES[id]; await render(fixture(id));
  expect(container.querySelector('.production-notes-card')!.textContent).toContain(rules.productionNotes.sourcePages);
  const gap = () => field('产品与卖点最小间距（px）'), initialGap = String(rules.createOptions().dimensionGap);
  expect(gap().min).toBe('60'); expect(gap().value).toBe(initialGap);
  await fill(field('卖点 3'), '测试第三卖点新文案'); await flush();
  await fill(gap(), '120'); await flush();
  expect(rules.restoreOptions(savedDraft()).dimensionGap).toBe(120);
  await click('[aria-label="撤销"]'); expect(gap().value).toBe(initialGap);
  await click('[aria-label="重做"]'); expect(gap().value).toBe('120');
  await selectSellingPoints(2); await flush();
  expect(texts).not.toContain('测试第三卖点新文案');
  const saved = savedDraft(); expect(saved.sellingPoints[2]).toBe('测试第三卖点新文案');
  expect(rules.restoreOptions(saved)).toMatchObject({ sellingPointCount: 2, dimensionGap: 120 });
  await click('[aria-label="撤销"]'); expect(texts).toContain('测试第三卖点新文案');
  await click('[aria-label="重做"]'); expect(texts).not.toContain('测试第三卖点新文案');
  await reopen(saved); expect(gap().value).toBe('120');
  await selectSellingPoints(3); expect(field('卖点 3').value).toBe('测试第三卖点新文案');
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads).toHaveLength(1);
});

it('单品没有大标题、学习椅输入或组合注释，完整桌子尺寸满足导出', async () => {
  await render(fixture(ids[0]));
  expect([...container.querySelectorAll('label')].some((item) => /^(主标题|组合标题|学习椅型号)/.test(item.textContent ?? ''))).toBe(false);
  expect(container.querySelector('[aria-label="上传学习椅 PNG"]')).toBeNull();
  expect(products.map((item) => item.name)).toEqual([productNames[0]]); expect(texts).not.toContain(note);
  expect(texts.join('')).toContain('52~76cm');
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads).toHaveLength(1);
  expect(container.querySelector('canvas')!.width).toBe(1440); expect(container.querySelector('canvas')!.height).toBe(1440);
});

it('学习椅独立拖动、角点缩放与重开不改变桌子主图、型号和尺寸', async () => {
  const original = fixture(); await render(original);
  const canvas = container.querySelector('canvas')!, wrap = container.querySelector('.canvas-wrap')!, main = rect(0), before = rect(1);
  const [x, y, width, height] = before;
  await pointer(canvas, 'pointerdown', x + width / 2, y + height / 2);
  await pointer(wrap, 'pointermove', x + width / 2 + 20, y + height / 2 + 15);
  await pointer(wrap, 'pointerup', x + width / 2 + 20, y + height / 2 + 15); await flush();
  const moved = rect(1); expect(moved).not.toEqual(before); expect(rect(0)).toEqual(main);
  await click('[aria-label="撤销"]'); expect(rect(1)).toEqual(before);
  await click('[aria-label="重做"]'); expect(rect(1)).toEqual(moved);
  await clickText('微调学习椅');
  const [sx, sy, sw, sh] = moved;
  await pointer(container.querySelector('[aria-label="学习椅等比例缩放 se"]')!, 'pointerdown', sx + sw, sy + sh);
  await pointer(wrap, 'pointermove', sx + sw * .7, sy + sh * .7);
  await pointer(wrap, 'pointerup', sx + sw * .7, sy + sh * .7); await flush();
  const scaled = rect(1); expect(scaled[2]).toBeCloseTo(sw * .7); expect(rect(0)).toEqual(main);
  const saved = savedDraft(); expect(saved.subjectAdjustment).toEqual(original.subjectAdjustment);
  expect(saved.annotations).toEqual(original.annotations); expect(saved.dimensionFields).toEqual(original.dimensionFields);
  expect(saved.model).toBe(original.model); expect(saved.modelManuallyEdited).toBe(false);
  await click('[aria-label="撤销"]'); expect(rect(1)).toEqual(moved);
  await click('[aria-label="重做"]'); expect(rect(1)).toEqual(scaled);
  await reopen(saved); expect(rect(1)).toEqual(scaled); expect(rect(0)).toEqual(main);
});

it('组合学习椅缺图或型号为空、过长时阻止导出，修复后无需椅子标注即可导出', async () => {
  const original = fixture(); original.accessories = [];
  await render(original); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传学习椅 PNG'));
  await upload(productNames[1]); await fill(field('学习椅型号'), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('学习椅型号'), '测试学习椅超长型号'.repeat(20)); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('学习椅型号'), 'TEST学习椅B'); await flush(); await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(texts).toContain(note); expect(texts).toContain('TEST学习椅B');
  const saved = savedDraft(); expect(saved.annotations).toHaveLength(3);
  await reopen(saved); expect(field('学习椅型号').value).toBe('TEST学习椅B');
  expect(SINGLE_TEMPLATE_RULES[ids[1]].restoreOptions(saved).studyChairModel).toBe('TEST学习椅B');
  await click('.header-export'); expect(downloads).toHaveLength(2);
});

it('学习椅换图只重置自身调整，保留完整主型号与学习椅型号且支持撤销', async () => {
  const original = fixture(); await render(original); const main = rect(0);
  await upload('OTHER-新学习椅.png'); await flush();
  const saved = savedDraft();
  expect(saved.model).toBe(original.model); expect(saved.modelManuallyEdited).toBe(false); expect(saved.image).toEqual(original.image);
  expect(SINGLE_TEMPLATE_RULES[ids[1]].restoreOptions(saved).studyChairModel).toBe('TEST学习椅A');
  expect(saved.accessories![0]).toMatchObject({ id: 'study-chair', adjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'OTHER-新学习椅.png' } });
  expect(rect(0)).toEqual(main);
  await click('[aria-label="撤销"]'); expect(products.map((item) => item.name)).toEqual(productNames);
  await click('[aria-label="重做"]'); expect(products.map((item) => item.name)).toEqual([productNames[0], 'OTHER-新学习椅.png']);
  await reopen(saved); expect(products.map((item) => item.name)).toEqual([productNames[0], 'OTHER-新学习椅.png']); expect(rect(0)).toEqual(main);
});

it.each(ids)('%s 缺失桌子尺寸标注时拦截导出，补全现有标注后恢复', async (id) => {
  const original = fixture(id); await render({ ...original, annotations: original.annotations.filter((item) => item.kind !== 'height') });
  await click('.header-export'); expect(downloads).toHaveLength(0);
  await reopen(original); await click('.header-export'); expect(downloads).toHaveLength(1);
});
