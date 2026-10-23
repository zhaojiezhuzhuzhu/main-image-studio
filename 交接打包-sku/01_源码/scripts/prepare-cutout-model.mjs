import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

// Pin both the model revision and checksum; images are never sent to this host.
const checksum = '60024c5c889badc19c04ad937298a77b'; // Published by rembg's U2netSession.
const directory = new URL('../public/models/cutout/', import.meta.url);
const target = fileURLToPath(new URL('u2net.onnx', directory));
async function digest(file) {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
await mkdir(directory, { recursive: true });
if (await stat(target).catch(() => null) && await digest(target) === checksum) {
  console.log('本机抠图模型已就绪。');
} else {
  const temporary = `${target}.download`;
  try {
    console.log('下载本机抠图模型（约 176 MB，仅首次准备需要联网）…');
    const response = await fetch('https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx');
    if (!response.ok || !response.body) throw new Error(`模型下载失败：HTTP ${response.status}`);
    await pipeline(response.body, createWriteStream(temporary));
    if (await digest(temporary) !== checksum) throw new Error('模型校验失败，请重新运行准备命令');
    await rename(temporary, target);
    console.log('本机抠图模型下载及校验完成。');
  } finally { await rm(temporary, { force: true }); }
}
