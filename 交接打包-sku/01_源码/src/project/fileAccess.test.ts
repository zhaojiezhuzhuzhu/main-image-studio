import { describe, expect, it, vi } from 'vitest';
import { ensureWritePermission, writeProjectFile, type ProjectFileHandle } from './fileAccess';

describe('项目源文件写入', () => {
  it('commits through one writable stream', async () => {
    const write = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const handle = {
      createWritable: async () => ({ write, close }),
      getFile: async () => new File([], 'one.skuwork'),
      name: 'one.skuwork',
    } as ProjectFileHandle;
    const contents = new Blob(['project']);

    await writeProjectFile(handle, contents);

    expect(write).toHaveBeenCalledWith(contents);
    expect(close).toHaveBeenCalledOnce();
  });

  it('aborts a failed write instead of reporting success', async () => {
    const abort = vi.fn(async () => undefined);
    const handle = {
      name: 'one.skuwork',
      getFile: async () => new File([], 'one.skuwork'),
      createWritable: async () => ({ write: async () => { throw new Error('disk full'); }, close: async () => undefined, abort }),
    } as ProjectFileHandle;

    await expect(writeProjectFile(handle, new Blob(['project']))).rejects.toThrow('disk full');
    expect(abort).toHaveBeenCalledOnce();
  });

  it('requests write permission only during a user action', async () => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState);
    const handle = {
      name: 'one.skuwork',
      getFile: async () => new File([], 'one.skuwork'),
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
      queryPermission: async () => 'prompt' as PermissionState,
      requestPermission,
    } as ProjectFileHandle;

    await expect(ensureWritePermission(handle, false)).resolves.toBe(false);
    await expect(ensureWritePermission(handle, true)).resolves.toBe(true);
    expect(requestPermission).toHaveBeenCalledOnce();
  });
});
