// @vitest-environment jsdom
import { batch12Fixture, batch12Ids } from './TemplateBatch12.fixtures';
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
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as SingleTemplateId} initialProject={{ projectId: 'batch12-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }

const field = (name: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`)!;
it.each(batch12Ids)('%s 配件可选择微调并保存独立缩放', async (id) => {
  await render(batch12Fixture(id));
  const label = id === 'soft-bed-combination' ? '微调搭配床垫' : '微调搭配床垫1';
  await act(async () => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === label)!.click());
  const inspector = container.querySelector('.product-inspector');
  expect(inspector?.textContent).toContain('缩放比例');
  await fill(inspector!.querySelector<HTMLInputElement>('input[max="100"]')!, '70'); await flush();
  const slot = id === 'soft-bed-combination' ? 'soft-bed-set-mattress' : 'soft-bed-multi-mattress-1';
  expect(savedDraft().accessories!.find((item) => item.id === slot)!.adjustment.scale).toBe(.7);
});
async function select(name: string, value: string) {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!;
  await act(async () => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('单组合切换三种搭配、普通/储物间距，隐藏图文保留且支持撤销重开', async () => {
  await render(batch12Fixture('soft-bed-combination'));
  await fill(field('床垫名称'), '改后床垫'); await flush();
  await click('[aria-label="撤销"]'); expect(field('床垫名称').value).toBe('测试床垫');
  await click('[aria-label="重做"]'); expect(field('床垫名称').value).toBe('改后床垫');
  await select('搭配形式', 'cabinet'); await flush(); expect(field('床垫名称')).toBeNull();
  expect(savedDraft().accessories).toHaveLength(2); await reopen(savedDraft()); await select('搭配形式', 'both'); expect(field('床垫名称').value).toBe('改后床垫');
  await select('床体类型', 'storage'); expect(field('床体与床垫间距（px）').value).toBe('30'); expect(field('搭配区与备注间距（px）').value).toBe('40');
  await click('.header-export'); expect(downloads).toEqual(['TEST12床-软床组合-床垫床头柜-SKU.jpg']);
  await select('搭配形式', 'mattress'); await click('.header-export'); expect(downloads[1]).toBe('TEST12床-软床组合-床垫-SKU.jpg');
  await select('搭配形式', 'cabinet'); await click('.header-export'); expect(downloads[2]).toBe('TEST12床-软床组合-床头柜-SKU.jpg');
});
it('多组合减少款数保留全部隐藏图片和资料，重开可恢复，硬度参数独立', async () => {
  await render(batch12Fixture('soft-bed-multi-combination'));
  await fill(field('床垫3名称'), '保存第三款'); await flush();
  await select('床垫款数', '2'); await select('床头柜款数', '0'); await flush();
  expect(field('床垫3名称')).toBeNull(); expect(field('床头柜1型号及规格')).toBeNull(); expect(savedDraft().accessories).toHaveLength(5);
  await reopen(savedDraft()); await click('.header-export'); expect(downloads).toEqual(['TEST12床-软床多组合-2款床垫-0款床头柜-SKU.jpg']);
  await select('床垫款数', '3'); await select('床头柜款数', '2'); expect(field('床垫3名称').value).toBe('保存第三款');
  await fill(field('床垫1反面软硬度数值'), '8'); await flush(); expect(field('床垫1反面指示位置（%）').value).toBe('30');
  await click('.header-export'); expect(downloads).toHaveLength(1); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('60%–80%'));
  await fill(field('床垫1反面指示位置（%）'), '75'); await flush(); await reopen(savedDraft()); expect(field('床垫1反面指示位置（%）').value).toBe('75');
  expect(field('床垫2反面软硬度数值').value).toBe('1.7'); expect(field('床垫3反面软硬度数值').value).toBe('1.1');
  await click('.header-export'); expect(downloads[1]).toBe('TEST12床-软床多组合-3款床垫-2款床头柜-SKU.jpg');
});
it('单组合第三个卖点完整显示，编辑、撤销重做、重开及导出均不被半栏限制拦截', async () => {
  await render(batch12Fixture('soft-bed-combination'));
  const context = container.querySelector('canvas')!.getContext('2d')!, point = '人体工学五区弹簧';
  const measure = context.measureText.bind(context);
  vi.spyOn(context, 'measureText').mockImplementation((text) => text === point ? { ...measure(text), width: 240 } : measure(text));
  await fill(field('床垫卖点3'), point); await flush();
  await click('[aria-label="撤销"]'); expect(field('床垫卖点3').value).toBe('测试卖点三');
  await click('[aria-label="重做"]'); expect(field('床垫卖点3').value).toBe(point);
  await flush(); await reopen(savedDraft()); expect(field('床垫卖点3').value).toBe(point);
  await click('.header-export'); expect(downloads).toEqual(['TEST12床-软床组合-床垫床头柜-SKU.jpg']);
  expect(texts).toContain(point); expect(window.alert).not.toHaveBeenCalled();
  await select('搭配形式', 'mattress'); await click('.header-export');
  expect(downloads[1]).toBe('TEST12床-软床组合-床垫-SKU.jpg'); expect(texts).toContain(point);
});
it.each(batch12Ids)('%s 缺图、缺厚度和过长名称拦截导出，固定备注不变', async (id) => {
  const draft = batch12Fixture(id); draft.accessories!.pop(); await render(draft); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传搭配床垫'));
  await reopen(batch12Fixture(id)); const prefix = id === 'soft-bed-combination' ? '床垫' : '床垫1';
  await fill(field(`${prefix}名称`), '完整名称'.repeat(40)); await flush(); await click('.header-export'); expect(downloads).toHaveLength(0); expect(field(`${prefix}名称`).value).toBe('完整名称'.repeat(40));
  await fill(field(`${prefix}名称`), '测试床垫'); await fill(field(`${prefix}厚度（cm）`), ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(field(`${prefix}厚度（cm）`), '21.99'); await click('.header-export'); expect(downloads).toHaveLength(1);
  expect(texts).toContain('*床头柜/床垫为推荐搭配，产品发货数量以最终下单选择为准'); expect(texts.some((text) => text.includes('21.9cm'))).toBe(true);
});
