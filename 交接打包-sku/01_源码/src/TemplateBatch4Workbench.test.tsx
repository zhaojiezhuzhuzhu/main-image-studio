// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './SingleWorkbench';
import { SINGLE_TEMPLATE_RULES } from './templates/registry';
import { saveDraft, type WorkbenchDraft } from './storage/draftStorage';
import { defaultFunctionalCurve, functionalCurveGeometry } from './domain/functionalSofaCurve';

vi.mock('./storage/draftStorage', async (original) => ({ ...await original<typeof import('./storage/draftStorage')>(), loadDraft: async () => null, loadRecoveryHistory: async () => [], saveDraft: vi.fn(async () => undefined) }));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', open: vi.fn(), save: vi.fn(), saveAs: vi.fn() }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 700, height: 650 } }) }));

const ids = ['functional-sofa-single', 'bedside-cabinet-single'] as const;
type BatchId = typeof ids[number];
function fixture(id: BatchId): WorkbenchDraft {
  const rules = SINGLE_TEMPLATE_RULES[id];
  const fields = rules.parseQuickDimensions(id === 'functional-sofa-single' ? '92×105~162×98~77' : '50×45×55')!;
  return { version: 1, templateId: id, model: 'TEST手动名称', modelManuallyEdited: true,
    sellingPoints: ['测试卖点一', '测试卖点二', '测试卖点三'], sizeInput: rules.formatFields(fields), dimensionFields: fields,
    ...rules.saveOptions(rules.createOptions()),
    annotations: rules.dimensionKinds.map((kind, index) => ({ kind, label: kind === 'length' ? '长' : kind === 'width' ? '宽' : '高',
      value: Number((fields[kind] ?? '').split('~')[0]), from: { x: index === 2 ? -.1 : 0, y: index === 2 ? 0 : -.1 - index * .15 },
      to: { x: index === 2 ? -.1 : 1, y: index === 2 ? 1 : -.1 - index * .15 } })),
    subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 }, image: { name: 'TEST-fixture.png', blob: new Blob(['fixture']) } };
}

let root: Root, container: HTMLDivElement;
let text: string[], downloads: string[];
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); text = []; downloads = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const context = { font: '', fillRect() { text.length = 0; },
    measureText(value: string) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] ?? 45) * .55, actualBoundingBoxAscent: 34, actualBoundingBoxDescent: 10 }; },
    fillText(value: string) { text.push(value); }, beginPath() {}, roundRect() {}, arc() {}, ellipse() {}, bezierCurveTo() {}, quadraticCurveTo() {}, setLineDash() {},
    fill() {}, stroke() {}, save() {}, restore() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage() {} };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { downloads.push(this.download); });
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const render = async (draft: WorkbenchDraft) => act(async () => root.render(<SingleWorkbench templateId={draft.templateId as BatchId} initialProject={{ projectId: 'batch4-test', fileName: 'test.skuwork', draft }} onBack={() => undefined}/>));
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(500); });
const click = async (selector: string) => act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
async function fill(input: HTMLInputElement, value: string) {
  expect(input).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

it('床头柜数量切换即时绘制独立徽标，撤销、重做和重开保留数量及手动名称', async () => {
  await render(fixture('bedside-cabinet-single'));
  expect(text).not.toContain('x2');
  const select = [...container.querySelectorAll('select')].find((item) => [...item.options].some((option) => option.value === '1'))!;
  await act(async () => { select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })); }); await flush();
  expect(text).toContain('x2');
  const saved = vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
  expect(saved.model).toBe('TEST手动名称');
  expect(SINGLE_TEMPLATE_RULES['bedside-cabinet-single'].restoreOptions(saved).quantity).toBe(2);
  await click('[aria-label="撤销"]'); expect(text).not.toContain('x2');
  await click('[aria-label="重做"]'); expect(text).toContain('x2');
  await act(async () => root.unmount()); root = createRoot(container); await render(saved);
  expect(text).toContain('x2'); expect(text).toContain('TEST手动名称');
  await click('.header-export');
  expect(downloads[0]).toContain('x2');
  expect(window.alert).not.toHaveBeenCalled();
});

it('功能标注真实文案进入绘图、撤销、草稿和重开，开启但缺少文案时拦截导出', async () => {
  const rules = SINGLE_TEMPLATE_RULES['functional-sofa-single'];
  const options = rules.createOptions();
  const original = { ...fixture('functional-sofa-single'), ...rules.saveOptions({ ...options,
    rocking: { ...options.rocking!, enabled: true, text: '测试摇动' }, rotation: { ...options.rotation!, enabled: true, text: '测试旋转' } }) };
  await render(original);
  expect(text).toContain('测试摇动'); expect(text).toContain('测试旋转');
  const input = [...container.querySelectorAll('input')].find((item) => item.value === '测试摇动')!;
  await fill(input, '更新测试摇动'); await flush();
  expect(text).toContain('更新测试摇动');
  const saved = vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft;
  expect(rules.restoreOptions(saved).rocking!.text).toBe('更新测试摇动');
  await click('[aria-label="撤销"]'); expect(text).toContain('测试摇动');
  await click('[aria-label="重做"]'); expect(text).toContain('更新测试摇动');
  await act(async () => root.unmount()); root = createRoot(container); await render(saved);
  expect(text).toContain('更新测试摇动');
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads).toHaveLength(1);
  await fill([...container.querySelectorAll('input')].find((item) => item.value === '更新测试摇动')!, '');
  await click('.header-export'); expect(window.alert).toHaveBeenCalled(); expect(downloads).toHaveLength(1);
});

it.each(ids)('%s 使用独立制作要点，完整项目导出1440方图，缺失标注不能导出', async (id) => {
  const draft = fixture(id); await render(draft);
  const card = container.querySelector('.production-notes-card')!;
  expect(card.textContent).toContain(SINGLE_TEMPLATE_RULES[id].productionNotes.sourcePages);
  expect(container.querySelector('.canvas-panel-head')!.textContent).toContain('已有尺寸均已完成');
  await click('.header-export'); expect(window.alert).not.toHaveBeenCalled(); expect(downloads).toHaveLength(1);
  expect(container.querySelector('canvas')!.width).toBe(1440); expect(container.querySelector('canvas')!.height).toBe(1440);
  await act(async () => root.unmount()); root = createRoot(container); await render({ ...draft, annotations: [] });
  await click('.header-export'); expect(window.alert).toHaveBeenCalled(); expect(downloads).toHaveLength(1);
});

const curveRules = SINGLE_TEMPLATE_RULES['functional-sofa-single'];
function curveFixture() {
  const options = curveRules.createOptions();
  return { ...fixture('functional-sofa-single'), ...curveRules.saveOptions({ ...options,
    rocking: { ...options.rocking!, enabled: true, text: '60°旋转' }, rotation: { ...options.rotation!, enabled: true, text: '底部测试' } }) };
}
async function key(element: Element, key: string, shiftKey = false) {
  await act(async () => element.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true })));
}
async function pointer(element: Element, type: string, x: number, y: number) {
  await act(async () => {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true });
    Object.defineProperty(event, 'pointerId', { value: 1 }); element.dispatchEvent(event);
  });
}
function prepareDrag(displaySize: number) {
  const canvas = container.querySelector('canvas')!;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ x: 50, y: 100, left: 50, top: 100, width: displaySize, height: displaySize, right: 50 + displaySize, bottom: 100 + displaySize, toJSON() {} });
  for (const element of container.querySelectorAll('.functional-curve-hit, .functional-curve-handle')) {
    Object.defineProperty(element, 'setPointerCapture', { configurable: true, value: vi.fn() });
  }
}

it('画布文字单击编辑，Enter及点击外部确认，Esc和输入法回车不误提交', async () => {
  await render(curveFixture());
  prepareDrag(720);
  await click('[aria-label="编辑摇动功能说明"]');
  let input = container.querySelector<HTMLInputElement>('[aria-label="画布摇动功能说明"]')!;
  await fill(input, '90°旋转');
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
  expect(container.contains(input)).toBe(true);
  await key(input, 'Enter');
  expect(text).toContain('90°旋转');
  await click('[aria-label="撤销"]'); expect(text).toContain('60°旋转');
  await click('[aria-label="重做"]'); expect(text).toContain('90°旋转');
  await click('[aria-label="编辑摇动功能说明"]');
  input = container.querySelector<HTMLInputElement>('[aria-label="画布摇动功能说明"]')!;
  await fill(input, '取消文案'); await key(input, 'Escape');
  expect(text).toContain('90°旋转'); expect(text).not.toContain('取消文案');
  await click('[aria-label="编辑摇动功能说明"]');
  await fill(container.querySelector('[aria-label="画布摇动功能说明"]')!, '45°旋转');
  await pointer(container.querySelector('canvas')!, 'pointerdown', 0, 0);
  expect(text).toContain('45°旋转');
  expect(container.querySelector('.functional-curve-handle')).toBeNull();
  await flush();
  expect(curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking!.text).toBe('45°旋转');
});

it.each([360, 720])('画布显示宽度%s时两种曲线拖动弧度只在松开提交，撤销重做重开均保持形状', async (displaySize) => {
  await render(curveFixture()); await flush();
  for (const [kind, name] of [['rocking', '摇动'], ['rotation', '旋转']] as const) {
    const path = container.querySelector(`[aria-label="${name}曲线"]`)!;
    await key(path, 'Enter'); prepareDrag(displaySize);
    const handle = container.querySelector(`[aria-label="${name}曲线弧度"]`)!;
    const before = curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft)[kind]!;
    const geometry = functionalCurveGeometry(kind, before), curve = before.curve ?? defaultFunctionalCurve(kind);
    const x = 50 + geometry.handles.bend.x * displaySize / 1440, y = 100 + geometry.handles.bend.y * displaySize / 1440;
    await pointer(handle, 'pointerdown', x, y);
    await pointer(handle, 'pointermove', x, y - 20 * displaySize / 1440); await flush();
    expect(curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft)[kind]!.curve).toEqual(before.curve);
    expect(container.querySelector('.product-selection')).toBeNull();
    await pointer(handle, 'pointerup', x, y - 20 * displaySize / 1440); await flush();
    const saved = vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft, edited = curveRules.restoreOptions(saved)[kind]!.curve!;
    const dx = curve.to.x - curve.from.x, dy = curve.to.y - curve.from.y;
    expect(edited.from).toEqual(curve.from); expect(edited.to).toEqual(curve.to);
    expect(edited.bend.x).toBeCloseTo(curve.bend.x + 20 * dx * dy / (dx * dx + dy * dy));
    expect(edited.bend.y).toBeCloseTo(curve.bend.y - 20 * dx * dx / (dx * dx + dy * dy));
    await click('[aria-label="撤销"]'); await flush();
    expect(curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft)[kind]!.curve).toEqual(before.curve);
    await click('[aria-label="重做"]'); await flush();
    expect(curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft)[kind]!.curve).toEqual(edited);
    await act(async () => root.unmount()); root = createRoot(container); await render(saved);
    await click('.header-export'); expect(window.alert).not.toHaveBeenCalled();
  }
});

it('端点键盘微调、曲线整体移动、取消拖动和恢复默认形状保持文字及另一端', async () => {
  await render(curveFixture()); await flush();
  let path = container.querySelector('[aria-label="摇动曲线"]')!;
  await key(path, 'Enter');
  await key(container.querySelector('[aria-label="摇动曲线起点"]')!, 'ArrowRight', true); await flush();
  let feature = curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking!;
  expect(feature.curve!.from.x).toBe(18); expect(feature.curve!.to).toEqual(defaultFunctionalCurve('rocking').to);
  const { from, to, bend } = feature.curve!;
  expect(Math.hypot(bend.x - from.x, bend.y - from.y)).toBeCloseTo(Math.hypot(bend.x - to.x, bend.y - to.y));
  await key(path, 'ArrowDown'); await flush();
  feature = curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking!;
  expect(feature.y).toBe(436); expect(feature.text).toBe('60°旋转');
  for (const cancel of ['pointercancel', 'lostpointercapture', 'Escape', 'blur']) {
    path = container.querySelector('[aria-label="摇动曲线"]')!;
    await key(path, 'Enter'); prepareDrag(720);
    await pointer(path, 'pointerdown', 500, 350); await pointer(path, 'pointermove', 520, 370);
    if (cancel === 'Escape') await key(path, 'Escape');
    else if (cancel === 'blur') await act(async () => window.dispatchEvent(new Event('blur')));
    else await pointer(path, cancel, 520, 370);
    await flush();
    expect(curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking).toEqual(feature);
  }
  const reset = [...container.querySelectorAll('button')].find((button) => button.textContent === '恢复摇动默认形状')!;
  await act(async () => reset.click()); await flush();
  const resetFeature = curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking!;
  expect(resetFeature).toEqual({ ...feature, curve: undefined });
});

it.each([['rocking', '摇动'], ['rotation', '旋转']] as const)('%s 拖动端点和侧栏改坐标均自动居中，预览不保存，撤销恢复三点', async (kind, name) => {
  await render(curveFixture()); await flush();
  await key(container.querySelector(`[aria-label="${name}曲线"]`)!, 'Enter'); prepareDrag(720);
  const original = defaultFunctionalCurve(kind), endpoint = container.querySelector(`[aria-label="${name}曲线终点"]`)!;
  const midpoint = container.querySelector<HTMLElement>(`[aria-label="${name}曲线弧度"]`)!;
  const oldPosition = midpoint.style.cssText;
  await pointer(endpoint, 'pointerdown', 400, 400); await pointer(endpoint, 'pointermove', 435, 430); await flush();
  expect(midpoint.style.cssText).not.toBe(oldPosition);
  const savedFeature = () => curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft)[kind]!;
  expect(savedFeature().curve).toBeUndefined();
  await pointer(endpoint, 'pointerup', 435, 430); await flush();
  const curve = savedFeature().curve!;
  expect(curve.from).toEqual(original.from); expect(curve.to).toEqual({ x: original.to.x + 70, y: original.to.y + 60 });
  const checkCentered = () => {
    const { from, to, bend } = savedFeature().curve!;
    expect(Math.hypot(bend.x - from.x, bend.y - from.y)).toBeCloseTo(Math.hypot(bend.x - to.x, bend.y - to.y));
  };
  checkCentered();
  const coordinate = [...container.querySelectorAll('label')].find((label) => label.textContent === `${name}起点横坐标`)!.querySelector('input')!;
  await fill(coordinate, String(savedFeature().x + original.from.x - 40)); await flush();
  expect(savedFeature().curve!.from.x).toBe(original.from.x - 40); checkCentered();
  await click('[aria-label="撤销"]'); await flush(); expect(savedFeature().curve).toEqual(curve);
  await click('[aria-label="撤销"]'); await flush(); expect(savedFeature().curve).toBeUndefined();
});

it('输入文字后直接拖动曲线，确认的新文案不会被拖动开始时的旧值覆盖', async () => {
  await render(curveFixture());
  await click('[aria-label="编辑摇动功能说明"]');
  await fill(container.querySelector('[aria-label="画布摇动功能说明"]')!, '120°旋转');
  prepareDrag(720);
  const path = container.querySelector('[aria-label="摇动曲线"]')!;
  await pointer(path, 'pointerdown', 500, 350);
  await pointer(path, 'pointermove', 510, 355);
  await pointer(path, 'pointerup', 510, 355); await flush();
  const feature = curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking!;
  expect(feature).toMatchObject({ text: '120°旋转', x: 875, y: 445 });
  expect(text).toContain('120°旋转');
  await click('[aria-label="撤销"]'); await flush();
  expect(text).toContain('120°旋转');
  expect(curveRules.restoreOptions(vi.mocked(saveDraft).mock.lastCall![0] as unknown as WorkbenchDraft).rocking!.x).toBe(855);
});
