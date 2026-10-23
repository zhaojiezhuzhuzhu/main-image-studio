// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { accountDatabase, desktopCall, desktopHandle, exportCanvasJpg, flushDesktopEditor, registerDesktopFlush, setDesktopUser } from './runtime';
import { loadProjectHandle, saveProjectHandle } from '../storage/projectHandleStorage';
import { loadDraft, saveDraft, type WorkbenchDraft } from '../storage/draftStorage';

const native = vi.hoisted(() => ({ invoke: vi.fn(), desktop: true }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke, isTauri: () => native.desktop }));
afterEach(() => { vi.restoreAllMocks(); native.invoke.mockReset(); native.desktop = true; setDesktopUser(null); });

it('keeps desktop account drafts separate and preserves the browser database', async () => {
  const id = crypto.randomUUID();
  const draft: WorkbenchDraft = { version: 1, model: 'TEST', modelManuallyEdited: false, sellingPoints: [], sizeInput: '', dimensionFields: { length: '', width: '', height: '' }, annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };
  setDesktopUser({ id, name: 'A', role: 'admin', enabled: true });
  await saveDraft(draft);
  expect((await loadDraft())?.model).toBe('TEST');
  setDesktopUser({ id: `${id}-other`, name: 'B', role: 'user', enabled: true });
  expect(await loadDraft()).toBeNull();
  setDesktopUser(null);
  expect(() => accountDatabase('drafts')).toThrow('请先登录');
  native.desktop = false;
  expect(accountDatabase('drafts')).toBe('drafts');
});

it('persists and restores native file handles without cloning functions', async () => {
  setDesktopUser({ id: crypto.randomUUID(), name: 'A', role: 'admin', enabled: true });
  const handle = desktopHandle({ id: 'native-file-id', name: '测试.skuwork' });
  await saveProjectHandle('single', handle);
  const restored = await loadProjectHandle('single');
  expect(restored?.name).toBe('测试.skuwork');
  native.invoke.mockResolvedValueOnce(new TextEncoder().encode('SKUWORK1').buffer);
  const file = await restored!.getFile();
  expect(file.size).toBe(8);
  expect(native.invoke).toHaveBeenCalledWith('read_project', { id: 'native-file-id' });
});

it('propagates save failure and abort does not write the pending file', async () => {
  const handle = desktopHandle({ id: 'file', name: 'test.skuwork' });
  const writer = await handle.createWritable();
  await writer.write(new Blob(['SKUWORK1']));
  await writer.abort?.();
  await expect(writer.close()).rejects.toThrow('没有可保存');
  expect(native.invoke).not.toHaveBeenCalled();
  const unregister = registerDesktopFlush(async () => { throw new Error('磁盘写入失败'); });
  await expect(flushDesktopEditor()).rejects.toThrow('磁盘写入失败');
  unregister();
  await expect(flushDesktopEditor()).resolves.toBeUndefined();
});

it('converts native failures to actionable error messages', async () => {
  native.invoke.mockRejectedValue('此操作仅限管理员');
  await expect(desktopCall('list_users')).rejects.toThrow('此操作仅限管理员');
});

it('downloads JPEG bytes with the template filename in the browser', async () => {
  native.desktop = false;
  const canvas = document.createElement('canvas');
  const encode = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/');
  const downloads: Array<{ name: string; url: string }> = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, url: this.href });
  });
  await exportCanvasJpg(canvas, 'TZ4R-A-单件-SKU.jpg');
  expect(encode).toHaveBeenCalledWith('image/jpeg', 0.95);
  expect(downloads).toEqual([{ name: 'TZ4R-A-单件-SKU.jpg', url: 'data:image/jpeg;base64,/9j/' }]);
  expect(native.invoke).not.toHaveBeenCalled();
});

it('sends JPEG bytes to the desktop JPG save command', async () => {
  const canvas = document.createElement('canvas');
  const encode = vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/');
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');
  native.invoke.mockResolvedValue(true);
  await exportCanvasJpg(canvas, 'TEST-组合SKU.jpg');
  expect(encode).toHaveBeenCalledWith('image/jpeg', 0.95);
  expect(native.invoke).toHaveBeenCalledWith('export_jpg', { name: 'TEST-组合SKU.jpg', contents: '/9j/' });
  expect(click).not.toHaveBeenCalled();
});

it('reports desktop JPG save failures to the workbench', async () => {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/');
  native.invoke.mockRejectedValue('磁盘写入失败');
  await expect(exportCanvasJpg(canvas, 'TEST-SKU.jpg')).rejects.toThrow('磁盘写入失败');
});
