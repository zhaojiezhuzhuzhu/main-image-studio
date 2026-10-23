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

const ids = ['study-chair-single'] as const;
function fixture(id: SingleTemplateId): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id], key = 'studyChairDetails';
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
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as SingleTemplateId} initialProject={{ projectId: 'batch10-test', fileName: 'TEST.skuwork', draft }} onBack={() => undefined}/>));
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

function mattressFixture(): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES['mattress-single'], options = rules.createOptions();
  options.mattressSingle = { headline: '测试床垫', subtitle: '测试说明', firmnessValue: '2.1', firmnessPosition: 30, materials: Array.from({ length: 3 }, () => ({ text: '测试材质', textColor: 'white' })) };
  const image = { name: 'TEST-mattress.png', blob: new Blob(['TEST'], { type: 'image/png' }) };
  return { version: 1, templateId: 'mattress-single', model: 'TEST10', modelManuallyEdited: true, sellingPoints: [], sizeInput: '27', dimensionFields: { length: '', width: '', height: '27' },
    annotations: [{ kind: 'height', label: '高', value: 27, from: { x: 1.03, y: .65 }, to: { x: 1.03, y: 1 } }], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 },
    image, ...rules.saveOptions(options), accessories: rules.accessories!(options, rules.layout([], options)).map((slot) => ({ id: slot.id, image, adjustment: { scale: 1, offsetX: 0, offsetY: 0 } })) };
}
const mattressField = (name: string) => [...container.querySelectorAll('label')].find((label) => label.textContent?.startsWith(name))!.querySelector<HTMLInputElement>('input')!;
it('床垫独立数值、位置和标题进入撤销重做及重开，型号编辑采用指定字距', async () => {
  await render(mattressFixture());
  expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(0);
  expect(container.querySelector<HTMLInputElement>('.canvas-model-editor')!.style.letterSpacing).toBe('-0.078125cqw');
  await fill(mattressField('床垫标题'), '修改标题'); await flush();
  await click('[aria-label="撤销"]'); expect(mattressField('床垫标题').value).toBe('测试床垫');
  await click('[aria-label="重做"]'); expect(mattressField('床垫标题').value).toBe('修改标题');
  await fill(mattressField('床垫软硬度数值'), '8'); await flush();
  expect(mattressField('床垫指示位置数值').value).toBe('30');
  await click('.header-export'); expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('60%–80%'));
  await fill(mattressField('床垫指示位置数值'), '75'); await flush();
  await reopen(savedDraft()); expect(mattressField('床垫标题').value).toBe('修改标题'); expect(mattressField('床垫软硬度数值').value).toBe('8'); expect(mattressField('床垫指示位置数值').value).toBe('75');
  expect(texts).toContain('偏软'); expect(texts).toContain('27cm');
  await click('.header-export'); expect(downloads).toEqual(['TEST10-床垫单面睡-SKU.jpg']);
});
it('床垫缺材质图、非法厚度和超长单行文案均阻止导出', async () => {
  const draft = mattressFixture(); draft.accessories!.pop();
  await render(draft); await click('.header-export'); expect(downloads).toHaveLength(0);
  expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('请上传材质卖点3'));
  await reopen(mattressFixture());
  await fill(mattressField('快速尺寸'), '200×180×27'); await click('.header-export'); expect(downloads).toHaveLength(0);
  await fill(mattressField('快速尺寸'), '27'); await fill(mattressField('材质卖点1文案'), '完整材质说明'.repeat(30)); await flush();
  await click('.header-export'); expect(downloads).toHaveLength(0); expect(mattressField('材质卖点1文案').value).toBe('完整材质说明'.repeat(30));
  await fill(mattressField('材质卖点1文案'), '实际材质'); await click('.header-export'); expect(downloads).toHaveLength(1);
});
