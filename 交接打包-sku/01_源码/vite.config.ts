import { randomUUID } from 'node:crypto';
import { copyFile, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { photoshopCutout } from './scripts/photoshop-cutout-server.ts';

const MAX_PROJECT_BYTES = 64 * 1024 * 1024;

type RelayEntry = {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
};

function sendJson(response: import('node:http').ServerResponse, status: number, value: unknown) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(value));
}

function readBody(request: import('node:http').IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PROJECT_BYTES) {
        reject(new Error('项目文件过大'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function projectRelay(): Plugin {
  const entries = new Map<string, RelayEntry>();
  return {
    name: 'skuwork-local-project-relay',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        if (url.pathname === '/__skuwork/health') {
          response.statusCode = 200;
          response.end('ok');
          return;
        }
        if (url.pathname === '/__skuwork/open' && request.method === 'POST') {
          try {
            const encodedPath = request.headers['x-skuwork-path'];
            if (typeof encodedPath !== 'string') throw new Error('缺少项目路径');
            const projectPath = path.resolve(Buffer.from(encodedPath, 'base64').toString('utf8'));
            if (path.extname(projectPath).toLowerCase() !== '.skuwork') throw new Error('只允许打开 .skuwork 文件');
            const details = await stat(projectPath);
            if (!details.isFile() || details.size > MAX_PROJECT_BYTES) throw new Error('项目文件无效或过大');
            const token = randomUUID();
            entries.set(token, {
              path: projectPath,
              name: path.basename(projectPath),
              size: details.size,
              modifiedAt: details.mtimeMs,
            });
            sendJson(response, 200, { token });
          } catch (error) {
            sendJson(response, 400, { error: error instanceof Error ? error.message : '无法登记项目文件' });
          }
          return;
        }

        const match = url.pathname.match(/^\/__skuwork\/project\/([a-f0-9-]+)$/i);
        if (!match) {
          next();
          return;
        }
        const entry = entries.get(match[1]);
        if (!entry) {
          sendJson(response, 404, { error: '打开请求已失效' });
          return;
        }
        try {
          if (request.method === 'GET') {
            const contents = await readFile(entry.path);
            response.statusCode = 200;
            response.setHeader('content-type', 'application/x-skuwork');
            response.setHeader('x-skuwork-name', Buffer.from(entry.name, 'utf8').toString('base64'));
            response.end(contents);
            return;
          }
          if (request.method === 'PUT') {
            const current = await stat(entry.path);
            if (current.size !== entry.size || current.mtimeMs !== entry.modifiedAt) {
              sendJson(response, 409, { error: '源文件已被其他窗口修改' });
              return;
            }
            const contents = await readBody(request);
            if (contents.subarray(0, 8).toString('utf8') !== 'SKUWORK1') throw new Error('拒绝写入无效的项目内容');
            const temporaryPath = path.join(path.dirname(entry.path), `.${entry.name}.${match[1]}.tmp`);
            try {
              await writeFile(temporaryPath, contents, { flag: 'wx' });
              await copyFile(temporaryPath, entry.path);
            } finally {
              await unlink(temporaryPath).catch(() => undefined);
            }
            const updated = await stat(entry.path);
            entry.size = updated.size;
            entry.modifiedAt = updated.mtimeMs;
            response.statusCode = 204;
            response.end();
            return;
          }
          response.statusCode = 405;
          response.end();
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : '项目文件处理失败' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), projectRelay(), photoshopCutout()],
  server: {
    watch: {
      ignored: ['**/.vite.pid', '**/.vite.log', '**/.vite-error.log', '**/资料/**', '**/规范文件/**', '**/dist-desktop/**', '**/src-tauri/target/**', '**/releases/**'],
    },
  },
});
