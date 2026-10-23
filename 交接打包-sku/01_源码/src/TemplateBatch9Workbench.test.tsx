// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SINGLE_TEMPLATE_RULES, type SingleTemplateId } from './templates/registry';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(), loadDraft: async () => null, loadRecoveryHistory: async () => [], saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn(), flush: vi.fn(async () => undefined) }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: name.includes('detail') ? 1242 : 600, height: name.includes('detail') ? 504 : 900 } }) }));

const ids = ['computer-chair-single', 'ergonomic-chair-single'] as const;
function fixture(id: SingleTemplateId): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], key = id === ids[0] ? 'computerChairDetails' : 'ergonomicChairDetails';
  const options = { ...rules.createOptions(), [key]: Array.from({ length: 5 }, (_, index) => ({ title: `测试细节${index + 1}`, description: '测试说明' })) };
  const fields = rules.parseQuickDimensions(id === 'sofa-single' ? '240×100×88' : '65×70×105~115')!;
  const image = (name: string) => ({ name, blob: new Blob([name], { type: 'image/png' }) });
  return { version: 1, templateId: id, model: 'TEST椅', modelManuallyEdited: true, sellingPoints: [],
    sizeInput: rules.formatFields(fields), dimensionFields: fields, ...rules.saveOptions(options),
    annotations: rules.dimensionKinds.map((kind) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高', value: Number(fields[kind]!.split('~')[0]),
      from: kind === 'height' ? { x: -.05, y: 0 } : { x: 0, y: kind === 'length' ? -.1 : 1.1 },
      to: kind === 'height' ? { x: -.05, y: 1 } : { x: 1, y: kind === 'length' ? -.1 : 1.1 } })),
    subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: image('TEST-main.png'),
    accessories: (rules.accessories?.(options, rules.layout([], options)) ?? []).map((slot) => ({ id: slot.id, image: image(`${slot.id}.png`), adjustment: { scale: 1, offsetX: 0, offsetY: 0 } })) };
}

let container: HTMLDivElement, root: Root, texts: string[], downloads: string[];
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); texts = []; downloads = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const stack: string[][] = [];
  const context = { font: '', fillStyle: '', strokeStyle: '', textAlign: '', textBaseline: '',
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
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as SingleTemplateId} initialProject={{ projectId: 'batch9-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
const savedDraft = () => vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
async function fill(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function reopen(draft: WorkbenchDraft) { await act(async () => root.unmount()); root = createRoot(container); await render(draft); }

it.each(ids)('%s 完整卡片文案进入撤销重做与重开并可导出', async (id) => {
  await render(fixture(id));
  expect(container.querySelectorAll('textarea')).toHaveLength(10);
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(0);
  await fill(container.querySelector('textarea')!, '第一行\n第二行'); await flush();
  expect(texts).toContain('第一行'); expect(texts).toContain('第二行');
  await click('[aria-label="撤销"]'); expect(container.querySelector('textarea')!.value).toBe('测试细节1');
  await click('[aria-label="重做"]'); expect(container.querySelector('textarea')!.value).toBe('第一行\n第二行');
  await flush(); const saved = savedDraft();
  await reopen(saved); expect(container.querySelector('textarea')!.value).toBe('第一行\n第二行');
  expect(saved.accessories).toHaveLength(5);
  await click('.header-export'); expect(downloads).toHaveLength(1); expect(window.alert).not.toHaveBeenCalled();
});

it.each(ids)('%s 缺图及文案超限拦截导出，完整原文保留', async (id) => {
  const original = fixture(id); original.accessories!.pop();
  await render(original); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传'));
  await reopen(fixture(id));
  const overlong = '测试完整内容'.repeat(35);
  await fill(container.querySelector('textarea')!, overlong); await flush();
  await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(container.querySelector('textarea')!.value).toBe(overlong);
  await fill(container.querySelector('textarea')!, ''); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(container.querySelector('textarea')!, '测试完整标题'); await click('.header-export'); expect(downloads).toHaveLength(1);
});

const firmnessToggle = () => [...container.querySelectorAll('label')].find((label) => label.textContent?.includes('显示坐感软硬度'))!.querySelector<HTMLInputElement>('input')!;
const firmnessField = (name: string) => [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith(name))!.querySelector<HTMLInputElement>('input')!;
it('沙发坐感默认为关闭，填写、位置微调、撤销重做和隐藏重开均保留独立值', async () => {
  await render(fixture('sofa-single'));
  expect(firmnessToggle().checked).toBe(false); expect(texts).not.toContain('舒软');
  await act(async () => firmnessToggle().click()); await flush();
  await fill(firmnessField('坐感数值'), '6.5'); await flush();
  await fill(firmnessField('坐感说明'), '舒软'); await flush();
  await fill(firmnessField('指示位置数值'), '69.4'); await flush();
  expect(texts).toContain('6.5'); expect(texts).toContain('舒软');
  await click('[aria-label="撤销"]'); expect(firmnessField('指示位置数值').value).toBe('50');
  await click('[aria-label="重做"]'); expect(firmnessField('指示位置数值').value).toBe('69.4');
  await act(async () => firmnessToggle().click()); await flush();
  expect(texts).not.toContain('舒软');
  const saved = savedDraft(); expect(SINGLE_TEMPLATE_RULES['sofa-single'].restoreOptions(saved).sofaFirmness).toEqual({ enabled: false, value: '6.5', label: '舒软', position: 69.4 });
  await reopen(saved); expect(firmnessToggle().checked).toBe(false);
  await act(async () => firmnessToggle().click()); expect(firmnessField('坐感数值').value).toBe('6.5');
  expect(firmnessField('坐感说明').value).toBe('舒软'); expect(firmnessField('指示位置数值').value).toBe('69.4');
  await click('.header-export'); expect(downloads).toHaveLength(1); expect(window.alert).not.toHaveBeenCalled();
});

it('坐感数值缺失、越界或说明超长会阻止导出，关闭开关恢复原图导出', async () => {
  await render(fixture('sofa-single')); await act(async () => firmnessToggle().click());
  await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(firmnessField('坐感数值'), '11'); await fill(firmnessField('坐感说明'), '舒软');
  await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(firmnessField('坐感数值'), '6.5'); await fill(firmnessField('坐感说明'), '测试说明不允许丢掉任何文字');
  await click('.header-export'); expect(downloads).toHaveLength(0);
  await act(async () => firmnessToggle().click()); await click('.header-export'); expect(downloads).toHaveLength(1);
});
