import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { clearRecentProjects, loadRecentProject, loadRecentProjects, saveRecentProject } from './projectCatalog';

afterEach(clearRecentProjects);

describe('项目中心最近源文件', () => {
  it('orders recent projects and updates an existing entry', async () => {
    await saveRecentProject({ projectId: 'one', kind: 'single', fileName: 'one.skuwork', model: 'ONE', lastOpenedAt: 10, access: 'reference' });
    await saveRecentProject({ projectId: 'two', kind: 'combination', fileName: 'two.skuwork', model: 'TWO', lastOpenedAt: 20, access: 'handle' });
    await saveRecentProject({ projectId: 'one', kind: 'single', fileName: 'renamed.skuwork', model: 'ONE-A', lastOpenedAt: 30, access: 'handle' });

    await expect(loadRecentProjects()).resolves.toMatchObject([
      { projectId: 'one', fileName: 'renamed.skuwork', model: 'ONE-A', access: 'handle' },
      { projectId: 'two', fileName: 'two.skuwork' },
    ]);
    await expect(loadRecentProject('one')).resolves.toMatchObject({ lastOpenedAt: 30 });
  });

  it('keeps only the eight most recent projects', async () => {
    for (let index = 0; index < 10; index += 1) {
      await saveRecentProject({ projectId: `project-${index}`, kind: 'single', fileName: `${index}.skuwork`, model: `${index}`, lastOpenedAt: index, access: 'reference' });
    }
    const projects = await loadRecentProjects();
    expect(projects).toHaveLength(8);
    expect(projects.map((project) => project.projectId)).toEqual(['project-9', 'project-8', 'project-7', 'project-6', 'project-5', 'project-4', 'project-3', 'project-2']);
  });
});
