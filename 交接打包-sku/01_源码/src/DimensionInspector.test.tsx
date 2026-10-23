// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DimensionInspector } from './DimensionInspector';
import type { DimensionKind } from './domain/dimensionAnnotations';

describe('长宽高微调区块', () => {
  it('软床可按模板展示四项，床头和床尾保留独立标注入口', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const annotate = vi.fn();
    await act(async () => root.render(<DimensionInspector title="软床" fields={{ length: '223', width: '', height: '118', headWidth: '168/198', footWidth: '183/193' }}
      kinds={['length', 'headWidth', 'footWidth', 'height']} activeKind="headWidth" annotations={[]} hasImage
      onSelect={() => undefined} onChange={() => undefined} onAnnotate={annotate} onCancel={() => undefined}/>));
    const cards = container.querySelectorAll('.dimension-card');
    expect(cards).toHaveLength(4);
    expect(cards[1].getAttribute('aria-label')).toBe('床头宽尺寸微调');
    await act(async () => cards[2].querySelector('button')!.click());
    expect(annotate).toHaveBeenCalledWith('footWidth');
    await act(async () => root.unmount());
  });
  it('始终展示三个区块，点击或键盘聚焦切换高亮，并独立更新数值', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const annotate = vi.fn();
    function Inspector() {
      const [active, setActive] = useState<DimensionKind>('length');
      const [fields, setFields] = useState({ length: '240', width: '88', height: '100' });
      return <DimensionInspector title="规格 2" fields={fields} annotations={[]} activeKind={active} hasImage
        onSelect={setActive} onChange={(kind, value) => setFields((current) => ({ ...current, [kind]: value }))}
        onAnnotate={annotate} onCancel={() => undefined}/>;
    }
    await act(async () => root.render(<Inspector/>));
    const cards = container.querySelectorAll<HTMLElement>('.dimension-card');
    expect(cards).toHaveLength(3);
    expect(cards[0].classList.contains('active')).toBe(true);
    expect(cards[0].querySelector('label')!.control).toBe(cards[0].querySelector('input'));
    expect(cards[0].querySelector('.dimension-state')?.getAttribute('aria-label')).toBe('当前编辑');
    expect(container.querySelectorAll('.dimension-state')).toHaveLength(1);
    await act(async () => cards[1].click());
    expect(cards[1].classList.contains('active')).toBe(true);
    expect(cards[0].classList.contains('active')).toBe(false);
    expect(cards[0].querySelector('.dimension-state')).toBeNull();
    expect(cards[1].querySelector('.dimension-state')?.getAttribute('aria-label')).toBe('当前编辑');
    const width = cards[1].querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(width, '90');
      width.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(Array.from(container.querySelectorAll('input'), (input) => input.value)).toEqual(['240', '90', '100']);
    await act(async () => cards[2].querySelector('input')!.focus());
    expect(cards[2].classList.contains('active')).toBe(true);
    expect(container.querySelectorAll('.dimension-card.active')).toHaveLength(1);
    await act(async () => cards[2].querySelector('button')!.click());
    expect(annotate).toHaveBeenCalledWith('height');
    expect(container.textContent).toContain('规格 2');
    await act(async () => root.unmount());
    container.remove();
  });
});
