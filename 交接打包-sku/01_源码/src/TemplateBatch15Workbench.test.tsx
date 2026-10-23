// @vitest-environment jsdom
import { batch15Fixture, batch15Ids } from './TemplateBatch15.fixtures';
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
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as SingleTemplateId} initialProject={{ projectId: 'batch15-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
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
it.each(batch15Ids)('%s 备注和间距支持撤销重做、减少卖点后重开保留第三条', async (id) => {
  await render(batch15Fixture(id));
  await fill(field('图示备注'), '保存核对备注'); await flush();
  await click('[aria-label="撤销"]'); expect(field('图示备注').value).toBe('测试图示备注');
  await click('[aria-label="重做"]'); expect(field('图示备注').value).toBe('保存核对备注');
  await fill(field('产品与卖点间距（px）'), '90'); await selectCount('2'); await flush();
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(2);
  expect(savedDraft().sellingPoints).toEqual(['测试卖点一', '测试卖点二', '测试卖点三']);
  await reopen(savedDraft()); expect(field('图示备注').value).toBe('保存核对备注'); expect(field('产品与卖点间距（px）').value).toBe('90');
  await selectCount('3'); expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
  await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(downloads[0]).toContain(id === 'shaped-vanity-single' ? '异形妆台单品' : '板木书桌单品');
  expect(texts).toContain('保存核对备注');
});
it.each(batch15Ids)('%s 过长备注、型号和缺图拦截，完整资料不丢失', async (id) => {
  const draft = batch15Fixture(id); await render(draft);
  const longText = '完整备注'.repeat(40); await fill(field('图示备注'), longText); await flush();
  await click('.header-export'); expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('图示备注'));
  expect(field('图示备注').value).toBe(longText);
  await fill(field('图示备注'), ''); await click('.header-export'); expect(downloads).toHaveLength(1);
  await reopen({ ...draft, model: '完整型号'.repeat(40) }); await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('蓝标区域'));
  await reopen({ ...draft, image: undefined }); await click('.header-export'); expect(downloads).toHaveLength(1);
});
