import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url';
import { cutoutAlpha } from './whiteBackground';

env.wasm.numThreads = 1;
env.wasm.wasmPaths = { wasm: wasmUrl, mjs: wasmModuleUrl };
const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

self.onmessage = async ({ data }: MessageEvent<{ blob: Blob; modelUrl: string }>) => {
  let session: InferenceSession | undefined;
  let bitmap: ImageBitmap | undefined;
  try {
    self.postMessage({ status: '正在加载本机抠图模型…' });
    const response = await fetch(data.modelUrl);
    if (!response.ok || response.headers.get('content-type')?.includes('text/html')) throw new Error('缺少本机抠图模型，请先运行 npm run prepare:cutout');
    session = await InferenceSession.create(await response.arrayBuffer(), { executionProviders: ['wasm'] });
    self.postMessage({ status: '正在自动抠图，图片仅在本机处理…' });
    bitmap = await createImageBitmap(data.blob);
    const inputCanvas = new OffscreenCanvas(SIZE, SIZE);
    const inputContext = inputCanvas.getContext('2d')!;
    inputContext.drawImage(bitmap, 0, 0, SIZE, SIZE);
    const rgba = inputContext.getImageData(0, 0, SIZE, SIZE).data;
    const plane = SIZE * SIZE;
    const values = new Float32Array(plane * 3);
    for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) values[c * plane + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    const input = new Tensor('float32', values, [1, 3, SIZE, SIZE]);
    const outputs = await session.run({ [session.inputNames[0]]: input });
    input.dispose();
    const mask = outputs[session.outputNames[0]];
    const maskHeight = mask.dims[mask.dims.length - 2], maskWidth = mask.dims[mask.dims.length - 1];
    const maskCanvas = new OffscreenCanvas(maskWidth, maskHeight), maskContext = maskCanvas.getContext('2d')!;
    const maskPixels = maskContext.createImageData(maskWidth, maskHeight);
    let minimum = Infinity, maximum = -Infinity;
    for (const value of mask.data as Float32Array) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
    if (maximum - minimum < 0.01) throw new Error('未识别到产品轮廓');
    for (let i = 0; i < maskWidth * maskHeight; i++) maskPixels.data[i * 4 + 3] = cutoutAlpha((Number(mask.data[i]) - minimum) / (maximum - minimum));
    Object.values(outputs).forEach((output) => output.dispose());
    maskContext.putImageData(maskPixels, 0, 0);
    self.postMessage({ status: '正在生成透明 PNG…' });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
    self.postMessage({ blob: await canvas.convertToBlob({ type: 'image/png' }) });
  } catch (error) {
    console.error('本机抠图失败', error);
    self.postMessage({ error: error instanceof Error && error.message.startsWith('缺少') ? error.message : '自动抠图失败，请重试或导入透明 PNG' });
  } finally { bitmap?.close(); await session?.release(); }
};
