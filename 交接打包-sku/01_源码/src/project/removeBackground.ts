export function removeBackground(blob: Blob, onProgress?: (message: string) => void, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('已取消', 'AbortError')); return; }
    const worker = new Worker(new URL('./removeBackground.worker.ts', import.meta.url), { type: 'module' });
    const stop = () => { worker.terminate(); signal?.removeEventListener('abort', cancel); clearTimeout(timeout); };
    const cancel = () => { stop(); reject(new DOMException('已取消', 'AbortError')); };
    const timeout = setTimeout(() => { stop(); reject(new Error('抠图耗时过长，请缩小图片后重试，或导入透明 PNG')); }, 180_000);
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ status?: string; blob?: Blob; error?: string }>) => {
      if (data.status) onProgress?.(data.status);
      else if (data.blob) { stop(); resolve(data.blob); }
      else { stop(); reject(new Error(data.error || '抠图失败，请重试或导入透明 PNG')); }
    };
    worker.onerror = (event) => { event.preventDefault(); stop(); reject(new Error('本机抠图未能启动，请重试或导入透明 PNG')); };
    worker.postMessage({ blob, modelUrl: new URL(`${import.meta.env.BASE_URL}models/cutout/u2net.onnx`, location.href).href });
  });
}
