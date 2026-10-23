import { expect, it } from 'vitest';
import { isCutoutRequestAllowed } from './photoshop-cutout-server';

it('只允许本机工作台的同源导入，外站与远程请求不能启动 Photoshop', () => {
  const request = { socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:43176', origin: 'http://127.0.0.1:43176', 'x-skuwork-cutout': '1' } };
  expect(isCutoutRequestAllowed(request)).toBe(true);
  expect(isCutoutRequestAllowed({ ...request, socket: { remoteAddress: '10.0.0.1' } })).toBe(false);
  expect(isCutoutRequestAllowed({ ...request, headers: { ...request.headers, origin: 'https://example.com' } })).toBe(false);
  expect(isCutoutRequestAllowed({ ...request, headers: { ...request.headers, origin: 'http://127.0.0.1:4173' } })).toBe(false);
  expect(isCutoutRequestAllowed({ ...request, headers: { ...request.headers, 'x-skuwork-cutout': '' } })).toBe(false);
});
