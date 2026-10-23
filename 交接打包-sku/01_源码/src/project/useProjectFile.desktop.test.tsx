// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProjectFile } from './useProjectFile';
import { desktopHandle } from '../desktop/runtime';
import type { WorkbenchDraft } from '../storage/draftStorage';

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke, isTauri: () => true }));
vi.mock('../storage/projectCatalog', () => ({ saveRecentProject: vi.fn() }));
vi.mock('../storage/projectHandleStorage', () => ({ saveProjectHandle: vi.fn() }));
const original: WorkbenchDraft = { version: 1, templateId: 'soft-bed-single', model: 'ORIGINAL', modelManuallyEdited: true, sellingPoints: [], sizeInput: '', dimensionFields: { length: '', width: '', height: '' }, annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };
const onOpen = vi.fn();
const first = desktopHandle({ id: 'first', name: '原项目.skuwork' });
let project: ReturnType<typeof useProjectFile<WorkbenchDraft>>;
let root: Root;
let container: HTMLDivElement;
function Editor({ model = 'ORIGINAL' }: { model?: string }) {
  project = useProjectFile({ kind: 'single', templateId: 'soft-bed-single', enabled: true, draft: { ...original, model }, initialProject: { projectId: 'first-project', fileName: first.name, draft: original, handle: first }, onOpen });
  return <p>{project.fileName} {project.status}</p>;
}
beforeEach(async () => {
  native.invoke.mockImplementation(async (command: string) => command === 'pick_project' ? { id: 'second', name: '另一个模板.skuwork' } : undefined);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<Editor/>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); });

it('opens another file in a native window while keeping the current file and its save destination', async () => {
  await act(async () => project.open());
  expect(native.invoke).toHaveBeenCalledWith('open_project_window', { id: 'second' });
  expect(native.invoke).not.toHaveBeenCalledWith('read_project', expect.anything());
  expect(onOpen).not.toHaveBeenCalled();
  expect(container.textContent).toContain('原项目.skuwork');
  expect(container.textContent).toContain('独立窗口');
  await act(async () => root.render(<Editor model="FIRST-EDITED"/>));
  await act(async () => project.flush());
  expect(native.invoke).toHaveBeenCalledWith('write_project', { id: 'first', contents: expect.any(String) });
  expect(native.invoke).not.toHaveBeenCalledWith('write_project', { id: 'second', contents: expect.any(String) });
});

it('keeps the existing file editable when the new window fails', async () => {
  native.invoke.mockImplementation(async (command: string) => {
    if (command === 'pick_project') return { id: 'second', name: '另一个模板.skuwork' };
    if (command === 'open_project_window') throw new Error('新窗口打开失败');
  });
  await act(async () => project.open());
  expect(container.textContent).toContain('新窗口打开失败');
  expect(project.fileName).toBe('原项目.skuwork');
  expect(onOpen).not.toHaveBeenCalled();
});

it('cancelling the picker leaves the original file status unchanged', async () => {
  native.invoke.mockResolvedValue(null);
  const status = project.status;
  await act(async () => project.open());
  expect(project.status).toBe(status);
  expect(native.invoke).not.toHaveBeenCalledWith('open_project_window', expect.anything());
});
