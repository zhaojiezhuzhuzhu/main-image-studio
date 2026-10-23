// @vitest-environment jsdom
import { completionFixture, completionIds } from './TemplateCompletion.fixtures';
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

let container: HTMLDivElement, root: Root, texts: string[], downloads: string[];
let labels: Array<{ text: string; x: number; y: number }> = [];
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); texts = []; downloads = [];
  SVGElement.prototype.setPointerCapture = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const stack: string[][] = []; let dx = 0, dy = 0; const translations: number[][] = [];
  const context = { font: '', letterSpacing: '0px', fillStyle: '', strokeStyle: '', textAlign: '', textBaseline: '',
    fillRect() { texts.length = 0; labels = []; },
    measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 35) * .55, actualBoundingBoxAscent: 30, actualBoundingBoxDescent: 8 }; },
    fillText(value: string, x: number, y: number) { texts.push(value); labels.push({ text: value, x: dx + x, y: dy + y }); }, beginPath() {}, roundRect() {}, fill() {}, stroke() {},
    save() { translations.push([dx, dy]); stack.push([this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline]); },
    restore() { [dx, dy] = translations.pop() ?? [0, 0]; const state = stack.pop(); if (state) [this.font, this.fillStyle, this.strokeStyle, this.textAlign, this.textBaseline] = state; },
    translate(x: number, y: number) { dx += x; dy += y; }, rotate() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, closePath() {}, clip() {}, drawImage() {}, setLineDash() {}, bezierCurveTo() {} };
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
async function selectOption(name: string, value: string) {
  const input = container.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!;
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}

it.each(completionIds)('%s 保存重开、编辑尺寸与导出流程完整', async (id) => {
  const draft = completionFixture(id); await render(draft); await flush();
  await click('.header-export'); expect(downloads).toHaveLength(1); expect(window.alert).not.toHaveBeenCalled();
  const model = container.querySelector<HTMLInputElement | HTMLTextAreaElement>('.canvas-model-editor')!;
  await fill(model, 'TEST修改完整规格'); await flush();
  await click('[aria-label="撤销"]'); expect(container.querySelector<HTMLInputElement>('.canvas-model-editor')!.value).toBe(draft.model);
  await click('[aria-label="重做"]'); await flush(); expect(savedDraft().model).toBe('TEST修改完整规格');
  await reopen(savedDraft()); expect(container.querySelector<HTMLInputElement>('.canvas-model-editor')!.value).toBe('TEST修改完整规格');
  await click('.header-export'); expect(downloads).toHaveLength(2);
  const missing = { ...draft, annotations: draft.annotations.slice(1) }; await reopen(missing); await click('.header-export');
  expect(downloads).toHaveLength(2); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('完成'));
});
it('柜类双图缺开门素材、妆台缺副柜高度均不能导出', async () => {
  const draft = completionFixture('wardrobe-combination'); await render({ ...draft, accessories: [] }); await click('.header-export');
  expect(downloads).toHaveLength(0); expect(window.alert).toHaveBeenLastCalledWith(expect.stringContaining('正面储物打开'));
  const vanity = completionFixture('vanity-dresser-single'); await reopen({ ...vanity, dimensionFields: { ...vanity.dimensionFields, secondaryHeight: '' } });
  await click('.header-export'); expect(downloads).toHaveLength(0);
});
it('长组合型号可在画布内换行，副柜高度有独立标注按钮', async () => {
  const draft = completionFixture('wood-desk-multi-combination'); await render(draft);
  const editor = container.querySelector<HTMLTextAreaElement>('textarea.canvas-model-editor')!; expect(editor).not.toBeNull();
  await fill(editor, 'TEST书桌与书桌副柜\n+TEST边柜与椅子'); await flush();
  expect(texts).toContain('TEST书桌与书桌副柜'); expect(texts).toContain('+TEST边柜与椅子');
  expect(savedDraft().model).toBe('TEST书桌与书桌副柜\n+TEST边柜与椅子'); expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(0);
  await reopen({ ...draft, annotations: draft.annotations.filter((a) => a.kind !== 'secondaryHeight') });
  expect([...container.querySelectorAll('button')].some((button) => button.textContent === '标注副柜高')).toBe(true);
});
it('床头柜换图后尺寸固定，缩放和独立改线可保存重开，不影响床体', async () => {
  await render(completionFixture('wood-bed-combination'));
  const dimensions = () => labels.filter((item) => item.text.endsWith('cm')).map((item) => ({ ...item }));
  const before = dimensions();
  const expectFixed = () => dimensions().forEach((item, i) => { expect(item.text).toBe(before[i].text); expect(item.x).toBeCloseTo(before[i].x, 5); expect(item.y).toBeCloseTo(before[i].y, 5); });
  const upload = container.querySelector<HTMLInputElement>('[aria-label="上传搭配床头柜 PNG"]')!;
  Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['replacement'], 'detail-new.png', { type: 'image/png' })] });
  await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
  expectFixed();
  const fixedButton = [...container.querySelectorAll('button')].find((item) => item.textContent === '尺寸线固定')!;
  expect(fixedButton.getAttribute('aria-pressed')).toBe('true');
  const scale = [...container.querySelectorAll('.accessory-inspector label')].find((item) => item.textContent?.startsWith('缩放比例'))?.querySelector('input')
    ?? [...container.querySelectorAll('.contextual-inspector label')].find((item) => item.textContent?.startsWith('缩放比例'))!.querySelector('input')!;
  await fill(scale, '50'); expectFixed(); await flush();
  const saved = savedDraft();
  expect(saved.accessories?.find((item) => item.id === 'wood-bed-set-cabinet')?.adjustment.dimensionFrame).toBeDefined();
  await reopen(saved); expectFixed();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  const label = labels.find((item) => item.text === '44.4cm')!;
  await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  await act(async () => container.querySelector('.canvas-dimension-input input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await act(async () => container.querySelector('[aria-label="长标注起点"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })));
  await flush();
  expect(savedDraft().accessories).toEqual(saved.accessories);
  expect(savedDraft().annotations).toEqual(saved.annotations);
});

it('床头柜数值、端点、辅助线可独立修改撤销和恢复，不改床体标注', async () => {
  const draft = completionFixture('wood-bed-combination'); await render(draft);
  const label = labels.find((item) => item.text === '44.4cm')!; expect(label).toBeDefined();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  const value = container.querySelector<HTMLInputElement>('.canvas-dimension-input input')!; expect(value).not.toBeNull();
  await fill(value, '45.7'); await act(async () => value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await flush(); expect(savedDraft().dimensionFields).toEqual(draft.dimensionFields);
  expect(SINGLE_TEMPLATE_RULES['wood-bed-combination'].restoreOptions(savedDraft()).woodBedCombination!.cabinetDimensions.length).toBe('45.7');
  const handle = container.querySelector<HTMLButtonElement>('[aria-label="长标注起点"]')!; expect(handle).not.toBeNull();
  await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))); await flush();
  const first = SINGLE_TEMPLATE_RULES['wood-bed-combination'].restoreOptions(savedDraft()).woodBedCombination!.cabinetDimensions.annotations![0];
  expect(first.from.y).not.toBe(-.12);
  const toggle = [...container.querySelectorAll('button')].find((button) => button.textContent === '辅助线')!; await act(async () => toggle.click());
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="长辅助线起点"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))); await flush();
  const changed = savedDraft(), options = SINGLE_TEMPLATE_RULES['wood-bed-combination'].restoreOptions(changed);
  expect(options.woodBedCombination!.cabinetDimensions.annotations![0].extensionOffsets?.from).toBeDefined();
  expect(changed.annotations).toEqual(draft.annotations);
  await click('[aria-label="撤销"]'); await flush(); expect(SINGLE_TEMPLATE_RULES['wood-bed-combination'].restoreOptions(savedDraft()).woodBedCombination!.cabinetDimensions.annotations![0].extensionOffsets).toBeUndefined();
  await click('[aria-label="重做"]'); await flush(); await selectOption('搭配形式', 'mattress'); await flush(); await reopen(savedDraft());
  await selectOption('搭配形式', 'both'); await flush();
  expect(SINGLE_TEMPLATE_RULES['wood-bed-combination'].restoreOptions(savedDraft()).woodBedCombination!.cabinetDimensions).toEqual(options.woodBedCombination!.cabinetDimensions);
  await click('.header-export'); expect(downloads).toHaveLength(1);
});

it('配件尺寸文字位置和颜色独立保存，不带动配件和床体，重开后点击才显示控件', async () => {
  const draft = completionFixture('wood-bed-combination'); await render(draft);
  const label = { ...labels.find((item) => item.text === '44.4cm')! };
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  await act(async () => container.querySelector('.canvas-dimension-input input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await click('.dimension-label-move-toggle');
  const handle = container.querySelector('.dimension-label-drag')!;
  (handle as HTMLElement).setPointerCapture = vi.fn();
  for (const [type, dx, dy] of [['pointerdown', 0, 0], ['pointermove', 20, 15], ['pointerup', 20, 15]] as const) {
    await act(async () => handle.dispatchEvent(new MouseEvent(type, { clientX: label.x + dx, clientY: label.y + dy, bubbles: true })));
  }
  await click('.dimension-label-colors button:last-child'); await flush();
  const saved = savedDraft(), rules = SINGLE_TEMPLATE_RULES['wood-bed-combination'];
  const changed = rules.restoreOptions(saved).woodBedCombination!.cabinetDimensions.annotations![0];
  expect(changed).toMatchObject({ labelOffset: { x: 20, y: 15 }, labelColor: 'white', value: 44.4 });
  expect(saved.annotations).toEqual(draft.annotations); expect(saved.accessories).toEqual(draft.accessories);
  const moved = labels.find((item) => item.text === '44.4cm')!;
  expect(moved.x).toBeCloseTo(label.x + 20); expect(moved.y).toBeCloseTo(label.y + 15);
  await click('.dimension-label-move-toggle');
  await act(async () => container.querySelector('[aria-label="长标注起点"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
  await flush();
  const afterLine = savedDraft(), movedLine = rules.restoreOptions(afterLine).woodBedCombination!.cabinetDimensions.annotations![0];
  expect(movedLine.from).not.toEqual(changed.from);
  const fixed = labels.find((item) => item.text === '44.4cm')!;
  expect(fixed.x).toBeCloseTo(moved.x, 5); expect(fixed.y).toBeCloseTo(moved.y, 5);
  expect(afterLine.annotations).toEqual(draft.annotations);
  await reopen(afterLine); await flush();
  expect(container.querySelector('.dimension-label-controls')).toBeNull();
  expect(rules.restoreOptions(savedDraft()).woodBedCombination!.cabinetDimensions.annotations![0]).toEqual(movedLine);
  const reopened = labels.find((item) => item.text === '44.4cm')!;
  expect(reopened.x).toBeCloseTo(moved.x, 5); expect(reopened.y).toBeCloseTo(moved.y, 5);
  await click('.header-export'); expect(downloads).toHaveLength(1);
});

it('配件高亮线整体拖动只修改配件标注，保存恢复后两端位移一致', async () => {
  const draft = completionFixture('wood-bed-combination'); await render(draft);
  const label = labels.find((item) => item.text === '44.4cm')!;
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1440, height: 1440 } as DOMRect);
  await act(async () => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown', { clientX: label.x, clientY: label.y, bubbles: true })));
  await act(async () => container.querySelector('.canvas-dimension-input input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  const line = container.querySelector<SVGLineElement>('.dimension-line-drag')!;
  const beforeY = [Number(line.getAttribute('y1')), Number(line.getAttribute('y2'))];
  const x = (Number(line.getAttribute('x1')) + Number(line.getAttribute('x2'))) / 2;
  const y = (Number(line.getAttribute('y1')) + Number(line.getAttribute('y2'))) / 2;
  for (const [type, dy] of [['pointerdown', 0], ['pointermove', 8], ['pointerup', 8]] as const) {
    await act(async () => line.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y + dy, bubbles: true })));
  }
  expect(Number(line.getAttribute('y1'))).toBeCloseTo(beforeY[0] + 8, 5);
  expect(Number(line.getAttribute('y2'))).toBeCloseTo(beforeY[1] + 8, 5);
  await flush();
  const saved = savedDraft();
  const rules = SINGLE_TEMPLATE_RULES['wood-bed-combination'];
  const after = rules.restoreOptions(saved).woodBedCombination!.cabinetDimensions.annotations![0];
  expect(after.value).toBe(44.4);
  expect(saved.annotations).toEqual(draft.annotations);
  expect(saved.dimensionFields).toEqual(draft.dimensionFields);
  await reopen(saved); await flush();
  expect(rules.restoreOptions(savedDraft()).woodBedCombination!.cabinetDimensions.annotations![0]).toEqual(after);
});
