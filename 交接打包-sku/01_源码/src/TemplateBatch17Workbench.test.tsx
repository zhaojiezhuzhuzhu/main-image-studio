// @vitest-environment jsdom
import { batch17Fixture, batch17Ids } from './TemplateBatch17.fixtures';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import type { SingleTemplateId } from './templates/registry';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(), loadDraft: async () => null, loadRecoveryHistory: async () => [], saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn(), flush: vi.fn(async () => undefined) }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: name.includes('detail') ? 1242 : 600, height: name.includes('detail') ? 504 : 900 } }) }));

let container: HTMLDivElement, root: Root, texts: string[], downloads: string[];
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); texts = []; downloads = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const stack: string[][] = [];
  const context = { font: '', letterSpacing: '0px', fillStyle: '', strokeStyle: '', textAlign: '', textBaseline: '',
    fillRect() { texts.length = 0; },
    measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 }; },
    fillText(value: string) { texts.push(value); }, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    save() { stack.push([this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline]); },
    restore() { const state = stack.pop(); if (state) [this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline] = state; },
    translate() {}, rotate() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, closePath() {}, clip() {}, drawImage() {}, setLineDash() {}, bezierCurveTo() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as SingleTemplateId} initialProject={{ projectId: 'batch17-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }

const field = (name: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
async function selectCount(value: string) {
  const input = container.querySelector<HTMLSelectElement>('select[aria-label="卖点数量"]')!;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function selectOption(name: string, value: string) {
  const input = container.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}
it.each(batch17Ids)('%s 备注和间距支持撤销重做、减少卖点后重开保留第三条', async (id) => {
  await render(batch17Fixture(id));
  await fill(field('图示备注'), '保存核对备注'); await flush();
  await click('[aria-label="撤销"]'); expect(field('图示备注').value).toBe('测试图示备注');
  await click('[aria-label="重做"]'); expect(field('图示备注').value).toBe('保存核对备注');
  await fill(field('产品与卖点间距（px）'), '90'); await selectCount('2'); await flush();
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(2);
  expect(savedDraft().sellingPoints).toEqual(['测试卖点一', '测试卖点二', '测试卖点三']);
  await reopen(savedDraft()); expect(field('图示备注').value).toBe('保存核对备注'); expect(field('产品与卖点间距（px）').value).toBe('90');
  await selectCount('3'); expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
  await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(downloads[0]).toContain(id === 'wood-long-table-combination' ? '板木长餐桌组合' : '板木圆餐桌组合');
  expect(texts).toContain('保存核对备注');
});
it.each(batch17Ids)('%s 过长备注、型号和缺图拦截，完整资料不丢失', async (id) => {
  const draft = batch17Fixture(id); await render(draft);
  const longText = '完整备注'.repeat(40); await fill(field('图示备注'), longText); await flush();
  await click('.header-export'); expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('图示备注'));
  expect(field('图示备注').value).toBe(longText);
  await fill(field('图示备注'), ''); await click('.header-export'); expect(downloads).toHaveLength(1);
  await reopen({ ...draft, model: '完整型号'.repeat(40) }); await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('蓝标区域'));
  await reopen({ ...draft, image: undefined }); await click('.header-export'); expect(downloads).toHaveLength(1);
});
it.each(batch17Ids)('%s 使用自己的尺寸种类并阻止无依据的伸缩范围', async (id) => {
  const draft = batch17Fixture(id); await render(draft);
  expect(texts).toContain(id === 'wood-long-table-combination' ? '尺寸可选:140/160/180cm' : '110cm');
  expect(texts).toContain(id === 'wood-long-table-combination' ? '75cm' : '75.3cm');
  if (id === 'wood-round-table-combination') expect(texts).not.toContain('80cm');
  await reopen({ ...draft, sizeInput: id === 'wood-long-table-combination' ? '140~180×80×75' : '110~140×75' });
  await click('.header-export'); expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('快速尺寸'));
});
it.each(batch17Ids)('%s 型号及标签位置可撤销，减少搭配款数后重开恢复隐藏资料', async (id) => {
  await render(batch17Fixture(id));
  await click('[aria-label="编辑第1款餐椅规格"]');
  await fill(field('画布第1款餐椅规格'), 'TEST17修改餐椅');
  await act(async () => field('画布第1款餐椅规格').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))); await flush();
  await click('[aria-label="撤销"]'); expect(field('第1款搭配型号').value).toBe('TEST17-1餐椅');
  await click('[aria-label="重做"]'); expect(field('第1款搭配型号').value).toBe('TEST17修改餐椅');
  await fill(field('第1款标签横向位置（%）'), '30'); await flush();
  const count = id === 'wood-long-table-combination' ? '2' : '4';
  const hidden = field(`第${count}款搭配型号`).value;
  await selectOption('搭配款数', '1'); await flush();
  expect(texts).not.toContain(hidden); expect(texts).not.toContain('2');
  await reopen(savedDraft()); expect(field('第1款标签横向位置（%）').value).toBe('30');
  await selectOption('搭配款数', count); expect(field(`第${count}款搭配型号`).value).toBe(hidden);
  await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(texts).toContain(hidden);
});
it('长桌编号位置、圆桌标注样式保存恢复且缺少搭配型号禁止导出', async () => {
  await render(batch17Fixture('wood-long-table-combination'));
  expect(container.textContent).not.toContain('对应编号位置');
  const marker = container.querySelector<HTMLElement>('[aria-label="餐椅编号 1"]')!, original = marker.style.left;
  await act(async () => marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }))); await flush();
  expect(marker.style.left).not.toBe(original);
  const moved = marker.style.left; await reopen(savedDraft());
  expect(container.querySelector<HTMLElement>('[aria-label="餐椅编号 1"]')!.style.left).toBe(moved);
  await reopen(batch17Fixture('wood-round-table-combination'));
  await selectOption('直径标注样式', 'outside'); await flush(); await reopen(savedDraft());
  expect(container.querySelector<HTMLSelectElement>('[aria-label="直径标注样式"]')!.value).toBe('outside');
  await fill(field('第4款搭配型号'), ''); await click('.header-export');
  expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('第4款搭配完整型号'));
  await selectOption('搭配款数', '1'); await click('.header-export'); expect(downloads).toHaveLength(1);
});
