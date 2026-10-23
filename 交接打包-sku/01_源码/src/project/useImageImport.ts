import { useEffect, useRef, useState } from 'react';
import { productImageFromBlob, type ProductImage } from './productImage';

export function useImageImport() {
  const current = useRef<AbortController | undefined>(undefined);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  useEffect(() => () => current.current?.abort(), []);
  function cancel() {
    current.current?.abort(); current.current = undefined;
    setStatus(''); setError('');
  }
  async function run(file: File, apply: (image: ProductImage) => void, removeWhiteBackground = true) {
    cancel();
    const controller = new AbortController(); current.current = controller;
    setStatus('正在读取图片…');
    try {
      const image = await productImageFromBlob(file, file.name, {
        removeWhiteBackground, signal: controller.signal,
        onProgress: (message) => { if (!controller.signal.aborted) setStatus(message); },
      });
      if (!controller.signal.aborted) apply(image);
    } catch (reason) {
      if (!controller.signal.aborted) setError(`产品图读取失败：${reason instanceof Error ? reason.message : '请重试'}`);
    } finally {
      if (current.current === controller) { current.current = undefined; setStatus(''); }
    }
  }
  return { run, cancel, status, error, busy: Boolean(status) };
}
