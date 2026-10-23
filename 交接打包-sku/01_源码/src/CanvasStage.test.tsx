// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasStage } from './CanvasStage';

let container: HTMLDivElement, root: Root;
let width: number, height: number, resize: () => void;
const size = () => parseFloat(container.querySelector<HTMLElement>('.canvas-viewport-content')!.style.getPropertyValue('--canvas-display-size'));
const view = () => container.querySelector<HTMLDivElement>('.canvas-viewport')!;
const canvas = () => container.querySelector('canvas')!;
const button = (label: string) => container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
const click = async (label: string) => act(async () => button(label).click());
const rect = (x: number, y: number, width: number, height: number) => ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) }) as DOMRect;

beforeEach(async () => {
  width = 800; height = 600;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resize = callback; }
    observe() {} disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('canvas-viewport') ? width : 0; });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('canvas-viewport') ? height : 0; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('canvas-viewport')) return rect(100, 50, width, height);
    if (this.tagName === 'CANVAS') return rect(100 + Math.max(12, (width - size()) / 2) - view().scrollLeft,
      50 + Math.max(12, (height - size()) / 2) - view().scrollTop, size(), size());
    return rect(0, 0, 0, 0);
  });
  await act(async () => root.render(<CanvasStage title="成品画布" status="编辑中"><div className="canvas-wrap"><canvas width="1440" height="1440"/><input aria-label="画布文字"/></div></CanvasStage>));
  let left = 0, top = 0;
  Object.defineProperty(view(), 'scrollLeft', { get: () => left, set: (value) => { left = Math.max(0, Math.min(size() + 24 - width, value)); } });
  Object.defineProperty(view(), 'scrollTop', { get: () => top, set: (value) => { top = Math.max(0, Math.min(size() + 24 - height, value)); } });
});

afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function wheel(options: WheelEventInit, target: Element = canvas()) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 500, clientY: 350, ...options });
  await act(async () => target.dispatchEvent(event));
  return event;
}

describe('画布查看缩放', () => {
  it('按钮放大、缩小及范围限位，点击自适应恢复完整视图', async () => {
    expect(size()).toBe(576);
    expect(button('画布自适应').textContent).toBe('自适应');
    await click('放大画布');
    expect(size()).toBeCloseTo(691.2);
    expect(button('画布自适应').textContent).toBe('48%');
    await click('缩小画布');
    expect(size()).toBeCloseTo(576);
    for (let i = 0; i < 20; i += 1) await click('放大画布');
    expect(size()).toBe(4320);
    expect(button('放大画布').disabled).toBe(true);
    for (let i = 0; i < 25; i += 1) await click('缩小画布');
    expect(size()).toBe(144);
    expect(button('缩小画布').disabled).toBe(true);
    await click('画布自适应');
    expect(size()).toBe(576);
    expect(button('画布自适应').textContent).toBe('自适应');
    expect(canvas().width).toBe(1440);
    expect(canvas().height).toBe(1440);
  });

  it('仅拦截画布内的 Alt 滚轮，普通滚动及画布外滚轮照常工作', async () => {
    expect((await wheel({ deltaY: -120 })).defaultPrevented).toBe(false);
    expect((await wheel({ deltaY: -120, altKey: true, clientX: 105, clientY: 55 }, view())).defaultPrevented).toBe(false);
    expect(size()).toBe(576);
    expect((await wheel({ deltaY: -120, altKey: true }, container.querySelector('input')!)).defaultPrevented).toBe(true);
    expect(size()).toBeGreaterThan(576);
    await wheel({ deltaY: 120, altKey: true });
    expect(size()).toBeCloseTo(576);
    await wheel({ deltaY: -3, deltaMode: 1, altKey: true });
    const lineModeSize = size();
    await click('画布自适应');
    await wheel({ deltaY: -48, deltaMode: 0, altKey: true });
    expect(size()).toBeCloseTo(lineModeSize);
  });

  it('放大后围绕鼠标位置缩放，滚动条保留可查看的画布范围', async () => {
    await click('放大画布'); await click('放大画布');
    view().scrollLeft = 20; view().scrollTop = 90;
    const before = canvas().getBoundingClientRect();
    const point = { x: (500 - before.left) / before.width, y: (350 - before.top) / before.height };
    await wheel({ deltaY: -80, altKey: true });
    const after = canvas().getBoundingClientRect();
    expect(after.left + point.x * after.width).toBeCloseTo(500, 5);
    expect(after.top + point.y * after.height).toBeCloseTo(350, 5);
    expect(view().scrollLeft).toBeGreaterThan(20);
    expect(view().scrollTop).toBeGreaterThan(90);
    await click('画布自适应');
    expect(view().scrollLeft).toBe(0);
    expect(view().scrollTop).toBe(0);
  });

  it('自适应跟随窗口尺寸，手动缩放保持比例，再次自适应采用新尺寸', async () => {
    width = 500; height = 450;
    await act(async () => resize());
    expect(size()).toBe(426);
    await click('放大画布');
    const manualSize = size();
    width = 1000; height = 900;
    await act(async () => resize());
    expect(size()).toBe(manualSize);
    await click('画布自适应');
    expect(size()).toBe(736);
  });
});
