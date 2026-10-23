// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SingleWorkbench } from './App';
import { SofaCombinationWorkbench } from './SofaCombinationWorkbench';
import { saveDraft, type WorkbenchDraft, type SofaCombinationDraft } from './storage/draftStorage';
import type { DimensionAnnotation } from './domain/dimensionAnnotations';
import * as imageLoader from './project/productImage';
import { isSingleTemplateId } from './templates/registry';
import type { TemplateId } from './domain/templates';

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
const single: WorkbenchDraft = { version: 1, model: 'TEST', modelManuallyEdited: true, sellingPoints: ['舒适', '', ''], sizeInput: '240×88×100', dimensionFields: fields, annotations, subjectAdjustment: adjustment, image };
const combination: SofaCombinationDraft = { version: 1, kind: 'standard', model: 'TEST', modelManuallyEdited: true, sizeInput: '240×88×100', dimensionFields: fields, annotations, subjectAdjustment: adjustment, mainImage: image,
  optionalSizes: [{ id: 'spec-one', sizeInput: '210×80×90', dimensionFields: { length: '210', width: '80', height: '90' }, annotations: annotations.map((annotation, index) => ({ ...annotation, value: [210, 80, 90][index] })), adjustment, image }], optionalLabelEnabled: true, optionalLabelOffsetY: 0, optionalLabelSide: 'left', noteEnabled: true, note: '测试备注' };

let container: HTMLDivElement, root: Root;
type Paint = { kind: 'stroke' | 'fill'; color: string };
const contexts = new Map<HTMLCanvasElement, { text: Array<{ text: string; x: number; y: number }>; products: number[][]; paint: Paint[]; context: CanvasRenderingContext2D }>();

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  SVGElement.prototype.setPointerCapture = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1440, bottom: 1440, width: 1440, height: 1440, toJSON: () => ({}) });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    this.setPointerCapture = vi.fn();
    if (!contexts.has(this)) {
      const text: Array<{ text: string; x: number; y: number }> = [];
      const products: number[][] = [];
      const paint: Paint[] = [];
      const context = { fillRect: () => { text.length = 0; products.length = 0; paint.length = 0; }, fillText: (value: string, x: number, y: number) => text.push({ text: value, x, y }), measureText: (value: string) => ({ width: value.length * 24, actualBoundingBoxAscent: 36, actualBoundingBoxDescent: 10 }),
        beginPath() {}, roundRect() {}, fill() { paint.push({ kind: 'fill', color: String(context.fillStyle) }); }, stroke() { paint.push({ kind: 'stroke', color: String(context.strokeStyle) }); }, save() {}, restore() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, drawImage(...args: unknown[]) { if (args.length === 9) products.push(args.slice(5) as number[]); if (args[0] instanceof HTMLCanvasElement) paint.push(...contexts.get(args[0])!.paint); }, setLineDash() {},
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
const inspector = () => container.querySelector('.contextual-inspector')!;
const inputs = () => inspector().querySelectorAll<HTMLInputElement>('.dimension-card input');
const exportButton = () => container.querySelector<HTMLButtonElement>('.header-export')!;

describe('全模板文件名识别与手动名称保护', () => {
  async function upload(label: string, filename: string) {
    const input = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['image'], filename, { type: 'image/png' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  }
  async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(500); }); }
  const modelInput = () => container.querySelector<HTMLInputElement>('[aria-label="画布产品型号"]')!;

  it.each([
    ['office-chair-single', 'YZ2R-A-透明素材-1.6m长餐桌-（罗马洞石）.png', 'YZ2R-A 1.6m长餐桌'],
    ['footstool-single', 'PS060-A1-透明素材-大号脚踏（75×65.5）.png', 'PS060-A1 大号脚踏（75×65.5）'],
    ['soft-bed-single', 'BC553-A-透明素材-1.8m床.png', 'BC553-A床'],
    ['sofa-single', 'YZ2R-A-透明素材-三人沙发.png', 'YZ2R-A'],
    ['sofa-combination', 'YZ2R-A-透明素材-三人沙发.png', 'YZ2R-A'],
    ['sofa-bed-combination', 'YZ2R-A-透明素材-双人沙发床.png', 'YZ2R-A'],
  ] as const)('%s上传按本模板填入名称，手动内容保留，采用候选可撤销', async (id, filename, expected) => {
    await act(async () => root.render(isSingleTemplateId(id)
      ? <SingleWorkbench templateId={id} onBack={() => undefined} initialProject={{ projectId: id, fileName: 'test.skuwork', draft: { ...single, model: '', modelManuallyEdited: false, image: undefined } }}/>
      : <SofaCombinationWorkbench templateId={id} onBack={() => undefined} initialProject={{ projectId: id, fileName: 'test.skuwork', draft: { ...combination, model: '', modelManuallyEdited: false, mainImage: undefined } }}/>));
    const label = isSingleTemplateId(id) ? '上传产品 PNG' : '上传主产品 PNG';
    await upload(label, filename);
    await flush();
    expect(modelInput().value).toBe(expected);
    expect(container.textContent).toContain(`文件名提取结果：${expected}`);
    await fill(modelInput(), '我手动填写的正确名称');
    await flush();
    expect(container.textContent).toContain(`已保留手动内容；文件名建议：${expected}`);
    expect(container.textContent).not.toContain(`文件名提取结果：${expected}`);
    await upload(label, filename);
    await flush();
    expect(modelInput().value).toBe('我手动填写的正确名称');
    const adopt = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '采用文件名名称')!;
    await act(async () => adopt.click());
    await flush();
    expect(modelInput().value).toBe(expected);
    expect(vi.mocked(saveDraft).mock.lastCall![0]).toMatchObject({ model: expected, modelManuallyEdited: true });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(modelInput().value).toBe('我手动填写的正确名称');
    expect(container.textContent).toContain('已保留手动内容');
  });

  it.each(['office-chair-single', 'footstool-single', 'soft-bed-single', 'sofa-single', 'sofa-combination', 'sofa-bed-combination'] as TemplateId[])('%s旧源文件的名称不按图片文件名重新计算', async (id) => {
    const savedImage = { ...image, name: 'YZ2R-A-透明素材-1.6m长餐桌.png' };
    const model = '旧源文件中的正确名称';
    await act(async () => root.render(isSingleTemplateId(id)
      ? <SingleWorkbench templateId={id} onBack={() => undefined} initialProject={{ projectId: id, fileName: 'old.skuwork', draft: { ...single, model, modelManuallyEdited: false, image: savedImage } }}/>
      : <SofaCombinationWorkbench templateId={id as 'sofa-combination' | 'sofa-bed-combination'} onBack={() => undefined} initialProject={{ projectId: id, fileName: 'old.skuwork', draft: { ...combination, model, modelManuallyEdited: false, mainImage: savedImage } }}/>));
    await flush();
    expect(modelInput().value).toBe(model);
    expect(container.textContent).toContain('已保留当前名称');
  });

  it.each(['sofa-combination', 'sofa-bed-combination'] as const)('%s附加规格识别只显示在对应对象，不修改主产品及其他规格', async (id) => {
    await act(async () => root.render(<SofaCombinationWorkbench templateId={id} onBack={() => undefined} initialProject={{ projectId: id, fileName: 'test.skuwork', draft: { ...combination, optionalSizes: [...combination.optionalSizes, { ...combination.optionalSizes[0], id: 'spec-two' }] } }}/>));
    await upload('更换规格 1 PNG', 'YZ2R-A-透明素材-1.6m长餐桌.png');
    await flush();
    expect(modelInput().value).toBe('TEST');
    expect(container.querySelector('[aria-label="规格 1文件名识别"]')!.textContent).toContain('YZ2R-A 1.6m长餐桌');
    expect(container.querySelector('[aria-label="规格 2文件名识别"]')!.textContent).not.toContain('YZ2R-A');
    const saved = vi.mocked(saveDraft).mock.lastCall![0] as SofaCombinationDraft;
    expect(saved.mainImage?.name).toBe('TEST.png');
    expect(saved.optionalSizes[0].sizeInput).toBe(combination.optionalSizes[0].sizeInput);
    expect(saved.optionalSizes[1].image?.name).toBe('TEST.png');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(container.querySelector('[aria-label="规格 1文件名识别"]')!.textContent).not.toContain('YZ2R-A');
  });

  it('图片读取失败不先填入名称，提示失败并保留原现场', async () => {
    await act(async () => root.render(<SingleWorkbench templateId="office-chair-single" onBack={() => undefined}/>));
    vi.spyOn(imageLoader, 'productImageFromBlob').mockRejectedValueOnce(new Error('invalid image'));
    await upload('上传产品 PNG', 'YZ2R-A-透明素材-1.6m长餐桌.png');
    expect(modelInput().value).toBe('');
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('产品图读取失败');
    expect(container.textContent).not.toContain('文件名提取结果');
  });
});

describe('编辑高亮与 SKU 模板隔离', () => {
  it.each(['单品', '组合主产品', '组合规格'])('%s选中和取消选中仅改变网页高亮，导出仍保持原版线段和箭头颜色', async (scene) => {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'color-single', fileName: 'test.skuwork', draft: single }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'color-combination', fileName: 'test.skuwork', draft: combination }}/>));
    const canvas = container.querySelector('canvas')!;
    const originalPaint = contexts.get(canvas)!.paint.slice();
    expect(originalPaint).toContainEqual({ kind: 'stroke', color: '#545454' });
    expect(originalPaint).toContainEqual({ kind: 'fill', color: '#545454' });
    expect(originalPaint.some(({ color }) => color.toLowerCase() === '#3aefd0')).toBe(false);
    expect(container.querySelector('.dimension-line-selection')).toBeNull();
    const exports: Paint[][] = [];
    vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockImplementation(function (this: HTMLCanvasElement) {
      exports.push(contexts.get(this)!.paint.slice());
      return 'data:image/png;base64,test';
    });
    await clickDimension(scene === '组合规格' ? '210cm' : '240cm');
    const input = container.querySelector<HTMLInputElement>('.canvas-dimension-input input');
    if (input) await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    const highlight = container.querySelector('.dimension-line-selection')!;
    expect(highlight).not.toBeNull();
    expect(canvas.contains(highlight)).toBe(false);
    expect(contexts.get(canvas)!.paint).toEqual(originalPaint);
    await act(async () => exportButton().click());
    expect(exports).toEqual([originalPaint]);
    await clickCanvas(20, 20);
    expect(container.querySelector('.dimension-line-selection')).toBeNull();
    expect(container.querySelector('.dimension-endpoint')).toBeNull();
    expect(contexts.get(canvas)!.paint).toEqual(originalPaint);
    await act(async () => exportButton().click());
    expect(exports).toEqual([originalPaint, originalPaint]);
  });
});

describe('画布产品型号编辑', () => {
  it.each(['单品', '普通组合', '功能组合'])('%s 点击型号直接编辑，同步侧栏、保存、撤销和导出', async (scene) => {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'model-single', fileName: 'test.skuwork', draft: { ...single, modelManuallyEdited: false } }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'model-combination', fileName: 'test.skuwork', draft: { ...combination, kind: scene === '功能组合' ? 'functional' : 'standard', modelManuallyEdited: false } }}/>));
    const canvas = container.querySelector('canvas')!;
    const editor = container.querySelector<HTMLInputElement>('[aria-label="画布产品型号"]')!;
    const sidebar = Array.from(container.querySelectorAll<HTMLLabelElement>('.quick-input-panel label')).find((label) => label.textContent === '产品型号')!.querySelector('input')!;
    const originalWidth = parseFloat(editor.style.width);
    const exportedNames: string[] = [];
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) { exportedNames.push(this.download); });
    await clickDimension('240cm');
    await act(async () => {
      editor.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      editor.click();
      editor.focus();
    });
    expect(document.activeElement).toBe(editor);
    expect(container.querySelector('.dimension-line-selection')).toBeNull();
    expect(container.querySelector('.canvas-dimension-input')).toBeNull();
    expect(container.textContent).toContain('正在编辑产品型号');
    await fill(editor, 'PS060-A1');
    expect(sidebar.value).toBe('PS060-A1');
    expect(parseFloat(editor.style.width)).toBeGreaterThan(originalWidth);
    expect(contexts.get(canvas)!.text.filter((item) => item.text === 'PS060-A1')).toHaveLength(1);
    expect(contexts.get(canvas)!.paint.some(({ color }) => color.toLowerCase() === '#3aefd0')).toBe(false);
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    expect(document.activeElement).toBe(editor);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ model: 'PS060-A1', modelManuallyEdited: true, dimensionFields: fields }), expect.any(String));
    await act(async () => exportButton().click());
    expect(exportedNames).toEqual([scene === '单品' ? 'PS060-A1-SKU.jpg' : 'PS060-A1-组合SKU.jpg']);
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenLastCalledWith('image/jpeg', 0.95);
    expect(exportButton().textContent).toContain('JPG');
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(document.activeElement).not.toBe(editor);
    expect(container.textContent).not.toContain('正在编辑产品型号');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(editor.value).toBe('TEST');
    expect(sidebar.value).toBe('TEST');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    expect(editor.value).toBe('PS060-A1');
    await fill(sidebar, 'LEFT-EDIT');
    expect(editor.value).toBe('LEFT-EDIT');
    await fill(editor, '');
    expect(sidebar.value).toBe('');
    expect(editor.placeholder).toBe('产品型号');
    expect(parseFloat(editor.style.width)).toBeGreaterThan(0);
    expect(contexts.get(canvas)!.text.filter((item) => item.text === '产品型号')).toHaveLength(1);
    await act(async () => editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.activeElement).not.toBe(editor);
  });
});

describe('固定尺寸线与产品联动', () => {
  const scenes = ['单品', '组合主产品', '组合规格'];
  const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(600); });
  const press = async (text: string) => act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === text)!.click());
  const pointer = async (element: Element, type: string, x: number, y: number) => act(async () => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })));
  const labels = () => contexts.get(container.querySelector('canvas')!)!.text.filter((item) => item.text.endsWith('cm')).map((item) => ({ ...item }));
  function expectLabels(before: ReturnType<typeof labels>) {
    const after = labels(); expect(after.map((item) => item.text)).toEqual(before.map((item) => item.text));
    after.forEach((item, i) => { expect(item.x).toBeCloseTo(before[i].x, 6); expect(item.y).toBeCloseTo(before[i].y, 6); });
  }
  it.each(scenes)('%s换不同比例图片后固定标注，移动缩放不带动标注，可切回联动并撤销恢复', async (scene) => {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'link-single', fileName: 'test.skuwork', draft: { ...single, subjectAdjustment: { ...adjustment, scale: .65 } } }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'link-combo', fileName: 'test.skuwork', draft: { ...combination, subjectAdjustment: { ...adjustment, scale: .65 }, optionalSizes: combination.optionalSizes.map((item) => ({ ...item, adjustment: { ...adjustment, scale: .65 } })) } }}/>));
    const canvas = container.querySelector('canvas')!;
    const index = scene === '组合规格' ? 1 : 0;
    const product = () => [...contexts.get(canvas)!.products[index]];
    const select = async () => { const [x, y, w, h] = product(); await clickCanvas(x + w / 2, y + h / 2); };
    const before = labels();
    const beforeProduct = product();
    await select(); await press('尺寸线固定'); expectLabels(before);
    product().forEach((value, i) => expect(value).toBeCloseTo(beforeProduct[i], 6));
    await press('随产品联动'); expectLabels(before);
    product().forEach((value, i) => expect(value).toBeCloseTo(beforeProduct[i], 6));
    await flush();
    vi.spyOn(imageLoader, 'productImageFromBlob').mockImplementationOnce(async (blob, name) => ({ blob, name, element: new Image(), visible: { x: 0, y: 0, width: 300, height: 500 }, silhouette: [{ left: 0, right: 1, top: 0, bottom: 1 }] }));
    const uploadLabel = scene === '单品' ? '上传产品 PNG' : scene === '组合主产品' ? '上传主产品 PNG' : '更换规格 1 PNG';
    const input = container.querySelector<HTMLInputElement>(`[aria-label="${uploadLabel}"]`)!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['new'], 'NEW.png', { type: 'image/png' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    expectLabels(before); await flush();
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    const placement = scene === '组合规格' ? (saved as SofaCombinationDraft).optionalSizes[0].adjustment! : saved.subjectAdjustment;
    expect(placement.dimensionFrame).toBeDefined();
    await select();
    expect(Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '尺寸线固定')!.getAttribute('aria-pressed')).toBe('true');
    let [x, y, w, h] = product();
    let handle = container.querySelector('[aria-label="等比例缩放 se"]')!;
    await pointer(handle, 'pointerdown', x + w, y + h);
    await pointer(handle, 'pointermove', x + w * .7, y + h * .7); expectLabels(before);
    await pointer(handle, 'pointerup', x + w * .7, y + h * .7); expectLabels(before);
    expect(product()[2]).toBeLessThan(w);
    [x, y, w, h] = product();
    await pointer(canvas, 'pointerdown', x + w / 2, y + h / 2);
    await pointer(canvas, 'pointermove', x + w / 2 + 15, y + h / 2 + 15); expectLabels(before);
    await pointer(canvas, 'pointerup', x + w / 2 + 15, y + h / 2 + 15); expectLabels(before);
    await press('随产品联动'); expectLabels(before);
    [x, y, w, h] = product(); handle = container.querySelector('[aria-label="等比例缩放 se"]')!;
    await pointer(handle, 'pointerdown', x + w, y + h);
    await pointer(handle, 'pointerup', x + w * .85, y + h * .85);
    expect(labels()).not.toEqual(before);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click()); expectLabels(before);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click()); expectLabels(before);
    await flush();
    const restored = vi.mocked(saveDraft).mock.lastCall![0];
    expect((scene === '组合规格' ? (restored as SofaCombinationDraft).optionalSizes[0].adjustment : restored.subjectAdjustment)?.dimensionFrame).toBeDefined();
  });
});

describe('画布双击换图', () => {
  async function doubleClickAt(x: number, y: number) {
    const canvas = container.querySelector('canvas')!;
    for (const detail of [1, 2]) {
      await act(async () => {
        for (const type of ['pointerdown', 'pointerup', 'click']) canvas.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, detail, bubbles: true, cancelable: true }));
      });
    }
    await act(async () => canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: x, clientY: y, detail: 2, bubbles: true, cancelable: true })));
  }

  it.each(['单品', '组合主产品', '组合规格'])('%s 选中后双击仅打开对应换图入口，取消不改图，更换可撤销', async (scene) => {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'replace-single', fileName: 'test.skuwork', draft: single }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'replace-combination', fileName: 'test.skuwork', draft: combination }}/>));
    const canvas = container.querySelector('canvas')!;
    const [left, top, width, height] = contexts.get(canvas)!.products[scene === '组合规格' ? 1 : 0];
    const x = left + width / 2, y = top + height / 2;
    const label = scene === '单品' ? '上传产品 PNG' : scene === '组合主产品' ? '上传主产品 PNG' : '更换规格 1 PNG';
    const upload = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    const chooser = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    await clickCanvas(x, y);
    expect(chooser).not.toHaveBeenCalled();
    expect(container.querySelector('.product-selection')).not.toBeNull();
    expect(container.textContent).toContain('双击产品换图');
    await doubleClickAt(x, y);
    expect(chooser).toHaveBeenCalledTimes(1);
    expect(chooser.mock.contexts[0]).toBe(upload);
    Object.defineProperty(upload, 'files', { configurable: true, value: [] });
    await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
    expect(container.querySelector('.product-selection')).not.toBeNull();
    expect(contexts.get(canvas)!.products[scene === '组合规格' ? 1 : 0]).toEqual([left, top, width, height]);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
    await doubleClickAt(x, y);
    expect(chooser).toHaveBeenCalledTimes(2);
    Object.defineProperty(upload, 'files', { configurable: true, value: [new File(['replacement'], 'REPLACED.png', { type: 'image/png' })] });
    await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    expect(saved.model).toBe('TEST');
    expect(saved.dimensionFields).toEqual(fields);
    if (scene === '单品') expect(saved).toMatchObject({ image: { name: 'REPLACED.png' } });
    else {
      expect((saved as SofaCombinationDraft).mainImage?.name).toBe(scene === '组合主产品' ? 'REPLACED.png' : 'TEST.png');
      expect((saved as SofaCombinationDraft).optionalSizes[0].image?.name).toBe(scene === '组合规格' ? 'REPLACED.png' : 'TEST.png');
      expect((saved as SofaCombinationDraft).optionalSizes[0].dimensionFields).toEqual(combination.optionalSizes[0].dimensionFields);
    }
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const restored = vi.mocked(saveDraft).mock.lastCall![0];
    if (scene === '单品') expect(restored).toMatchObject({ image: { name: 'TEST.png' } });
    else {
      expect((restored as SofaCombinationDraft).mainImage?.name).toBe('TEST.png');
      expect((restored as SofaCombinationDraft).optionalSizes[0].image?.name).toBe('TEST.png');
    }
    chooser.mockClear();
    await doubleClickAt(20, 20);
    const dimension = contexts.get(canvas)!.text.find((item) => item.text === '240cm')!;
    await doubleClickAt(dimension.x, dimension.y);
    expect(chooser).not.toHaveBeenCalled();
    expect(container.querySelector('.canvas-dimension-input')).not.toBeNull();
  });

  it('规格调整顺序后仍更换双击选中的规格', async () => {
    const draft = { ...combination, optionalSizes: [...combination.optionalSizes, { ...combination.optionalSizes[0], id: 'spec-two' }] };
    await act(async () => root.render(<SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'replace-order', fileName: 'test.skuwork', draft }}/>));
    const firstCard = container.querySelector('.optional-object-row')!;
    await act(async () => Array.from(firstCard.querySelectorAll('button')).find((button) => button.textContent === '下移')!.click());
    const canvas = container.querySelector('canvas')!;
    const [left, top, width, height] = contexts.get(canvas)!.products[2];
    const chooser = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    await doubleClickAt(left + width / 2, top + height / 2);
    const upload = container.querySelector<HTMLInputElement>('[aria-label="更换规格 2 PNG"]')!;
    expect(chooser.mock.contexts[0]).toBe(upload);
    Object.defineProperty(upload, 'files', { value: [new File(['replacement'], 'REORDERED.png', { type: 'image/png' })] });
    await act(async () => upload.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0] as SofaCombinationDraft;
    expect(saved.optionalSizes.map((item) => [item.id, item.image?.name])).toEqual([['spec-two', 'TEST.png'], ['spec-one', 'REORDERED.png']]);
  });
});

describe('左右栏与画布联动', () => {
  it('单品点选尺寸后切换高亮、同步左侧、保存、撤销，导出无重复确认', async () => {
    await act(async () => root.render(<SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'single-test', fileName: 'test.skuwork', draft: single }}/>));
    expect(inspector().querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelector('.quick-input-panel')?.textContent).toContain('三个卖点');
    await clickDimension('240cm');
    expect(inputs()).toHaveLength(3);
    expect(inspector().querySelector('.dimension-card.active')?.getAttribute('aria-label')).toBe('长尺寸微调');
    await fill(inputs()[1], '92');
    expect(inspector().querySelector('.dimension-card.active')?.getAttribute('aria-label')).toBe('宽尺寸微调');
    expect(container.querySelector<HTMLInputElement>('[placeholder="长×宽×高"]')!.value).toBe('240×92×100');
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ dimensionFields: { length: '240', width: '92', height: '100' } }), expect.any(String));
    await act(async () => exportButton().click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(container.querySelector<HTMLInputElement>('[placeholder="长×宽×高"]')!.value).toBe('240×88×100');
    await clickDimension('100cm');
    await clickCanvas(20, 20);
    expect(inputs()).toHaveLength(0);
  });

  it('组合尺寸始终绑定所属规格，切换区块不修改主产品，标签只展示位置微调', async () => {
    await act(async () => root.render(<SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'combo-test', fileName: 'test.skuwork', draft: combination }}/>));
    await clickDimension('210cm');
    expect(inspector().textContent).toContain('规格 1 · 尺寸微调');
    await fill(inputs()[2], '95');
    expect(container.querySelector<HTMLInputElement>('[aria-label="规格 1尺寸（长×宽×高）"]')!.value).toBe('210×80×95');
    expect(container.querySelector<HTMLInputElement>('[placeholder="长×宽×高"]')!.value).toBe('240×88×100');
    await clickDimension('88cm');
    expect(inspector().textContent).toContain('主产品 · 尺寸微调');
    expect(inspector().querySelector('.dimension-card.active')?.getAttribute('aria-label')).toBe('宽尺寸微调');
    await clickDimension('其他可选尺寸');
    expect(inspector().textContent).toContain('位置微调');
    expect(inspector().textContent).not.toContain('放在左侧');
    expect(container.querySelector('.label-selection')).not.toBeNull();
    const mainCard = container.querySelector('.main-object-row')!;
    const mainSizeInput = mainCard.querySelector<HTMLInputElement>('[aria-label="主产品尺寸（长×宽×高）"]')!;
    await fill(mainSizeInput, '260×92×105');
    await clickDimension('260cm');
    expect(inspector().textContent).toContain('主产品 · 尺寸微调');
    expect(Array.from(inputs(), (input) => input.value)).toEqual(['260', '92', '105']);
    expect(container.querySelector<HTMLInputElement>('[aria-label="规格 1尺寸（长×宽×高）"]')!.value).toBe('210×80×95');
    const mainUpload = mainCard.querySelector<HTMLInputElement>('.object-thumb-upload input[type="file"]')!;
    expect(mainUpload.closest('button')).toBeNull();
    Object.defineProperty(mainUpload, 'files', { value: [new File(['png'], 'MAIN-NEW.png', { type: 'image/png' })] });
    await act(async () => mainUpload.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({
      dimensionFields: { length: '260', width: '92', height: '105' },
      mainImage: expect.objectContaining({ name: 'MAIN-NEW.png' }),
      optionalSizes: [expect.objectContaining({ sizeInput: '210×80×95', image: expect.objectContaining({ name: 'TEST.png' }) })],
    }), expect.any(String));
    await act(async () => exportButton().click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('尺寸未标注时仅在导出提示，空白点击不会开始标注，显式开始后可以取消', async () => {
    await act(async () => root.render(<SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'incomplete-test', fileName: 'test.skuwork', draft: { ...single, annotations: [] } }}/>));
    await clickCanvas(20, 20);
    expect(inspector().textContent).toContain('点击画布组件');
    expect(container.textContent).not.toContain('检查与现场');
    await act(async () => exportButton().click());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('请完成已填写尺寸的标注'));
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('.quick-annotation-actions button')!.click());
    expect(inspector().textContent).toContain('取消本次标注');
    await clickCanvas(300, 300);
    await act(async () => (Array.from(inspector().querySelectorAll('button')).find((button) => button.textContent === '取消本次标注')!).click());
    await clickCanvas(20, 20);
    expect(inputs()).toHaveLength(0);
  });
});

describe('所有尺寸重标入口', () => {
  const cases = ['单品', '组合主产品', '组合规格'].flatMap((scene) =>
    ['长', '宽', '高'].map((label, index) => ({ scene, label, index })));

  it.each(cases)('$scene 右侧重标$label：立即隐藏旧标注，预览不重叠，取消和撤销恢复', async ({ scene, index }) => {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'remark-single', fileName: 'test.skuwork', draft: single }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'remark-combo', fileName: 'test.skuwork', draft: combination }}/>));
    const canvas = container.querySelector('canvas')!;
    const text = `${(scene === '组合规格' ? [210, 80, 90] : [240, 88, 100])[index]}cm`;
    const drawn = () => contexts.get(canvas)!.text.filter((item) => item.text === text);
    const original = { ...drawn()[0] };
    const others = contexts.get(canvas)!.text.filter((item) => item.text.endsWith('cm') && item.text !== text);
    expect(drawn()).toHaveLength(1);
    const leftButtons = Array.from(container.querySelectorAll('.quick-input-panel button'));
    expect(leftButtons.some((button) => /^(重标|标注)[长宽高]$/.test(button.textContent ?? ''))).toBe(false);

    async function start() {
      await clickDimension(text);
      await act(async () => inspector().querySelectorAll<HTMLElement>('.dimension-card')[index].querySelector('button')!.click());
    }
    async function preview() {
      await clickCanvas(original.x - 30, original.y + 30);
      await act(async () => canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: original.x + 100, clientY: original.y + 60, bubbles: true })));
      expect(drawn()).toHaveLength(1);
      expect(drawn()[0]).not.toEqual(original);
    }

    await start();
    expect(drawn()).toHaveLength(0);
    // 只隐藏当前对象的当前尺寸，不改变其他尺寸或产品布局。
    expect(contexts.get(canvas)!.text.filter((item) => item.text.endsWith('cm') && item.text !== text)).toEqual(others);
    await act(async () => exportButton().click());
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('标注尚未完成'));
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    await preview();
    await act(async () => Array.from(inspector().querySelectorAll('button')).find((button) => button.textContent === '取消本次标注')!.click());
    expect(drawn()).toEqual([original]);

    await start();
    expect(drawn()).toHaveLength(0);
    await preview();
    await clickCanvas(original.x + 100, original.y + 60);
    expect(drawn()).toHaveLength(1);
    expect(drawn()[0]).not.toEqual(original);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await act(async () => exportButton().click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(drawn()).toEqual([original]);
  });
});

describe('左侧首次标注入口', () => {
  it.each(['单品', '组合主产品'])('%s只显示未完成尺寸的标注按钮，完成后移除入口', async (scene) => {
    const incompleteAnnotations = annotations.filter((annotation) => annotation.kind !== 'length');
    const draft = { ...combination, annotations: incompleteAnnotations };
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'initial-single', fileName: 'test.skuwork', draft: { ...single, annotations: incompleteAnnotations } }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'initial-combo', fileName: 'test.skuwork', draft }}/>));
    const annotationButtons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.quick-input-panel button')).filter((button) => /^(重标|标注)[长宽高]$/.test(button.textContent ?? ''));
    expect(annotationButtons().map((button) => button.textContent)).toEqual(['标注长']);
    await act(async () => annotationButtons()[0].click());
    expect(inspector().textContent).toContain(scene === '单品' ? '单品' : '主产品');
    await clickCanvas(400, 400);
    await clickCanvas(700, 400);
    expect(annotationButtons()).toHaveLength(0);
    expect(inspector().querySelector('.dimension-card button')?.textContent).toBe('重新标注');
  });
});

describe('组合规格尺寸入口', () => {
  it('左侧规格卡片无标注按钮，新规格可从右侧开始首次标注', async () => {
    const draft = { ...combination, optionalSizes: combination.optionalSizes.map((item) => ({ ...item, annotations: [] })) };
    await act(async () => root.render(<SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'optional-initial', fileName: 'test.skuwork', draft }}/>));
    const card = container.querySelector('.optional-object-row')!;
    expect(Array.from(card.querySelectorAll('button')).some((button) => /标注|重标/.test(button.textContent ?? ''))).toBe(false);
    await act(async () => card.querySelector<HTMLButtonElement>('.object-row-select')!.click());
    expect(inspector().textContent).toContain('规格 1 · 产品微调');
    await act(async () => Array.from(inspector().querySelectorAll('button')).find((button) => button.textContent === '尺寸标注')!.click());
    expect(inspector().textContent).toContain('规格 1 · 尺寸微调');
    expect(inputs()).toHaveLength(3);
    await act(async () => inspector().querySelector('.dimension-card button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(inspector().textContent).toContain('取消本次标注');
    await clickCanvas(400, 400);
    await clickCanvas(700, 400);
    expect(inspector().querySelector('.dimension-card button')?.textContent).toBe('重新标注');
    expect(contexts.get(container.querySelector('canvas')!)!.text.some((item) => item.text === '210cm')).toBe(true);
  });
});


describe('画布内尺寸编辑与端点拖动', () => {
  const scenes = ['单品', '组合主产品', '组合规格'];
  async function renderScene(scene: string) {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'inline-single', fileName: 'test.skuwork', draft: single }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'inline-combo', fileName: 'test.skuwork', draft: combination }}/>));
  }
  const editor = () => container.querySelector<HTMLInputElement>('.canvas-dimension-input input')!;
  const line = () => {
    const element = container.querySelector('.dimension-line-selection line')!;
    return { from: { x: Number(element.getAttribute('x1')), y: Number(element.getAttribute('y1')) }, to: { x: Number(element.getAttribute('x2')), y: Number(element.getAttribute('y2')) } };
  };
  const keys = async (element: HTMLElement, key: string) => act(async () => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })));
  async function selectLine(text: string) {
    await clickDimension(text);
    await keys(editor(), 'Escape');
    const original = line();
    await clickCanvas(20, 20);
    await clickCanvas((original.from.x + original.to.x) / 2, (original.from.y + original.to.y) / 2);
    expect(editor()).toBeNull();
    expect(container.querySelectorAll('.dimension-endpoint')).toHaveLength(2);
    return original;
  }
  async function pointer(element: Element, type: string, x: number, y: number) {
    await act(async () => element.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })));
  }

  it.each(scenes)('%s点击尺寸文字才显示位置与颜色微调，独立移动、撤销、保存恢复且不改变主线和产品', async (scene) => {
    await renderScene(scene);
    const text = scene === '组合规格' ? '210cm' : '240cm';
    const originalLine = await selectLine(text);
    expect(container.querySelector('.dimension-label-controls')).toBeNull();
    const canvas = container.querySelector('canvas')!;
    const label = () => contexts.get(canvas)!.text.find((item) => item.text === text)!;
    const originalLabel = { ...label() }, products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    await clickDimension(text);
    expect(inspector().querySelector('.dimension-label-controls')).not.toBeNull();
    expect(container.querySelector('.dimension-label-controls input')).toBeNull();
    await keys(editor(), 'Escape');
    const toggle = () => container.querySelector<HTMLButtonElement>('.dimension-label-move-toggle')!;
    await act(async () => toggle().click());
    expect(editor()).toBeNull();
    expect(toggle().getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.dimension-endpoint')).toBeNull();
    const handle = container.querySelector<HTMLButtonElement>('.dimension-label-drag')!;
    await act(async () => { await vi.advanceTimersByTimeAsync(500); }); vi.mocked(saveDraft).mockClear();
    await pointer(handle, 'pointerdown', originalLabel.x, originalLabel.y);
    await pointer(handle, 'pointermove', originalLabel.x + 35, originalLabel.y - 20);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(saveDraft).not.toHaveBeenCalled();
    expect(label().x).toBeCloseTo(originalLabel.x + 35, 7); expect(label().y).toBeCloseTo(originalLabel.y - 20, 7);
    await pointer(handle, 'pointerup', originalLabel.x + 35, originalLabel.y - 20);
    await act(async () => toggle().click());
    expect(container.querySelector('.dimension-label-drag')).toBeNull();
    expect(line()).toEqual(originalLine); expect(contexts.get(canvas)!.products).toEqual(products);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(label()).toEqual(originalLabel);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    expect(label().x).toBe(originalLabel.x + 35);
    await clickDimension(text); await keys(editor(), 'Escape');
    const colors: string[] = [];
    const context = contexts.get(canvas)!.context, drawText = context.fillText;
    vi.spyOn(context, 'fillText').mockImplementation((value, x, y) => { if (value === text) colors.push(String(context.fillStyle)); drawText(value, x, y); });
    await act(async () => inspector().querySelectorAll<HTMLButtonElement>('.dimension-label-colors button')[1].click());
    expect(colors.at(-1)).toBe('#ffffff');
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    const stored = scene === '组合规格' ? (saved as SofaCombinationDraft).optionalSizes[0].annotations : saved.annotations;
    const before = scene === '组合规格' ? combination.optionalSizes[0].annotations : annotations;
    expect(stored).toEqual(before.map((item, index) => index ? item : { ...item, labelOffset: { x: expect.closeTo(35, 7), y: expect.closeTo(-20, 7) }, labelColor: 'white' }));
    expect(saved.subjectAdjustment).toEqual(adjustment);
    if (scene === '组合规格') expect(saved.annotations).toEqual(annotations);
    if (scene === '组合主产品') expect((saved as SofaCombinationDraft).optionalSizes).toEqual(combination.optionalSizes);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(colors.at(-1)).not.toBe('#ffffff');
    expect(label().x).toBe(originalLabel.x + 35);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    expect(colors.at(-1)).toBe('#ffffff');
    await act(async () => exportButton().click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled(); expect(window.alert).not.toHaveBeenCalled();
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'label-reopen', fileName: 'test.skuwork', draft: saved as unknown as WorkbenchDraft }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'label-reopen', fileName: 'test.skuwork', draft: saved as SofaCombinationDraft }}/>));
    expect(container.querySelector('.dimension-label-controls')).toBeNull();
    await clickDimension(text);
    expect(editor().value).toBe(text.replace('cm', ''));
    const reopened = contexts.get(container.querySelector('canvas')!)!.text.find((item) => item.text === text)!;
    expect(reopened.x).toBeCloseTo(originalLabel.x + 35, 7); expect(reopened.y).toBeCloseTo(originalLabel.y - 20, 7);
    expect(container.querySelector('.dimension-label-colors button[aria-pressed="true"]')!.textContent).toBe('白色');
    await keys(editor(), 'Escape');
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
    await act(async () => toggle().click());
    await clickCanvas(20, 20);
    expect(container.querySelector('.dimension-label-controls')).toBeNull();
    expect(container.querySelector('.dimension-label-drag')).toBeNull();
    await clickDimension(text); expect(editor()).not.toBeNull();
  });

  it('文字自由移动到画布边缘时不被裁切，不触发产品适配', async () => {
    await renderScene('单品');
    await clickDimension('240cm'); await keys(editor(), 'Escape');
    const canvas = container.querySelector('canvas')!, originalLine = line();
    const products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const original = { ...contexts.get(canvas)!.text.find((item) => item.text === '240cm')! };
    await act(async () => container.querySelector<HTMLButtonElement>('.dimension-label-move-toggle')!.click());
    const handle = container.querySelector<HTMLButtonElement>('.dimension-label-drag')!;
    await pointer(handle, 'pointerdown', original.x, original.y);
    await pointer(handle, 'pointermove', 99999, -99999);
    await pointer(handle, 'pointerup', 99999, -99999);
    const label = contexts.get(canvas)!.text.find((item) => item.text === '240cm')!;
    expect(label.x).toBeLessThan(1440); expect(label.y).toBeGreaterThan(0);
    await act(async () => container.querySelector<HTMLButtonElement>('.dimension-label-move-toggle')!.click());
    expect(line()).toEqual(originalLine); expect(contexts.get(canvas)!.products).toEqual(products);
    await clickDimension('88cm');
    expect(container.querySelector<HTMLButtonElement>('.dimension-label-move-toggle')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('文字拖动遵循画布缩放，点击不生成历史，Esc、失焦、指针取消均还原预览', async () => {
    await renderScene('单品'); await clickDimension('240cm'); await keys(editor(), 'Escape');
    const canvas = container.querySelector('canvas')!;
    const original = { ...contexts.get(canvas)!.text.find((item) => item.text === '240cm')! };
    const label = () => contexts.get(canvas)!.text.find((item) => item.text === '240cm')!;
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue({ left: 100, top: 50, width: 720, height: 720 } as DOMRect);
    const start = { x: original.x / 2 + 100, y: original.y / 2 + 50 };
    for (const cancel of ['pointercancel', 'lostpointercapture', 'blur', 'Escape']) {
      const toggle = container.querySelector<HTMLButtonElement>('.dimension-label-move-toggle')!;
      if (toggle.getAttribute('aria-pressed') !== 'true') await act(async () => toggle.click());
      const handle = container.querySelector<HTMLButtonElement>('.dimension-label-drag')!;
      await pointer(handle, 'pointerdown', start.x, start.y); await pointer(handle, 'pointerup', start.x, start.y);
      expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
      await pointer(handle, 'pointerdown', start.x, start.y); await pointer(handle, 'pointermove', start.x + 10, start.y - 15);
      expect(label().x).toBeCloseTo(original.x + 20); expect(label().y).toBeCloseTo(original.y - 30);
      if (cancel === 'Escape') await keys(handle, 'Escape');
      else if (cancel === 'blur') await act(async () => window.dispatchEvent(new Event('blur')));
      else await pointer(handle, cancel, start.x + 10, start.y - 15);
      expect(label()).toEqual(original);
      expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
    }
  });

  it.each(scenes)('%s 单击文字选中数值；校验、取消、保存和每次提交独立撤销', async (scene) => {
    await renderScene(scene);
    const old = scene === '组合规格' ? '210' : '240';
    await clickDimension(`${old}cm`);
    expect(document.activeElement).toBe(editor());
    expect(editor().value).toBe(old);
    expect(editor().selectionStart).toBe(0);
    expect(editor().selectionEnd).toBe(old.length);
    await fill(editor(), '-1');
    await keys(editor(), 'Enter');
    expect(editor().getAttribute('aria-invalid')).toBe('true');
    await clickCanvas(20, 20);
    expect(editor()).not.toBeNull();
    expect(editor().value).toBe('-1');
    await keys(editor(), 'Escape');
    expect(editor()).toBeNull();
    await clickDimension(`${old}cm`);
    await fill(editor(), '258.5');
    await keys(editor(), 'Enter');
    expect(editor()).toBeNull();
    const quick = scene === '组合规格' ? '[aria-label="规格 1尺寸（长×宽×高）"]' : '[placeholder="长×宽×高"]';
    expect(container.querySelector<HTMLInputElement>(quick)!.value).toMatch(/^258.5×/);
    expect(inputs()[0].value).toBe('258.5');
    await clickDimension('258.5cm');
    await fill(editor(), '260');
    await clickCanvas(20, 20);
    expect(editor()).toBeNull();
    expect(container.querySelector<HTMLInputElement>(quick)!.value).toMatch(/^260×/);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(container.querySelector<HTMLInputElement>(quick)!.value).toMatch(/^258.5×/);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    expect(container.querySelector<HTMLInputElement>(quick)!.value).toMatch(new RegExp(`^${old}×`));
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    expect(container.querySelector<HTMLInputElement>(quick)!.value).toMatch(/^258.5×/);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    const savedFields = scene === '组合规格' ? (saved as SofaCombinationDraft).optionalSizes[0].dimensionFields : saved.dimensionFields;
    expect(savedFields.length).toBe('258.5');
    if (scene === '组合规格') expect(saved.dimensionFields).toEqual(fields);
  });

  it.each(scenes.flatMap((scene) => ['line', 'endpoint'].map((handle) => ({ scene, handle }))))('$scene 手动文字在拖动 $handle 的预览、松开、撤销和保存恢复后保持原位置', async ({ scene, handle }) => {
    await renderScene(scene);
    const text = scene === '组合规格' ? '210cm' : '240cm';
    const label = () => contexts.get(container.querySelector('canvas')!)!.text.find((item) => item.text === text)!;
    await clickDimension(text); await keys(editor(), 'Escape');
    await act(async () => container.querySelector<HTMLButtonElement>('.dimension-label-move-toggle')!.click());
    const beforeMove = { ...label() }, labelHandle = container.querySelector('.dimension-label-drag')!;
    await pointer(labelHandle, 'pointerdown', beforeMove.x, beforeMove.y);
    await pointer(labelHandle, 'pointermove', beforeMove.x + 45, beforeMove.y - 20);
    await pointer(labelHandle, 'pointerup', beforeMove.x + 45, beforeMove.y - 20);
    const fixed = { ...label() };
    const original = await selectLine(text);
    const lineHandle = container.querySelector(handle === 'line' ? '.dimension-line-drag' : '[aria-label="长标注起点"]')!;
    const start = handle === 'line' ? { x: (original.from.x + original.to.x) / 2, y: (original.from.y + original.to.y) / 2 } : original.from;
    const remainsFixed = () => { expect(label().x).toBeCloseTo(fixed.x, 5); expect(label().y).toBeCloseTo(fixed.y, 5); };
    await pointer(lineHandle, 'pointerdown', start.x, start.y);
    await pointer(lineHandle, 'pointermove', start.x + 18, start.y + 12); remainsFixed();
    await pointer(lineHandle, 'pointerup', start.x + 18, start.y + 12); remainsFixed();
    const moved = line(); expect(moved.from.y).not.toBeCloseTo(original.from.y, 4);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    if (scene === '组合规格') expect(saved.annotations).toEqual(annotations);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click()); remainsFixed();
    await selectLine(text); expect(line().from.y).toBeCloseTo(original.from.y, 5);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click()); remainsFixed();
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'fixed-label-reopen', fileName: 'test.skuwork', draft: saved as unknown as WorkbenchDraft }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'fixed-label-reopen', fileName: 'test.skuwork', draft: saved as SofaCombinationDraft }}/>));
    remainsFixed(); await selectLine(text);
    const arrowHandle = container.querySelector<HTMLButtonElement>('[aria-label="长标注终点"]')!;
    await keys(arrowHandle, 'ArrowRight'); remainsFixed();
    await clickDimension(text); expect(editor().value).toBe(text.replace('cm', ''));
  });

  it('只打开尺寸并确认原值，不产生额外撤销记录', async () => {
    await renderScene('单品');
    await clickDimension('240cm');
    await keys(editor(), 'Enter');
    expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
  });

  const dragCases = scenes.flatMap((scene) => ['长', '宽', '高'].flatMap((label, index) => (['from', 'to'] as const).map((endpoint) => ({ scene, label, index, endpoint }))));
  it.each(scenes)('%s拖动高亮线同时平移两端，保持产品与数值，松开一步撤销且保存重开一致', async (scene) => {
    await renderScene(scene);
    const text = scene === '组合规格' ? '210cm' : '240cm';
    const original = await selectLine(text);
    const canvas = container.querySelector('canvas')!;
    const originalLabel = { ...contexts.get(canvas)!.text.find((item) => item.text === text)! };
    const products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const handle = container.querySelector<SVGLineElement>('.dimension-line-drag')!;
    const start = { x: (original.from.x + original.to.x) / 2, y: (original.from.y + original.to.y) / 2 };
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    vi.mocked(saveDraft).mockClear();
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', start.x, start.y + 6);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(saveDraft).not.toHaveBeenCalled();
    await pointer(handle, 'pointermove', start.x, start.y + 12);
    for (const end of ['from', 'to'] as const) {
      expect(line()[end].x).toBeCloseTo(original[end].x, 5);
      expect(line()[end].y).toBeCloseTo(original[end].y + 12, 5);
    }
    expect(container.textContent).toContain('正在整体移动标注');
    expect(contexts.get(canvas)!.products).toEqual(products);
    await pointer(handle, 'pointerup', start.x, start.y + 12);
    const moved = line();
    expect(contexts.get(canvas)!.text.find((item) => item.text === text)!.y).toBeCloseTo(originalLabel.y + 12, 5);
    for (const end of ['from', 'to'] as const) expect(moved[end].y).toBeCloseTo(original[end].y + 12, 5);
    contexts.get(canvas)!.products.forEach((rect, i) => rect.forEach((value, j) => expect(value).toBeCloseTo(products[i][j], 5)));
    expect(inputs()[0].value).toBe(text.replace('cm', ''));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    const stored = scene === '组合规格' ? (saved as SofaCombinationDraft).optionalSizes[0].annotations : saved.annotations;
    const originalAnnotations = scene === '组合规格' ? combination.optionalSizes[0].annotations : single.annotations;
    stored.slice(1).forEach((annotation, index) => {
      const before = originalAnnotations[index + 1];
      expect(annotation.kind).toBe(before.kind); expect(annotation.value).toBe(before.value);
      for (const end of ['from', 'to'] as const) {
        expect(annotation[end].x).toBeCloseTo(before[end].x, 8);
        expect(annotation[end].y).toBeCloseTo(before[end].y, 8);
      }
    });
    if (scene === '组合规格') expect(saved.annotations).toEqual(combination.annotations);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    await selectLine(text);
    for (const end of ['from', 'to'] as const) expect(line()[end].y).toBeCloseTo(original[end].y, 5);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    await selectLine(text);
    for (const end of ['from', 'to'] as const) expect(line()[end].y).toBeCloseTo(moved[end].y, 5);
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'line-reopen', fileName: 'test.skuwork', draft: saved as unknown as WorkbenchDraft }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'line-reopen', fileName: 'test.skuwork', draft: saved as SofaCombinationDraft }}/>));
    await selectLine(text);
    for (const end of ['from', 'to'] as const) expect(line()[end].y).toBeCloseTo(moved[end].y, 5);
    await act(async () => exportButton().click());
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.95);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it.each(['Escape', 'pointercancel', 'lostpointercapture', 'blur'])('整线缩放坐标正确，%s取消完整位移，不保存也不产生撤销记录', async (cancel) => {
    await renderScene('单品');
    const original = await selectLine('240cm');
    const handle = container.querySelector<SVGLineElement>('.dimension-line-drag')!;
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue({ left: 100, top: 50, width: 720, height: 720 } as DOMRect);
    const start = { x: (original.from.x + original.to.x) / 4 + 100, y: (original.from.y + original.to.y) / 4 + 50 };
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', start.x + 10, start.y + 5);
    for (const end of ['from', 'to'] as const) {
      expect(line()[end].x).toBeCloseTo(original[end].x + 20, 5);
      expect(line()[end].y).toBeCloseTo(original[end].y + 10, 5);
    }
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })));
    for (const end of ['from', 'to'] as const) expect(line()[end].y).toBeCloseTo(original[end].y, 5);
    await act(async () => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', shiftKey: false })));
    for (const end of ['from', 'to'] as const) expect(line()[end].y).toBeCloseTo(original[end].y + 10, 5);
    await act(async () => {
      if (cancel === 'Escape') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      else if (cancel === 'blur') window.dispatchEvent(new Event('blur'));
      else handle.dispatchEvent(new MouseEvent(cancel, { bubbles: true }));
    });
    expect(line()).toEqual(original);
    await pointer(handle, 'pointerup', start.x + 10, start.y + 5);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
    await act(async () => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true, bubbles: true })));
    for (const end of ['from', 'to'] as const) expect(line()[end].y).toBeCloseTo(original[end].y + 10, 5);
  });

  it.each(dragCases)('$scene 的$label $endpoint可拖动；产品和另一端固定，保存重开不跳动，整次拖动仅一步撤销', async ({ scene, index, endpoint, label }) => {
    await renderScene(scene);
    const text = `${(scene === '组合规格' ? [210, 80, 90] : [240, 88, 100])[index]}cm`;
    const original = await selectLine(text);
    const canvas = container.querySelector('canvas')!;
    const products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const handle = container.querySelector<HTMLButtonElement>(`[aria-label="${label}标注${endpoint === 'from' ? '起点' : '终点'}"]`)!;
    const start = original[endpoint];
    const dx = index === 0 && endpoint === 'to' ? -18 : 18;
    const dy = index === 0 || (index === 2 && endpoint === 'from') ? 18 : -18;
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', start.x + dx, start.y + dy);
    expect(line()[endpoint].x).not.toBeCloseTo(start.x, 4);
    expect(line()[endpoint === 'from' ? 'to' : 'from']).toEqual(original[endpoint === 'from' ? 'to' : 'from']);
    expect(contexts.get(canvas)!.products).toEqual(products);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    await pointer(handle, 'pointermove', start.x + dx * 2, start.y + dy * 2);
    const moved = line();
    await pointer(handle, 'pointerup', start.x + dx * 2, start.y + dy * 2);
    for (const end of ['from', 'to'] as const) {
      expect(line()[end].x).toBeCloseTo(moved[end].x, 5);
      expect(line()[end].y).toBeCloseTo(moved[end].y, 5);
    }
    contexts.get(canvas)!.products.forEach((rect, i) => rect.forEach((value, j) => expect(value).toBeCloseTo(products[i][j], 5)));
    expect(inputs()[index].value).toBe(text.replace('cm', ''));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    await act(async () => exportButton().click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    await selectLine(text);
    expect(line().from.x).toBeCloseTo(original.from.x, 5);
    expect(line().from.y).toBeCloseTo(original.from.y, 5);
    expect(line().to.x).toBeCloseTo(original.to.x, 5);
    expect(line().to.y).toBeCloseTo(original.to.y, 5);
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'reopen-single', fileName: 'test.skuwork', draft: saved as unknown as WorkbenchDraft }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'reopen-combo', fileName: 'test.skuwork', draft: saved as SofaCombinationDraft }}/>));
    await selectLine(text);
    expect(line().from.x).toBeCloseTo(moved.from.x, 5);
    expect(line().from.y).toBeCloseTo(moved.from.y, 5);
    expect(line().to.x).toBeCloseTo(moved.to.x, 5);
    expect(line().to.y).toBeCloseTo(moved.to.y, 5);
  });

  it.each([{ kind: 'standard', count: 2 }, { kind: 'functional', count: 3 }, { kind: 'standard', count: 4 }] as const)('$kind $count 个规格：顶部左端点可上移到空白处，松开、保存重开和撤销均不带动产品或另一端', async ({ kind, count }) => {
    const item = { ...combination.optionalSizes[0], dimensionFields: { length: '839', width: '', height: '' },
      annotations: [{ ...annotations[0], value: 839, from: { x: 0, y: 0 }, to: { x: .65, y: -.12 } }] };
    const draft = { ...combination, kind, optionalSizes: Array.from({ length: count }, (_, index) => index === (count === 4 ? 1 : 0)
      ? item : { ...combination.optionalSizes[0], id: `other-spec-${index}` }) };
    await act(async () => root.render(<SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'endpoint-top', fileName: 'test.skuwork', draft }}/>));
    const original = await selectLine('839cm');
    const canvas = container.querySelector('canvas')!;
    const products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="长标注起点"]')!;
    await pointer(handle, 'pointerdown', original.from.x, original.from.y);
    await pointer(handle, 'pointermove', original.from.x, original.from.y - 12);
    expect(line().from.y).toBeCloseTo(original.from.y - 12, 4);
    expect(line().to).toEqual(original.to);
    await pointer(handle, 'pointerup', original.from.x, original.from.y - 12);
    const moved = line();
    expect(moved.from.y).toBeCloseTo(original.from.y - 12, 4);
    contexts.get(canvas)!.products.forEach((rect, i) => rect.forEach((value, j) => expect(value).toBeCloseTo(products[i][j], 4)));
    expect(moved.to.x).toBeCloseTo(original.to.x, 4);
    expect(moved.to.y).toBeCloseTo(original.to.y, 4);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0] as SofaCombinationDraft;
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    await selectLine('839cm');
    expect(line().from.y).toBeCloseTo(original.from.y, 4);
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'endpoint-top', fileName: 'test.skuwork', draft: saved }}/>));
    await selectLine('839cm');
    expect(line().from.y).toBeCloseTo(moved.from.y, 4);
    expect(line().to.x).toBeCloseTo(original.to.x, 4);
    expect(line().to.y).toBeCloseTo(original.to.y, 4);
    contexts.get(container.querySelector('canvas')!)!.products.forEach((rect, i) => rect.forEach((value, j) => expect(value).toBeCloseTo(products[i][j], 4)));
    const reopenedCanvas = container.querySelector('canvas')!;
    const reopenedHandle = container.querySelector<HTMLButtonElement>('[aria-label="长标注起点"]')!;
    await pointer(reopenedHandle, 'pointerdown', moved.from.x, moved.from.y);
    await pointer(reopenedHandle, 'pointermove', moved.from.x, moved.from.y - 500);
    expect(container.textContent).toContain('松开后整体适配安全范围');
    expect(line().from.y).toBeCloseTo(moved.from.y - 500, 5);
    expect(line().to).toEqual(moved.to);
    contexts.get(reopenedCanvas)!.products.forEach((rect, i) => rect.forEach((value, j) => expect(value).toBeCloseTo(products[i][j], 4)));
    await pointer(reopenedHandle, 'pointercancel', moved.from.x, moved.from.y - 500);
  });

  it('缩放后的画布坐标、越界预览、Esc 及指针取消、方向键微调', async () => {
    await renderScene('单品');
    const original = await selectLine('240cm');
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="长标注起点"]')!;
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockReturnValue({ left: 100, top: 50, width: 720, height: 720 } as DOMRect);
    const start = { x: original.from.x / 2 + 100, y: original.from.y / 2 + 50 };
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', start.x + 10, start.y + 10);
    expect(line().from.x).toBeCloseTo(original.from.x + 20, 5);
    expect(line().from.y).toBeCloseTo(original.from.y + 20, 5);
    await keys(handle, 'Escape');
    expect(line()).toEqual(original);
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', -1000, -1000);
    expect(line().from).toEqual({ x: -2200, y: -2100 });
    expect(container.textContent).toContain('松开后整体适配安全范围');
    await pointer(handle, 'pointercancel', -1000, -1000);
    expect(line()).toEqual(original);
    await keys(handle, 'ArrowRight');
    expect(line().from.x).toBeCloseTo(original.from.x + 1, 5);
    expect(line().to.x).toBeCloseTo(original.to.x, 5);
  });

  it.each(['单品', '书椅97px', '组合主产品', '组合规格'])('%s端点越界跟手，松开后整体缩放，撤销重做及重开保持一致', async (scene) => {
    const office = scene === '书椅97px';
    const singleScene = scene === '单品' || office;
    const templateId = office ? 'office-chair-single' : 'sofa-single';
    if (office) await act(async () => root.render(<SingleWorkbench templateId={templateId} onBack={() => undefined} initialProject={{ projectId: 'office-gap', fileName: 'test.skuwork', draft: { ...single, officeChair: { sellingPointCount: 3, dimensionGap: 97 } } as WorkbenchDraft }}/>));
    else await renderScene(scene);
    const text = office ? '总长240cm' : scene === '组合规格' ? '210cm' : '240cm';
    const original = await selectLine(text);
    const canvas = container.querySelector('canvas')!;
    const products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const productIndex = scene === '组合规格' ? 1 : 0;
    const product = products[productIndex];
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="长标注起点"]')!;
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    const saves = vi.mocked(saveDraft).mock.calls.length;
    const desired = { x: original.from.x - 1500, y: original.from.y + 1600 };
    await pointer(handle, 'pointerdown', original.from.x, original.from.y);
    await pointer(handle, 'pointermove', desired.x, desired.y);
    expect(line().from).toEqual(desired);
    expect(line().to).toEqual(original.to);
    expect(contexts.get(canvas)!.products).toEqual(products);
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(vi.mocked(saveDraft).mock.calls).toHaveLength(saves);
    await pointer(handle, 'pointerup', desired.x, desired.y);
    const fittedLine = line();
    const fittedProducts = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const fitted = fittedProducts[productIndex];
    const scale = fitted[2] / product[2];
    expect(scale).toBeLessThan(1);
    expect(fitted[3] / product[3]).toBeCloseTo(scale, 5);
    for (const end of ['from', 'to'] as const) {
      const point = end === 'from' ? desired : original.to;
      expect(fittedLine[end].x - fitted[0]).toBeCloseTo((point.x - product[0]) * scale, 4);
      expect(fittedLine[end].y - fitted[1]).toBeCloseTo((point.y - product[1]) * scale, 4);
    }
    fittedProducts.forEach((rect, i) => { if (i !== productIndex) rect.forEach((v, j) => expect(v).toBeCloseTo(products[i][j], 4)); });
    if (office) {
      expect(fitted[1] + fitted[3]).toBeLessThanOrEqual(1210 - 2 - 97 + .01);
      expect(Number(container.querySelector<HTMLInputElement>('input[type="range"]')!.value)).toBe(97);
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    const saved = vi.mocked(saveDraft).mock.lastCall![0];
    const savedAnnotations = scene === '组合规格' ? (saved as SofaCombinationDraft).optionalSizes[0].annotations : saved.annotations;
    expect(savedAnnotations[0].from.x).toBeCloseTo((desired.x - product[0]) / product[2], 5);
    expect(savedAnnotations[0].from.y).toBeCloseTo((desired.y - product[1]) / product[3], 5);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    await selectLine(text);
    expect(line().from.x).toBeCloseTo(original.from.x, 5);
    expect(line().from.y).toBeCloseTo(original.from.y, 5);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="重做"]')!.click());
    await selectLine(text);
    expect(line().from.x).toBeCloseTo(fittedLine.from.x, 5);
    expect(line().from.y).toBeCloseTo(fittedLine.from.y, 5);
    await act(async () => root.unmount()); root = createRoot(container);
    await act(async () => root.render(singleScene
      ? <SingleWorkbench templateId={templateId} onBack={() => undefined} initialProject={{ projectId: 'reopen-fit', fileName: 'test.skuwork', draft: saved as unknown as WorkbenchDraft }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'reopen-fit', fileName: 'test.skuwork', draft: saved as SofaCombinationDraft }}/>));
    await selectLine(text);
    for (const end of ['from', 'to'] as const) {
      expect(line()[end].x).toBeCloseTo(fittedLine[end].x, 5);
      expect(line()[end].y).toBeCloseTo(fittedLine[end].y, 5);
    }
  });

  it.each(scenes.flatMap((scene) => ['move', 'scale'].map((mode) => ({ scene, mode }))))('$scene产品$mode只在松手后适配，预览不存草稿，取消恢复，整次操作一步撤销', async ({ scene, mode }) => {
    const smaller = { ...adjustment, scale: .6 };
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'product-preview', fileName: 'test.skuwork', draft: { ...single, subjectAdjustment: smaller } }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'product-preview', fileName: 'test.skuwork', draft: { ...combination, subjectAdjustment: smaller, optionalSizes: combination.optionalSizes.map((item) => ({ ...item, adjustment: smaller })) } }}/>));
    const canvas = container.querySelector('canvas')!;
    const products = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const index = scene === '组合规格' ? 1 : 0;
    const [x, y, w, h] = products[index];
    await clickCanvas(x + w / 2, y + h / 2);
    const handle = mode === 'move' ? canvas : container.querySelector('[aria-label="等比例缩放 se"]')!;
    const start = mode === 'move' ? { x: x + w / 2, y: y + h / 2 } : { x: x + w, y: y + h };
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    const saves = vi.mocked(saveDraft).mock.calls.length;
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', start.x + 1500, start.y + 1600);
    const preview = contexts.get(canvas)!.products[index];
    if (mode === 'move') { expect(preview[0]).toBeCloseTo(x + 1500, 5); expect(preview[1]).toBeCloseTo(y + 1600, 5); }
    else { expect(preview[2]).toBeGreaterThan(w * 2); expect(preview[2] / w).toBeCloseTo(preview[3] / h, 5); }
    contexts.get(canvas)!.products.forEach((rect, i) => { if (i !== index) rect.forEach((v, j) => expect(v).toBeCloseTo(products[i][j], 4)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(650); });
    expect(vi.mocked(saveDraft).mock.calls).toHaveLength(saves);
    await keys(handle as HTMLElement, 'Escape');
    contexts.get(canvas)!.products.forEach((rect, i) => rect.forEach((v, j) => expect(v).toBeCloseTo(products[i][j], 4)));
    await pointer(handle, 'pointerdown', start.x, start.y);
    await pointer(handle, 'pointermove', start.x + 1500, start.y + 1600);
    await pointer(handle, 'pointerup', start.x + 1500, start.y + 1600);
    const fitted = contexts.get(canvas)!.products[index];
    expect(fitted[0]).toBeGreaterThanOrEqual(0);
    expect(fitted[1]).toBeGreaterThanOrEqual(0);
    expect(fitted[0] + fitted[2]).toBeLessThanOrEqual(1440);
    expect(fitted[1] + fitted[3]).toBeLessThanOrEqual(1440);
    expect(fitted[2] / w).toBeCloseTo(fitted[3] / h, 5);
    expect(fitted).not.toEqual(preview);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.click());
    contexts.get(canvas)!.products.forEach((rect, i) => rect.forEach((v, j) => expect(v).toBeCloseTo(products[i][j], 4)));
  });
});


describe('缩放视图与编辑互不影响', () => {
  it.each(['单品', '组合'])('%s缩放不更改项目或导出分辨率，缩放与滚动后仍能点击文字并拖动端点', async (scene) => {
    await act(async () => root.render(scene === '单品'
      ? <SingleWorkbench onBack={() => undefined} initialProject={{ projectId: 'zoom-single', fileName: 'test.skuwork', draft: single }}/>
      : <SofaCombinationWorkbench onBack={() => undefined} initialProject={{ projectId: 'zoom-combination', fileName: 'test.skuwork', draft: combination }}/>));
    const canvas = container.querySelector('canvas')!;
    const size = () => parseFloat(container.querySelector<HTMLElement>('.canvas-viewport-content')!.style.getPropertyValue('--canvas-display-size'));
    const fitSize = size();
    const originalProducts = contexts.get(canvas)!.products.map((rect) => [...rect]);
    const originalLabels = [...contexts.get(canvas)!.text];
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="放大画布"]')!.click());
    expect(size()).toBeGreaterThan(fitSize);
    const viewport = container.querySelector('.canvas-viewport')!;
    vi.mocked(HTMLCanvasElement.prototype.getBoundingClientRect).mockImplementation(() => ({ left: -40, top: -80, right: size() - 40, bottom: size() - 80, width: size(), height: size() } as DOMRect));
    const wheel = new WheelEvent('wheel', { altKey: true, deltaY: -100, clientX: 300, clientY: 250, bubbles: true, cancelable: true });
    await act(async () => canvas.dispatchEvent(wheel));
    expect(wheel.defaultPrevented).toBe(true);
    expect(contexts.get(canvas)!.products).toEqual(originalProducts);
    expect(contexts.get(canvas)!.text).toEqual(originalLabels);
    expect(container.querySelector<HTMLButtonElement>('[aria-label="撤销"]')!.disabled).toBe(true);
    const label = contexts.get(canvas)!.text.find((item) => item.text === '240cm')!;
    await clickCanvas(label.x / 1440 * size() - 40, label.y / 1440 * size() - 80);
    const input = container.querySelector<HTMLInputElement>('.canvas-dimension-input input')!;
    expect(document.activeElement).toBe(input);
    await fill(input, '260');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(container.querySelector<HTMLInputElement>('[placeholder="长×宽×高"]')!.value).toBe('260×88×100');
    const line = () => container.querySelector('.dimension-line-selection line')!;
    const start = { x: Number(line().getAttribute('x1')), y: Number(line().getAttribute('y1')) };
    const end = { x: Number(line().getAttribute('x2')), y: Number(line().getAttribute('y2')) };
    const handle = container.querySelector<HTMLButtonElement>('[aria-label="长标注起点"]')!;
    const x = start.x / 1440 * size() - 40, y = start.y / 1440 * size() - 80;
    await act(async () => handle.dispatchEvent(new MouseEvent('pointerdown', { clientX: x, clientY: y, bubbles: true })));
    await act(async () => handle.dispatchEvent(new MouseEvent('pointermove', { clientX: x + 12 / 1440 * size(), clientY: y + 12 / 1440 * size(), bubbles: true })));
    await act(async () => handle.dispatchEvent(new MouseEvent('pointerup', { clientX: x + 12 / 1440 * size(), clientY: y + 12 / 1440 * size(), bubbles: true })));
    expect(Number(line().getAttribute('x1'))).toBeCloseTo(start.x + 12, 5);
    expect(Number(line().getAttribute('y1'))).toBeCloseTo(start.y + 12, 5);
    expect(Number(line().getAttribute('x2'))).toBeCloseTo(end.x, 5);
    expect(Number(line().getAttribute('y2'))).toBeCloseTo(end.y, 5);
    await act(async () => exportButton().click());
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    for (const output of contexts.keys()) { expect(output.width).toBe(1440); expect(output.height).toBe(1440); }
    expect(viewport.contains(canvas)).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="画布自适应"]')!.click());
    expect(size()).toBe(fitSize);
  });
});
