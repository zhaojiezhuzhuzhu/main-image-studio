// @vitest-environment jsdom
import { batch11Fixture, batch11Ids } from './TemplateBatch11.fixtures';
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
    moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, closePath() {}, clip() {}, drawImage() {}, setLineDash() {}, bezierCurveTo() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as SingleTemplateId} initialProject={{ projectId: 'batch11-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }

const field = (name: string) => [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith(name))!.querySelector<HTMLInputElement>('input')!;
async function quantity(value: string) {
  const select = [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith('枕头输出数量'))!.querySelector('select')!;
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('双面床垫硬度切换、位置和描述进入撤销重做与重开', async () => {
  await render(batch11Fixture('mattress-double'));
  await fill(field('反面软硬度数值'), '1.7'); await flush();
  expect(container.textContent).toContain('使用成对固定圆标'); expect(texts).toContain('1.7');
  expect([...container.querySelectorAll('label')].some((label) => label.textContent?.includes('指示位置数值'))).toBe(false);
  await click('[aria-label="撤销"]'); expect(field('反面软硬度数值').value).toBe('2.8');
  await click('[aria-label="重做"]'); expect(field('反面软硬度数值').value).toBe('1.7');
  await fill(field('反面软硬度数值'), '1.1'); await flush(); expect(texts).toContain('正反面');
  await reopen(savedDraft()); expect(field('反面软硬度数值').value).toBe('1.1'); expect(texts).toContain('正反面');
  await fill(field('反面软硬度数值'), '8'); await flush(); expect(field('反面指示位置数值').value).toBe('30');
  await click('.header-export'); expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('60%–80%'));
  await fill(field('反面指示位置数值'), '75'); await fill(field('正面说明'), '保存测试说明'); await flush();
  await reopen(savedDraft()); expect(field('正面说明').value).toBe('保存测试说明'); expect(field('反面指示位置数值').value).toBe('75');
  await click('.header-export'); expect(downloads).toEqual(['TEST11-床垫双面睡-SKU.jpg']);
});
it('枕头双件和单件互切保持图片、尺寸和局部说明，支持撤销与保存', async () => {
  await render(batch11Fixture('pillow-single')); expect(texts).toContain('x2');
  await quantity('1'); await flush(); expect(texts).not.toContain('x2');
  await click('[aria-label="撤销"]'); expect(texts).toContain('x2');
  await click('[aria-label="重做"]'); expect(texts).not.toContain('x2');
  await fill(field('局部尺寸说明'), '测试区9cm'); await flush();
  const saved = savedDraft(); await reopen(saved); expect(field('局部尺寸说明').value).toBe('测试区9cm');
  expect(saved.accessories).toHaveLength(3); expect(saved.dimensionFields).toEqual({ length: '57.9', width: '37.9', height: '11.9' });
  await click('.header-export'); expect(downloads).toEqual(['TEST11-枕头单件-SKU.jpg']);
  await quantity('2'); await click('.header-export'); expect(downloads).toEqual(['TEST11-枕头单件-SKU.jpg', 'TEST11-枕头双件x2-SKU.jpg']);
});
it.each(batch11Ids)('%s 缺材质图和超长文案阻止导出且保留完整输入', async (id) => {
  const draft = batch11Fixture(id); draft.accessories!.pop(); await render(draft); await click('.header-export');
  expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传材质卖点3'));
  await reopen(batch11Fixture(id)); const title = id === 'mattress-double' ? '床垫标题' : '枕头标题';
  await fill(field(title), '完整标题'.repeat(50)); await flush(); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(field(title).value).toBe('完整标题'.repeat(50)); await fill(field(title), '测试新标题');
  await fill(field('材质卖点1文案'), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field('材质卖点1文案'), '测试材质'); await click('.header-export'); expect(downloads).toHaveLength(1);
});
