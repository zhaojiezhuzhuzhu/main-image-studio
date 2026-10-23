// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useImageImport } from './useImageImport';
import { productImageFromBlob, type ProductImage } from './productImage';

vi.mock('./productImage', () => ({ productImageFromBlob: vi.fn() }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.resetAllMocks());

it('取消、换图和离开后，迟到的结果不能覆盖当前现场', async () => {
  let state!: ReturnType<typeof useImageImport>;
  const pending: Array<(value: ProductImage) => void> = [];
  vi.mocked(productImageFromBlob).mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  function Harness() { state = useImageImport(); return null; }
  const root = createRoot(document.createElement('div')), apply = vi.fn();
  await act(async () => root.render(<Harness/>));
  const file = new File(['jpg'], 'bed.jpg', { type: 'image/jpeg' });
  const old = { name: 'old.png' } as ProductImage, current = { name: 'current.png' } as ProductImage;
  await act(async () => { void state.run(file, apply); });
  expect(state.busy).toBe(true);
  await act(async () => { void state.run(file, apply); });
  await act(async () => pending[0](old));
  expect(apply).not.toHaveBeenCalled();
  expect(state.busy).toBe(true);
  await act(async () => pending[1](current));
  expect(apply).toHaveBeenCalledExactlyOnceWith(current);
  await act(async () => { void state.run(file, apply); state.cancel(); });
  await act(async () => pending[2](old));
  expect(apply).toHaveBeenCalledTimes(1);
  expect(state.busy).toBe(false);
  await act(async () => { void state.run(file, apply); });
  await act(async () => root.unmount());
  await act(async () => pending[3](old));
  expect(apply).toHaveBeenCalledTimes(1);
});

it('失败不提交图片，允许重试；细节图明确跳过抠图', async () => {
  let state!: ReturnType<typeof useImageImport>;
  function Harness() { state = useImageImport(); return null; }
  const root = createRoot(document.createElement('div')), apply = vi.fn();
  await act(async () => root.render(<Harness/>));
  try {
    vi.mocked(productImageFromBlob).mockRejectedValueOnce(new Error('模型未就绪'));
    const file = new File(['jpg'], 'detail.jpg', { type: 'image/jpeg' });
    await act(async () => state.run(file, apply));
    expect(state.error).toContain('模型未就绪');
    expect(apply).not.toHaveBeenCalled();
    expect(state.busy).toBe(false);
    vi.mocked(productImageFromBlob).mockResolvedValueOnce({ name: 'detail.jpg' } as ProductImage);
    await act(async () => state.run(file, apply, false));
    expect(productImageFromBlob).toHaveBeenLastCalledWith(file, file.name, expect.objectContaining({ removeWhiteBackground: false }));
    expect(state.error).toBe('');
    expect(apply).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); }
});
