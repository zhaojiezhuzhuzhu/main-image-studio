// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SofaCombinationWorkbench } from './SofaCombinationWorkbench';
import { saveDraft, type SofaCombinationDraft } from './storage/draftStorage';
import type { SofaBedCombinationDraft } from './domain/sofaBedCombinationLayout';
import type { DimensionAnnotation } from './domain/dimensionAnnotations';

vi.mock('./storage/draftStorage', async (importOriginal) => ({
  ...await importOriginal<typeof import('./storage/draftStorage')>(),
  loadDraft: vi.fn(async () => null), loadRecoveryHistory: vi.fn(async () => []), saveDraft: vi.fn(async () => undefined),
}));
vi.mock('./project/useProjectFile', () => ({ useProjectFile: () => ({ status: '已保存', flush: vi.fn(), open: vi.fn(), save: vi.fn(), saveAs: vi.fn() }) }));
vi.mock('./project/useCanvasFonts', () => ({ useCanvasFonts: () => ({ status: 'ready', issue: '' }) }));
vi.mock('./project/productImage', () => ({ productImageFromBlob: async (blob: Blob, name: string) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 600, height: 300 }, silhouette: [{ left: 0, right: 1, top: 0, bottom: 1 }] }) }));

const adjustment = { scale: 1, offsetX: 0, offsetY: 0 };
const fields = { length: '240', width: '88', height: '100' };
const annotations: DimensionAnnotation[] = [
  { kind: 'length', label: '长', value: 240, from: { x: 0, y: -.1 }, to: { x: 1, y: -.1 } },
  { kind: 'width', label: '宽', value: 88, from: { x: 0, y: 1.1 }, to: { x: .4, y: 1.25 } },
  { kind: 'height', label: '高', value: 100, from: { x: -.1, y: 0 }, to: { x: -.1, y: 1 } },
];
const image = { name: 'TEST.png', blob: new Blob(['test'], { type: 'image/png' }) };
const combination: SofaCombinationDraft = { version: 1, kind: 'standard', model: 'TEST', modelManuallyEdited: true, sizeInput: '240×88×100', dimensionFields: fields, annotations, subjectAdjustment: adjustment, mainImage: image,
  optionalSizes: [{ id: 'spec-one', sizeInput: '210×80×90', dimensionFields: { length: '210', width: '80', height: '90' }, annotations: annotations.map((annotation, index) => ({ ...annotation, value: [210, 80, 90][index] })), adjustment, image }], optionalLabelEnabled: true, optionalLabelOffsetY: 0, optionalLabelSide: 'left', noteEnabled: true, note: '测试备注' };

let container: HTMLDivElement, root: Root;
type Paint = { kind: 'stroke' | 'fill'; color: string };
const contexts = new Map<HTMLCanvasElement, { text: Array<{ text: string; x: number; y: number }>; products: number[][]; paint: Paint[]; context: CanvasRenderingContext2D }>();

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1440, bottom: 1440, width: 1440, height: 1440, toJSON: () => ({}) });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    this.setPointerCapture = vi.fn();
    if (!contexts.has(this)) {
      const text: Array<{ text: string; x: number; y: number }> = [];
      const products: number[][] = [];
      const paint: Paint[] = [];
      const context = { fillRect: () => { text.length = 0; products.length = 0; paint.length = 0; }, fillText: (value: string, x: number, y: number) => text.push({ text: value, x, y }), measureText: (value: string) => ({ width: value.length * 24, actualBoundingBoxAscent: 36, actualBoundingBoxDescent: 10 }),
        bezierCurveTo() {}, beginPath() {}, roundRect() {}, fill() { paint.push({ kind: 'fill', color: String(context.fillStyle) }); }, stroke() { paint.push({ kind: 'stroke', color: String(context.strokeStyle) }); }, save() {}, restore() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage(...args: unknown[]) { if (args.length === 9) products.push(args.slice(5) as number[]); if (args[0] instanceof HTMLCanvasElement) paint.push(...contexts.get(args[0])!.paint); }, setLineDash() {},
      } as unknown as CanvasRenderingContext2D;
      contexts.set(this, { text, products, paint, context });
    }
    return contexts.get(this)!.context;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  vi.spyOn(window, 'alert').mockImplementation(() => undefined);
});

afterEach(async () => {
  await act(async () => root.unmount()); container.remove(); contexts.clear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks();
});

async function clickDimension(text: string) {
  const canvas = container.querySelector('canvas')!;
  const label = contexts.get(canvas)!.text.find((item) => item.text === text)!;
  expect(label).toBeDefined();
  await clickCanvas(label.x, label.y);
}
async function clickCanvas(x: number, y: number) {
  const canvas = container.querySelector('canvas')!;
  await act(async () => {
    const pointer = new MouseEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, cancelable: true });
    canvas.dispatchEvent(pointer);
    const hitLabel = contexts.get(canvas)!.text.some((item) => item.text.endsWith('cm') && item.x === x && item.y === y);
    if (hitLabel && !container.textContent?.includes('取消本次标注')) expect(pointer.defaultPrevented).toBe(true);
    canvas.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
  });
}
async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const exportButton = () => container.querySelector<HTMLButtonElement>('.header-export')!;

const bedDraft: SofaBedCombinationDraft = { ...combination, templateId: 'sofa-bed-combination', sofaBedSellingPoints: ['亲肤面料', '舒适坐感', '灵活展开'] };
const button = (text: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((item) => item.textContent === text)!;
async function mount(draft = bedDraft) {
  await act(async () => root.render(<SofaCombinationWorkbench templateId="sofa-bed-combination" onBack={() => undefined} initialProject={{ projectId: 'bed-test', fileName: 'bed-test.skuwork', draft }}/>));
}
async function settle() { await act(async () => { await vi.advanceTimersByTimeAsync(500); }); }
function lastDraft() { return vi.mocked(saveDraft).mock.calls.at(-1)![0] as SofaBedCombinationDraft; }

it.each(['main', 'spec-one'])('组合 %s 的辅助线独立保存，并保持产品和主线位置', async (owner) => {
  await mount();
  await clickDimension(owner === 'main' ? '240cm' : '210cm');
  await act(async () => container.querySelector('.canvas-dimension-input input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await act(async () => button('辅助线').click());
  const handle = container.querySelector<HTMLButtonElement>('[aria-label="长辅助线起点"]')!;
  const x = parseFloat(handle.style.left) * 14.4, y = parseFloat(handle.style.top) * 14.4;
  const before = contexts.get(container.querySelector('canvas')!)!.products.map((rect) => [...rect]);
  for (const [type, dy] of [['pointerdown', 0], ['pointermove', 30], ['pointerup', 30]] as const) {
    await act(async () => handle.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y + dy, bubbles: true })));
  }
  await settle();
  const changed = owner === 'main' ? lastDraft().annotations : lastDraft().optionalSizes[0].annotations;
  const untouched = owner === 'main' ? lastDraft().optionalSizes[0].annotations : lastDraft().annotations;
  expect(changed[0].extensionOffsets!.from).toBeGreaterThan(0);
  expect(untouched[0].extensionOffsets).toBeUndefined();
  const after = contexts.get(container.querySelector('canvas')!)!.products;
  before.forEach((rect, index) => rect.forEach((value, axis) => expect(after[index][axis]).toBeCloseTo(value, 4)));
  expect(changed[0].from.x).toBeCloseTo(annotations[0].from.x);
  expect(changed[0].to.x).toBeCloseTo(annotations[0].to.x);
  await act(async () => exportButton().click()); expect(window.alert).not.toHaveBeenCalled();
});

describe('沙发床专属编辑行为', () => {
  it('右列规格和固定标签忽略旧偏移，不出现普通沙发类型选择', async () => {
    await mount({ ...bedDraft, optionalLabelOffsetY: 300, optionalLabelSide: 'left' });
    const canvas = container.querySelector('canvas')!;
    const label = contexts.get(canvas)!.text.find((item) => item.text === '其他可选尺寸')!;
    expect(label).toEqual({ text: '其他可选尺寸', x: 1240, y: 406 });
    expect(container.textContent).toContain('沙发床组合 SKU');
    expect(container.textContent).not.toContain('普通沙发');
    await clickCanvas(label.x, label.y);
    expect(container.querySelector('.label-selection')).toBeNull();
    await settle();
    expect(lastDraft().optionalLabelOffsetY).toBe(0);
    expect(lastDraft().optionalLabelSide).toBe('right');
    const products = contexts.get(canvas)!.products;
    expect(products[0][0] + products[0][2]).toBeLessThanOrEqual(1060);
    expect(products[1][0]).toBeGreaterThanOrEqual(1110);
  });

  it('卖点文字和数量进入撤销、草稿与画布，切换规格不会丢失卖点', async () => {
    await mount({ ...bedDraft, optionalSizes: [], sofaBedSellingPoints: ['亲肤面料', '舒适坐感'] });
    expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(2);
    const editor = container.querySelector<HTMLInputElement>('[aria-label="画布卖点 1"]')!;
    await fill(editor, '可展开床体');
    await settle();
    expect(lastDraft().sofaBedSellingPoints).toEqual(['可展开床体', '舒适坐感']);
    expect(lastDraft().templateId).toBe('sofa-bed-combination');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(editor.value).toBe('亲肤面料');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    expect(editor.value).toBe('可展开床体');
    const selector = container.querySelector('select')!;
    await act(async () => { selector.value = '3'; selector.dispatchEvent(new Event('change', { bubbles: true })); });
    await settle();
    expect(lastDraft().sofaBedSellingPoints).toEqual(['可展开床体', '舒适坐感', '']);
    await act(async () => button('＋ 添加').click());
    expect(container.querySelector('.canvas-selling-editor')).toBeNull();
    await settle();
    await act(async () => button('删除').click());
    expect(container.querySelectorAll('.canvas-selling-editor')).toHaveLength(3);
    expect(container.querySelector<HTMLInputElement>('[aria-label="画布卖点 1"]')!.value).toBe('可展开床体');
  });

  it('单 SKU 导出包含已恢复卖点，不要求其他规格；空卖点禁止导出', async () => {
    await mount({ ...bedDraft, optionalSizes: [], sofaBedSellingPoints: ['亲肤面料', '舒适坐感'] });
    expect(container.querySelector('.canvas-note-editor')).toBeNull();
    await act(async () => exportButton().click());
    expect(window.alert).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledOnce();
    const canvas = container.querySelector('canvas')!;
    expect(contexts.get(canvas)!.text.some((item) => item.text === '舒适坐感')).toBe(true);
    await fill(container.querySelector<HTMLInputElement>('[aria-label="画布卖点 1"]')!, '');
    await act(async () => exportButton().click());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('两项或三项卖点'));
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledOnce();
  });

  it('PNG 导入、尺寸标注、编辑撤销和导出复用现有编辑器', async () => {
    await mount({ ...bedDraft, mainImage: undefined, annotations: [], dimensionFields: { length: '162', width: '', height: '' }, sizeInput: '162××' });
    const input = container.querySelector<HTMLInputElement>('[aria-label="上传主产品 PNG"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['png'], 'G370-A.png', { type: 'image/png' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => button('标注长').click());
    expect(container.querySelector('main')?.classList.contains('template-marking')).toBe(true);
    await clickCanvas(250, 410); await clickCanvas(850, 410);
    await settle();
    expect(lastDraft().mainImage?.name).toBe('G370-A.png');
    expect(lastDraft().annotations[0].value).toBe(162);
    await clickDimension('162cm');
    const editor = container.querySelector<HTMLInputElement>('.canvas-dimension-input input')!;
    await fill(editor, '163');
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    await settle();
    expect(lastDraft().dimensionFields.length).toBe('163');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    await settle();
    expect(lastDraft().dimensionFields.length).toBe('162');
    await act(async () => exportButton().click());
    expect(window.alert).not.toHaveBeenCalled();
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalled();
    expect(container.querySelector('canvas')!.width).toBe(1440);
    expect(container.querySelector('canvas')!.height).toBe(1440);
  });
});

it('功能说明默认关闭，文字、位置和开关支持撤销与草稿', async () => {
  await mount();
  expect(container.querySelector('[aria-label="画布功能说明"]')).toBeNull();
  const toggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  await act(async () => toggle.click());
  const editor = container.querySelector<HTMLInputElement>('[aria-label="画布功能说明"]')!;
  await fill(editor, '6档调节'); await settle();
  expect(lastDraft().sofaBedFeature?.text).toBe('6档调节');
  expect(lastDraft().sofaBedFeature?.enabled).toBe(true);
  await clickCanvas(800, 570);
  expect(container.querySelector('.label-inspector')?.textContent).toContain('功能说明');
  await act(async () => button('下移 10px').click()); await settle();
  expect(lastDraft().sofaBedFeature?.y).toBe(540);
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click()); await settle();
  expect(lastDraft().sofaBedFeature?.y).toBe(530);
  const canvas = container.querySelector('canvas')!;
  await act(async () => canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 800, clientY: 570, bubbles: true })));
  await act(async () => canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 900, clientY: 610, bubbles: true })));
  await act(async () => canvas.dispatchEvent(new MouseEvent('pointerup', { bubbles: true })));
  await settle();
  expect(lastDraft().sofaBedFeature).toMatchObject({ x: 880, y: 570, text: '6档调节' });
  expect(contexts.get(container.querySelector('canvas')!)!.text.some((item) => item.text === '6档调节')).toBe(true);
});

it('范围尺寸整段绘制、画布编辑截断并保存，非法快速输入阻断导出', async () => {
  await mount({ ...bedDraft, dimensionFields: { length: '162', width: '100~196', height: '95~54' }, sizeInput: '162×100~196×95~54' });
  const canvas = container.querySelector('canvas')!;
  expect(contexts.get(canvas)!.text.some((item) => item.text === '100~196cm')).toBe(true);
  expect(contexts.get(canvas)!.text.some((item) => item.text === '95~')).toBe(true);
  expect(contexts.get(canvas)!.text.some((item) => item.text === '54cm')).toBe(true);
  await clickDimension('100~196cm');
  const input = container.querySelector<HTMLInputElement>('.canvas-dimension-input input')!;
  await fill(input, '100.29~196.39');
  await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await settle();
  expect(lastDraft().dimensionFields.width).toBe('100.2~196.3');
  expect(contexts.get(canvas)!.text.some((item) => item.text === '100.2~196.3cm')).toBe(true);
  await fill(container.querySelector<HTMLInputElement>('[aria-label="主产品尺寸（长×宽×高）"]')!, '错误输入');
  await act(async () => exportButton().click());
  expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('快速尺寸格式无效'));
});
