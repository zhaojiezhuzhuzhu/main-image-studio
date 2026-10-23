// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(), loadDraft: async () => null, loadRecoveryHistory: async () => [], saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn() }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 800, height: 650 } }) }));

const ids = ['long-dining-table-combination', 'round-extendable-table-combination'] as const;
type BatchId = typeof ids[number];
function fixture(id: BatchId): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id];
  const fields = rules.parseQuickDimensions(id === ids[0] ? '140/160×80×74.8' : '81.6~130/91.6~150×75.3')!;
  return { version: 1, templateId: id, model: 'TEST手动餐桌名称', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), diningChairs: { count: id === ids[0] ? 2 : 1, models: ['TEST餐椅甲', 'TEST长凳乙'], markers: [{ x: .25, y: .2 }, { x: .7, y: .8 }] } }),
    annotations: rules.dimensionKinds.map((kind, index) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : kind === 'diameter' ? '直径' : '高',
      value: Number((fields[kind] ?? '').split(/[~/]/)[0]), from: { x: kind === 'height' ? -.1 : 0, y: kind === 'height' ? 0 : -.1 - index * .15 },
      to: { x: kind === 'height' ? -.1 : 1, y: kind === 'height' ? 1 : -.1 - index * .15 } })),
    subjectAdjustment: { scale: .85, offsetX: 0, offsetY: 0 }, image: { name: 'TEST-整组素材.png', blob: new Blob(['fixture']) } };
}

let root: Root, container: HTMLDivElement;
let text: Array<{ value: string; color: string; x: number; y: number }>, products: number[][], circles: number[][], strokes: string[], downloads: string[];
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); text = []; products = []; circles = []; strokes = []; downloads = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  const stack: string[][] = [];
  const context = { font: '', fillStyle: '', strokeStyle: '', textAlign: '', textBaseline: '',
    fillRect() { text.length = 0; products.length = 0; circles.length = 0; strokes.length = 0; },
    measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 }; },
    fillText(value: string, x: number, y: number) { text.push({ value, color: this.fillStyle, x, y }); }, beginPath() {}, roundRect() {}, arc(...args: number[]) { circles.push(args); },
    fill() {}, stroke() { strokes.push(this.strokeStyle); },
    save() { stack.push([this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline]); },
    restore() { const state = stack.pop(); if (state) [this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline] = state; },
    moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage(...args: unknown[]) { products.push(args.slice(5) as number[]); } };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as BatchId} initialProject={{ projectId: 'batch5-test', fileName: 'test.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const values = () => text.map((item) => item.value);
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
const field = (label: string) => [...container.querySelectorAll('label')].find((item) => item.textContent?.startsWith(label))!.querySelector<HTMLInputElement>('input')!;
async function fill(input: HTMLInputElement, value: string) {
  expect(input).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function select(option: string, value: string) {
  const control = [...container.querySelectorAll('select')].find((item) => [...item.options].some((item) => item.value === option))!;
  await act(async () => { control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }
async function pointer(element: Element, type: string, x: number, y: number) {
  await act(async () => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })));
}

it('长桌单双款切换、型号编辑和编号位置可撤销重做，重开保留隐藏的第二款', async () => {
  const rules = SINGLE_TEMPLATE_RULES[ids[0]];
  await render(fixture(ids[0]));
  expect(values()).toContain('TEST长凳乙'); expect(circles).toHaveLength(4);
  expect(container.textContent).not.toContain('对应编号位置');
  await click('[aria-label="编辑第2款餐椅规格"]');
  await fill(container.querySelector<HTMLInputElement>('[aria-label="画布第2款餐椅规格"]')!, 'TEST长凳新名称');
  await act(async () => container.querySelector('input[aria-label="画布第2款餐椅规格"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); await flush();
  const marker = container.querySelector<HTMLElement>('[aria-label="餐椅编号 1"]')!, start = marker.style.left;
  await click('[aria-label="餐椅编号 1"]');
  expect(container.querySelector('[aria-label="移动餐椅编号 1"]')).toBeTruthy();
  const [x, y] = circles.filter((circle) => circle[2] === 20)[0];
  await pointer(marker, 'pointerdown', x, y);
  await pointer(marker, 'pointermove', x + products[0][2] * .1, y);
  await pointer(marker, 'pointerup', x + products[0][2] * .1, y); await flush();
  expect(rules.restoreOptions(savedDraft()).diningChairs!.markers[0].x).toBeCloseTo(.35);
  const markerLeft = () => container.querySelector<HTMLElement>('[aria-label="餐椅编号 1"]')!.style.left;
  const moved = markerLeft();
  await click('[aria-label="撤销"]'); expect(markerLeft()).toBe(start);
  await click('[aria-label="重做"]'); expect(markerLeft()).toBe(moved);
  await select('1', '1'); await flush();
  expect(circles).toHaveLength(0); expect(values()).not.toContain('TEST长凳新名称');
  const saved = savedDraft();
  expect(rules.restoreOptions(saved).diningChairs!.models[1]).toBe('TEST长凳新名称');
  await click('[aria-label="撤销"]'); expect(values()).toContain('TEST长凳新名称');
  await click('[aria-label="重做"]'); expect(circles).toHaveLength(0);
  await reopen(saved); await select('1', '2');
  expect(values()).toContain('TEST长凳新名称'); expect(values()).toContain('TEST手动餐桌名称');
  expect(markerLeft()).toBe(moved);
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads[0]).toContain('两款搭配');
});

it('长桌编号随整组素材拖动缩放，并在取消拖动时回到原位置', async () => {
  await render(fixture(ids[0]));
  const canvas = container.querySelector('canvas')!, wrap = container.querySelector('.canvas-wrap')!;
  const matches = () => {
    const [x, y, width, height] = products[0], markers = circles.filter((circle) => circle[2] === 20);
    expect(markers).toHaveLength(2);
    for (const [index, point] of [{ x: .25, y: .2 }, { x: .7, y: .8 }].entries()) {
      expect(markers[index][0]).toBeCloseTo(x + width * point.x); expect(markers[index][1]).toBeCloseTo(y + height * point.y);
    }
  };
  matches(); const [x, y, width, height] = products[0];
  await pointer(canvas, 'pointerdown', x + width / 2, y + height / 2);
  await pointer(wrap, 'pointermove', x + width / 2 + 20, y + height / 2 + 20); matches();
  await pointer(wrap, 'pointerup', x + width / 2 + 20, y + height / 2 + 20); matches();
  const beforeScale = products[0].slice(), [sx, sy, sw, sh] = beforeScale;
  const handle = container.querySelector('[aria-label="等比例缩放 se"]')!;
  await pointer(handle, 'pointerdown', sx + sw, sy + sh);
  await pointer(wrap, 'pointermove', sx + sw * .8, sy + sh * .8); matches();
  await pointer(wrap, 'pointerup', sx + sw * .8, sy + sh * .8); matches();
  expect(products[0][2]).toBeLessThan(beforeScale[2]);
  const beforeCancel = circles.map((circle) => [...circle]), [cx, cy, cw, ch] = products[0];
  await pointer(canvas, 'pointerdown', cx + cw / 2, cy + ch / 2);
  await pointer(wrap, 'pointermove', cx + cw / 2 + 30, cy + ch / 2); matches();
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(circles).toEqual(beforeCancel);
});

it('圆桌桌面白色与外置深色只切换直径，撤销、重做和重开保留样式', async () => {
  const rules = SINGLE_TEMPLATE_RULES[ids[1]];
  await render(fixture(ids[1]));
  const diameter = () => text.find((item) => item.value.includes('81.6'))!;
  expect(diameter().color).toBe('#ffffff'); expect(strokes).toContain('#ffffff');
  await select('outside', 'outside'); await flush();
  expect(diameter().color).toBe('#000000'); expect(strokes).not.toContain('#ffffff');
  expect(text.find((item) => item.value.includes('75.3'))!.color).toBe('#000000');
  const saved = savedDraft(); expect(rules.restoreOptions(saved).diameterPlacement).toBe('outside');
  await click('[aria-label="撤销"]'); expect(diameter().color).toBe('#ffffff');
  await click('[aria-label="重做"]'); expect(diameter().color).toBe('#000000');
  await reopen(saved); expect(diameter().color).toBe('#000000');
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads[0]).toContain('圆伸缩餐桌组合');
});

it('长餐桌长备注完整绘制、可撤销保存重开导出，搭配款数不再挤压主图', async () => {
  const draft = fixture(ids[0]), rules = SINGLE_TEMPLATE_RULES[ids[0]];
  const note = '*图示效果以1.6m餐桌为例，餐椅为不同系列搭配产品，存在色差';
  await render(draft);
  await fill(field('图示备注'), note); await flush();
  expect(values().filter((item) => note.includes(item)).join('')).toContain(note);
  expect(rules.restoreOptions(savedDraft()).noteText).toBe(note);
  const product = products[0].slice();
  await select('1', '1'); expect(products[0]).toEqual(product);
  await select('1', '2'); expect(products[0]).toEqual(product);
  await fill(field('图示备注'), '短备注'); await flush();
  await click('[aria-label="撤销"]'); expect(field('图示备注').value).toBe(note);
  await click('[aria-label="重做"]'); expect(values()).toContain('短备注');
  await fill(field('图示备注'), note); await flush();
  await reopen(savedDraft());
  expect(field('图示备注').value).toBe(note);
  expect(values().filter((item) => note.includes(item)).join('')).toContain(note);
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads).toHaveLength(1);
});

it('中文尺寸保存重开不丢失，结束画布输入后重新标注的第一次点击即设置起点', async () => {
  await render(fixture(ids[0]));
  await fill(field('快速尺寸'), '尺寸可选：140/160×80/85×75（含脚垫）'); await flush();
  expect(values()).toContain('尺寸可选：140/160cm');
  const label = text.find((item) => item.value === '尺寸可选：140/160cm')!, canvas = container.querySelector('canvas')!;
  // 文字输入框在 pointerdown 后覆盖点击位置，浏览器不会再向底层 canvas 发送 click。
  await pointer(canvas, 'pointerdown', label.x, label.y);
  const input = container.querySelector<HTMLInputElement>('[aria-label="画布长尺寸（cm）"]')!;
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await click('[aria-label="长尺寸微调"] button');
  await pointer(canvas, 'pointerdown', 450, 610); await pointer(canvas, 'click', 450, 610);
  expect(container.textContent).toContain('点击第二端点');
  await pointer(canvas, 'pointerdown', 850, 540); await pointer(canvas, 'click', 850, 540); await flush();
  expect(container.textContent).not.toContain('取消本次标注');
  expect(values()).toContain('尺寸可选：140/160cm');
  const saved = savedDraft();
  expect(saved.dimensionFields).toEqual({ length: '尺寸可选：140/160', width: '80/85', height: '75（含脚垫）' });
  expect(saved.annotations.find((item) => item.kind === 'length')?.value).toBe(140);
  await reopen(saved);
  expect(values()).toContain('尺寸可选：140/160cm');
  expect(values().join('')).toContain('75cm（含脚垫）');
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads).toHaveLength(1);
});

it.each(ids)('%s 缺少餐椅型号、文字溢出或尺寸未标注时拦截导出，修复后恢复', async (id) => {
  const draft = fixture(id); await render(draft);
  expect(container.textContent).toContain('组合模板 / 1440 × 1440');
  expect(container.querySelector('.production-notes-card')!.textContent).toContain(SINGLE_TEMPLATE_RULES[id].productionNotes.sourcePages);
  const chair = () => field(id === ids[0] ? '第1款餐椅/长凳型号' : '餐椅完整型号');
  await fill(chair(), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(chair(), '测试超长型号'.repeat(30)); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(chair(), 'TEST餐椅修复'); await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(container.querySelector('canvas')!.width).toBe(1440); expect(container.querySelector('canvas')!.height).toBe(1440);
  await reopen({ ...draft, annotations: [] }); await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(window.alert).toHaveBeenCalledTimes(3);
});
