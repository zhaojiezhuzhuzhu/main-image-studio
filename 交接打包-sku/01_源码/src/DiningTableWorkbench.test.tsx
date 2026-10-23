// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(),
  loadDraft: vi.fn(async () => null), loadRecoveryHistory: vi.fn(async () => []), saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn() }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 800, height: 600 } }) }));

const ids = ['long-dining-table-single', 'round-extendable-table-single'] as const;
type DiningId = typeof ids[number];
function fixture(id: DiningId): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id];
  const fields = rules.parseQuickDimensions(id === 'long-dining-table-single' ? '140/160×80×75' : '81.6~130/91.6~150×75')!;
  return { version: 1, templateId: id, model: 'TEST餐桌', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions({ ...rules.createOptions(), noteText: '流程测试备注', heightNote: '测试高度说明' }),
    annotations: rules.dimensionKinds.map((kind, index) => ({ kind, label: kind === 'diameter' ? '直径' : kind === 'height' ? '高' : kind === 'length' ? '长' : '宽',
      value: Number((fields[kind] ?? '').split(/[~/]/)[0]),
      from: { x: index === 2 ? -.1 : 0, y: index === 2 ? 0 : -.1 - index * .15 },
      to: { x: index === 2 ? -.1 : 1, y: index === 2 ? 1 : -.1 - index * .15 } })),
    subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'fixture.png', blob: new Blob(['fixture']) } };
}

let root: Root, container: HTMLDivElement;
let text: Array<{ value: string; x: number; y: number }>;
beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); text = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const context = { font: '', fillRect() { text.length = 0; },
    measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) * .55, actualBoundingBoxAscent: 34, actualBoundingBoxDescent: 10 }; },
    fillText(value: string, x: number, y: number) { text.push({ value, x, y }); },
    beginPath() {}, roundRect() {}, fill() {}, stroke() {}, save() {}, restore() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

it('圆桌辅助线使用独立菱形，拖动不改变主线，支持取消、撤销、重做及重开', async () => {
  const draft = fixture('round-extendable-table-single'); await render(draft);
  const label = text.find((item) => item.value.includes('81.6~130'))!;
  await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  await act(async () => container.querySelector('input[aria-label="画布直径尺寸（cm）"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const toggle = [...container.querySelectorAll('button')].find((button) => button.textContent === '辅助线')!;
  await act(async () => toggle.click());
  expect(container.querySelectorAll('.dimension-extension-handle')).toHaveLength(2);
  expect(container.querySelectorAll('.dimension-endpoint:not(.dimension-extension-handle)')).toHaveLength(0);
  const handle = container.querySelector<HTMLButtonElement>('[aria-label="直径辅助线起点"]')!;
  const x = parseFloat(handle.style.left) * 14.4, y = parseFloat(handle.style.top) * 14.4;
  const pointer = async (type: string, dy: number) => act(async () => { handle.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y + dy, bubbles: true })); });
  await pointer('pointerdown', 0); await pointer('pointermove', 80);
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  await pointer('pointerup', 80); await flush();
  expect(vi.mocked(saveDraft).mock.lastCall![0].annotations[0].extensionOffsets).toBeUndefined();
  await pointer('pointerdown', 0); await pointer('pointermove', 80); await pointer('pointerup', 80); await flush();
  const saved = vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
  expect(saved.annotations[0].extensionOffsets!.from).toBeGreaterThan(0);
  for (const end of ['from', 'to'] as const) for (const axis of ['x', 'y'] as const) expect(saved.annotations[0][end][axis]).toBeCloseTo(draft.annotations[0][end][axis], 10);
  expect(saved.annotations[0].extensionOffsets!.to).toBeUndefined();
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click()); await flush();
  expect(vi.mocked(saveDraft).mock.lastCall![0].annotations[0].extensionOffsets).toBeUndefined();
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click()); await flush();
  expect(vi.mocked(saveDraft).mock.lastCall![0].annotations[0].extensionOffsets).toEqual(saved.annotations[0].extensionOffsets);
  await act(async () => root.unmount()); root = createRoot(container);
  await render(saved); await flush();
  expect(vi.mocked(saveDraft).mock.lastCall![0].annotations[0].extensionOffsets).toEqual(saved.annotations[0].extensionOffsets);
});

it('Shift 新建标注和端点拖动锁定方向，按下及松开立即更新拖动预览', async () => {
  await render(fixture('round-extendable-table-single'));
  const label = text.find((item) => item.value.includes('81.6~130'))!;
  const canvas = container.querySelector('canvas')!;
  await act(async () => canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  await act(async () => container.querySelector('input[aria-label="画布直径尺寸（cm）"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const handle = container.querySelector<HTMLButtonElement>('[aria-label="直径标注终点"]')!;
  const x = parseFloat(handle.style.left) * 14.4, y = parseFloat(handle.style.top) * 14.4;
  await act(async () => handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y, bubbles: true })));
  await act(async () => handle.dispatchEvent(new MouseEvent('pointermove', { clientX: x - 30, clientY: y + 30, bubbles: true })));
  const line = () => container.querySelector('.dimension-line-selection line')!;
  expect(line().getAttribute('y1')).not.toBe(line().getAttribute('y2'));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })));
  expect(line().getAttribute('y1')).toBe(line().getAttribute('y2'));
  await act(async () => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', shiftKey: false })));
  expect(line().getAttribute('y1')).not.toBe(line().getAttribute('y2'));
  await act(async () => handle.dispatchEvent(new MouseEvent('pointerup', { clientX: x - 30, clientY: y + 30, shiftKey: true, bubbles: true })));
  await flush();
  let saved = vi.mocked(saveDraft).mock.lastCall![0];
  expect(saved.annotations[0].from.y).toBe(saved.annotations[0].to.y);
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="直径尺寸微调"] button')!.click());
  await act(async () => canvas.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 600, bubbles: true })));
  // 首次 canvas click 可能消费此前文字选中的抑制标记。
  if (!container.textContent?.includes('点击第二端点')) await act(async () => canvas.dispatchEvent(new MouseEvent('click', { clientX: 400, clientY: 600, bubbles: true })));
  await act(async () => canvas.dispatchEvent(new MouseEvent('click', { clientX: 430, clientY: 900, shiftKey: true, bubbles: true })));
  await flush(); saved = vi.mocked(saveDraft).mock.lastCall![0];
  expect(saved.annotations[0].from.x).toBe(saved.annotations[0].to.x);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench key={draft.templateId} templateId={draft.templateId as DiningId} onBack={() => undefined} initialProject={{ projectId: 'dining-test', fileName: 'test.skuwork', draft }}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
async function fill(input: HTMLInputElement, value: string) {
  expect(input).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

it.each(ids)('%s 备注立即绘制，专属选项保存后可撤销与重做', async (id) => {
  await render(fixture(id));
  expect(text.some((item) => item.value.includes('流程测试备注'))).toBe(true);
  expect(text.some((item) => item.value.includes('测试高度说明'))).toBe(true);
  const noteInput = [...container.querySelectorAll('input')].find((input) => input.value === '流程测试备注')!;
  await fill(noteInput, '更新后的测试备注'); await flush();
  expect(text.some((item) => item.value.includes('更新后的测试备注'))).toBe(true);
  const saved = vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
  expect(saved.templateId).toBe(id);
  expect(SINGLE_TEMPLATE_RULES[id].restoreOptions(saved).noteText).toBe('更新后的测试备注');
  expect(saved).not.toHaveProperty(id === 'long-dining-table-single' ? 'roundExtendableTable' : 'longDiningTable');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
  expect(noteInput.value).toBe('流程测试备注');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
  expect(noteInput.value).toBe('更新后的测试备注');
  const select = container.querySelector<HTMLSelectElement>('select')!;
  await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await flush();
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(2);
  expect((vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).sellingPoints).toHaveLength(3);
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
});

it('圆桌直径画布编辑保留伸缩范围、截断小数，并同步快速尺寸和撤销', async () => {
  const draft = fixture('round-extendable-table-single'); await render(draft);
  const label = text.find((item) => item.value.includes('81.6~130'))!;
  await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  expect(container.querySelectorAll('.dimension-card')).toHaveLength(2);
  const editor = container.querySelector<HTMLInputElement>('[aria-label="画布直径尺寸（cm）"]')!;
  await fill(editor, '81.69~130.99/91.69~150.99');
  await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await flush();
  const saved = vi.mocked(saveDraft).mock.lastCall![0];
  expect(saved.dimensionFields).toEqual({ length: '', width: '', height: '75', diameter: '81.6~130.9/91.6~150.9' });
  expect(saved.sizeInput).toBe('81.6~130.9/91.6~150.9×75');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
  expect(text.some((item) => item.value.includes('81.6~130'))).toBe(true);
  await flush(); expect(vi.mocked(saveDraft).mock.lastCall![0].dimensionFields).toEqual(draft.dimensionFields);
});

it.each(ids)('%s 完整项目允许导出，缺少标注或快速尺寸无效时阻止导出', async (id) => {
  const draft = fixture(id); await render(draft);
  const exportButton = () => container.querySelector<HTMLButtonElement>('.header-export')!;
  await act(async () => exportButton().click());
  expect(window.alert).not.toHaveBeenCalled();
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(container.querySelector('canvas')!.width).toBe(1440);
  expect(container.querySelector('canvas')!.height).toBe(1440);
  const quickInput = container.querySelector<HTMLInputElement>(`[placeholder="${SINGLE_TEMPLATE_RULES[id].sizePlaceholder}"]`)!;
  await fill(quickInput, '无效尺寸');
  await act(async () => exportButton().click());
  expect(window.alert).toHaveBeenCalled(); expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount()); root = createRoot(container);
  await render({ ...draft, annotations: draft.annotations.slice(1) });
  await act(async () => exportButton().click());
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining(id === 'long-dining-table-single' ? '长' : '直径'));
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
});
