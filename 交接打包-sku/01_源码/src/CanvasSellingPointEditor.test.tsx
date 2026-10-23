// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { CanvasSellingPointEditor } from './CanvasSellingPointEditor';
import { getSofaSingleLayout } from './domain/sofaSingleLayout';

describe('画布卖点编辑', () => {
  it('三个入口独立编辑并同步共享数据，不触发画布点击和拖动', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onCanvasClick = vi.fn();
    const onCanvasPointerDown = vi.fn();
    function Editor() {
      const [points, setPoints] = useState(['柔软', '', '耐用']);
      return <div onClick={onCanvasClick} onPointerDown={onCanvasPointerDown}>
        {getSofaSingleLayout([100, 0, 100]).sellingPoints.map((box, index) => <CanvasSellingPointEditor
          key={index} box={box} index={index} value={points[index]}
          onChange={(value) => setPoints((current) => current.map((point, i) => i === index ? value : point))}
        />)}
        <output>{points.join('|')}</output>
      </div>;
    }
    await act(async () => root.render(<Editor/>));
    const inputs = container.querySelectorAll('input');
    expect(inputs).toHaveLength(3);
    const input = inputs[1];
    expect(input.getAttribute('aria-label')).toBe('画布卖点 2');
    expect(input.placeholder).toBe('卖点 2');
    expect(input.maxLength).toBe(14);
    await act(async () => {
      input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      input.click();
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '舒适');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('output')?.textContent).toBe('柔软|舒适|耐用');
    expect(input.value).toBe('舒适');
    expect(onCanvasClick).not.toHaveBeenCalled();
    expect(onCanvasPointerDown).not.toHaveBeenCalled();
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    expect(document.activeElement).toBe(input);
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(document.activeElement).not.toBe(input);
    input.focus();
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.activeElement).not.toBe(input);
    expect(container.querySelector('output')?.textContent).toBe('柔软|舒适|耐用');
    await act(async () => root.unmount());
    container.remove();
  });
});
