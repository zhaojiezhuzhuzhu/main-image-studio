// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(),
  loadDraft: vi.fn(async () => null), loadRecoveryHistory: vi.fn(async () => []), saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn() }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 900, height: 500 } }) }));

const draft: WorkbenchDraft = { version: 1, templateId: 'soft-bed-single', model: 'BC553-A床', modelManuallyEdited: true,
  sellingPoints: ['透气生态牛皮', '静音加宽排骨架', '鹅毛混充靠包'], sizeInput: '223×168/198×183/193×118',
  dimensionFields: { length: '223', width: '', height: '118', headWidth: '168/198', footWidth: '183/193' },
  softBed: { sizeLabels: ['1.5m床', '1.8m床'], sellingPointCount: 3, dimensionGap: 60 },
  annotations: [
    { kind: 'headWidth', label: '床头宽', value: 168, from: { x: 0, y: -.15 }, to: { x: .6, y: -.15 } },
    { kind: 'footWidth', label: '床尾宽', value: 183, from: { x: .45, y: 1.2 }, to: { x: 1, y: 1 } },
    { kind: 'length', label: '长', value: 223, from: { x: 0, y: 1 }, to: { x: .4, y: 1.2 } },
    { kind: 'height', label: '高', value: 118, from: { x: -.1, y: 0 }, to: { x: -.1, y: .9 } },
  ], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'test.png', blob: new Blob(['test']) } };
let root: Root, container: HTMLDivElement;
let text: Array<{ value: string; font: string; x: number; y: number }>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); text = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const context = { font: '', fillRect() { text.length = 0; }, measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) * .55, actualBoundingBoxAscent: 34, actualBoundingBoxDescent: 10 }; },
    fillText(value: string, x: number, y: number) { text.push({ value, font: this.font, x, y }); }, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, save() {}, restore() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (value = draft) => act(async () => root.render(<SingleWorkbench templateId="soft-bed-single" onBack={() => undefined} initialProject={{ projectId: 'bed-test', fileName: 'test.skuwork', draft: value }}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
async function fill(input: HTMLInputElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('软床复用单品编辑器', () => {
  it('显示四项和对应字号，编辑双规格截断后可独立撤销、保存', async () => {
    await render();
    expect(text.find((item) => item.value === '168cm')?.font).toContain('45px');
    expect(text.find((item) => item.value === ' / ')?.font).toContain('30px');
    expect(text.find((item) => item.value === '(1.5m床)')?.font).toContain('37px');
    const label = text.find((item) => item.value === '183cm')!;
    await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
    expect(container.querySelectorAll('.dimension-card')).toHaveLength(4);
    const editor = container.querySelector<HTMLInputElement>('[aria-label="画布床尾宽尺寸（cm）"]')!;
    await fill(editor, '183.99/193.99');
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(container.querySelector<HTMLInputElement>('[placeholder="长×床头宽×床尾宽×高"]')!.value).toBe('223×168/198×183.9/193.9×118');
    await flush();
    expect(vi.mocked(saveDraft).mock.lastCall![0].dimensionFields.footWidth).toBe('183.9/193.9');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[placeholder="长×床头宽×床尾宽×高"]')!.value).toBe(draft.sizeInput);
  });
  it('规格说明、卖点数量、间距进入草稿和撤销；隐藏卖点不丢失', async () => {
    await render();
    const select = container.querySelector<HTMLSelectElement>('[aria-label="卖点数量"]')!;
    await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await flush();
    expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(2);
    expect(vi.mocked(saveDraft).mock.lastCall![0]).toMatchObject({ templateId: 'soft-bed-single', softBed: { sellingPointCount: 2, dimensionGap: 60, sizeLabels: ['1.5m床', '1.8m床'] }, sellingPoints: draft.sellingPoints });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
  });
  it('缺床尾标注与无效快速尺寸阻断导出；完整现场导出1440方图', async () => {
    await render({ ...draft, annotations: draft.annotations.filter((item) => item.kind !== 'footWidth') });
    await act(async () => container.querySelector<HTMLButtonElement>('.header-export')!.click());
    expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('床尾宽'));
    await act(async () => root.unmount()); root = createRoot(container); await render();
    await act(async () => container.querySelector<HTMLButtonElement>('.header-export')!.click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(container.querySelector('canvas')!.width).toBe(1440);
    expect(container.querySelector('canvas')!.height).toBe(1440);
    await fill(container.querySelector<HTMLInputElement>('[placeholder="长×床头宽×床尾宽×高"]')!, '223×168/×183×118');
    await act(async () => container.querySelector<HTMLButtonElement>('.header-export')!.click());
    expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('快速尺寸无效'));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });
});
