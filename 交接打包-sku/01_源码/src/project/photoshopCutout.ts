import { desktopCall, isDesktop } from '../desktop/runtime';

export async function photoshopCutout(blob: Blob, signal?: AbortSignal): Promise<Blob> {
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  if (isDesktop()) {
    const contents = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(blob);
    });
    const result = await desktopCall<ArrayBuffer>('cutout_image', { contents });
    if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
    return new Blob([result], { type: 'image/png' });
  }
  const response = await fetch('/__skuwork/cutout', { method: 'POST', headers: { 'Content-Type': blob.type, 'X-Skuwork-Cutout': '1' }, body: blob, signal });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/png')) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || '请使用本机 SKU 工作台导入白底图，并确认已安装 Photoshop 2020 或更高版本');
  }
  return response.blob();
}
