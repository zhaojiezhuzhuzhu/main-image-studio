import { alphaBounds } from '../domain/alphaBounds';
import { silhouetteFromAlpha, type ProductSilhouette } from '../domain/annotatedProductFit';
import type { Rect } from '../domain/dimensionGeometry';
import { hasTransparency, hasWhiteBackground } from './whiteBackground';

export type ImageImportOptions = {
  removeWhiteBackground: boolean;
  engine?: 'photoshop' | 'model';
  onProgress?: (message: string) => void;
  signal?: AbortSignal;
};

export type ProductImage = {
  element: HTMLImageElement;
  visible: Rect;
  silhouette: ProductSilhouette;
  blob: Blob;
  name: string;
};

export function productImageFromBlob(blob: Blob, name: string, options?: ImageImportOptions): Promise<ProductImage> {
  if (options && !/^image\/(png|jpeg|webp)$/.test(blob.type)) return Promise.reject(new Error('请选择 PNG、JPG 或 WebP 图片'));
  if (options && blob.size > 30 * 1024 * 1024) return Promise.reject(new Error('图片超过 30 MB，请缩小后重新导入'));
  return new Promise((resolve, reject) => {
    const element = new Image();
    const url = URL.createObjectURL(blob);
    element.onload = async () => {
      try {
        if (options?.signal?.aborted) throw new DOMException('已取消', 'AbortError');
        if (options && element.width * element.height > 64_000_000) throw new Error(`图片为 ${element.width}×${element.height}，超过 6400 万像素，请缩小后重新导入`);
        const scan = document.createElement('canvas');
        scan.width = element.width;
        scan.height = element.height;
        const context = scan.getContext('2d');
        if (!context) throw new Error('无法读取产品图片');
        context.drawImage(element, 0, 0);
        const pixels = context.getImageData(0, 0, scan.width, scan.height).data;
        if (options?.removeWhiteBackground && !hasTransparency(pixels)) {
          if (!hasWhiteBackground(pixels, scan.width, scan.height)) throw new Error('自动抠图暂支持白底产品图，请换用白底图或透明 PNG');
          options.onProgress?.('正在导入图片…');
          const input = blob.type === 'image/webp'
            ? await new Promise<Blob>((resolve, reject) => scan.toBlob((png) => png ? resolve(png) : reject(new Error('图片转换失败')), 'image/png'))
            : blob; // Keep original JPG bytes: re-encoding would discard Photoshop paths.
          const png = options.engine === 'model'
            ? await (await import('./removeBackground')).removeBackground(blob, options.onProgress, options.signal)
            : await (await import('./photoshopCutout')).photoshopCutout(input, options.signal);
          if (options.signal?.aborted) throw new DOMException('已取消', 'AbortError');
          const result = await productImageFromBlob(png, name.replace(/\.[^.]+$/, '') + '.png');
          resolve(result);
          return;
        }
        const visible = alphaBounds(pixels, scan.width, scan.height);
        resolve({ element, visible, silhouette: silhouetteFromAlpha(pixels, scan.width, scan.height, visible), blob, name });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`无法读取产品图片：${name}`));
    };
    element.src = url;
  });
}
