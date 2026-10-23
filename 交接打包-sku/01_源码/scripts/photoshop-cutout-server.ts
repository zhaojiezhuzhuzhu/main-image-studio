import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
let busy = false;

export function isCutoutRequestAllowed(request: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): boolean {
  const { headers, socket } = request;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(socket.remoteAddress ?? '')) return false;
  if (headers['x-skuwork-cutout'] !== '1' || typeof headers.host !== 'string' || typeof headers.origin !== 'string') return false;
  try {
    const origin = new URL(headers.origin);
    return origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) && origin.host === headers.host;
  } catch { return false; }
}

export async function runPhotoshopCutout(bytes: Buffer, script = fileURLToPath(new URL('./photoshop-cutout.ps1', import.meta.url))): Promise<Buffer> {
  if (process.platform !== 'win32') throw new Error('自动抠图需在安装 Photoshop 2020 或更高版本的 Windows 本机工作台使用');
  if (busy) throw new Error('另一张图片正在处理，请稍后重新上传');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('图片为空或超过 30 MB');
  busy = true;
  let job: string | undefined;
  try {
    job = await mkdtemp(path.join(tmpdir(), 'sku-ps-cutout-'));
    const extension = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'jpg' : undefined;
    if (!extension) throw new Error('请选择 JPG 或 PNG 图片');
    await writeFile(path.join(job, `input.${extension}`), bytes, { flag: 'wx' });
    await new Promise<void>((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-JobDirectory', job!], { windowsHide: true, stdio: 'ignore' });
      child.once('error', () => reject(new Error('无法启动本机图片处理程序')));
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('图片处理失败')));
    }).catch(async (error) => {
      const detail = await readFile(path.join(job!, 'error.txt'), 'utf8').catch(() => '');
      throw new Error(detail || error.message);
    });
    const output = await readFile(path.join(job, 'output.png'));
    if (!output.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('抠图输出不是有效 PNG');
    return output;
  } finally {
    // Only a directory minted by mkdtemp above is removed, after PS has finished.
    try { if (job) await rm(job, { recursive: true, force: true }); }
    finally { busy = false; }
  }
}

export function photoshopCutout(): Plugin {
  return {
    name: 'skuwork-photoshop-cutout',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/__skuwork/cutout') { next(); return; }
        response.setHeader('Cache-Control', 'no-store');
        if (request.method !== 'POST' || !isCutoutRequestAllowed(request)) { response.statusCode = 403; response.end(); return; }
        try {
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > MAX_IMAGE_BYTES) throw new Error('图片超过 30 MB');
            chunks.push(chunk);
          }
          const png = await runPhotoshopCutout(Buffer.concat(chunks));
          if (!response.destroyed) { response.setHeader('Content-Type', 'image/png'); response.end(png); }
        } catch (error) {
          if (!response.destroyed) {
            response.statusCode = 400; response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : '图片处理失败' }));
          }
        }
      });
    },
  };
}
