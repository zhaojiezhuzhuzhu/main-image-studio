import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectFileHandle } from '../project/fileAccess';
import { clearProjectHandle, loadProjectHandle, saveProjectHandle } from './projectHandleStorage';

afterEach(async () => {
  await clearProjectHandle('single');
  await clearProjectHandle('combination');
});

describe('项目文件关联', () => {
  it('keeps one source-file handle for each workbench', async () => {
    const single = { name: 'single.skuwork' } as ProjectFileHandle;
    const combination = { name: 'combination.skuwork' } as ProjectFileHandle;

    await saveProjectHandle('single', single);
    await saveProjectHandle('combination', combination);

    await expect(loadProjectHandle('single')).resolves.toMatchObject({ name: 'single.skuwork' });
    await expect(loadProjectHandle('combination')).resolves.toMatchObject({ name: 'combination.skuwork' });
  });

  it('removes only the selected workbench association', async () => {
    await saveProjectHandle('single', { name: 'single.skuwork' } as ProjectFileHandle);
    await saveProjectHandle('combination', { name: 'combination.skuwork' } as ProjectFileHandle);

    await clearProjectHandle('single');

    await expect(loadProjectHandle('single')).resolves.toBeNull();
    await expect(loadProjectHandle('combination')).resolves.toMatchObject({ name: 'combination.skuwork' });
  });
});
