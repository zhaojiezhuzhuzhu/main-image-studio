import { completionIds } from '../TemplateCompletion.fixtures';
// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useProjectFile } from './useProjectFile';
import { decodeProjectFile } from './projectFile';
import type { WorkbenchDraft } from '../storage/draftStorage';
import type { TemplateId } from '../domain/templates';

vi.mock('./fileAccess', () => ({ supportsProjectFileAccess: () => false, chooseProjectOpenFile: async () => new File([], 'source.skuwork') }));
vi.mock('./projectFile', async (original) => ({ ...await original<typeof import('./projectFile')>(), decodeProjectFile: vi.fn() }));
vi.mock('../storage/projectCatalog', () => ({ saveRecentProject: vi.fn(async () => undefined) }));

const draft: WorkbenchDraft = { version: 1, templateId: 'soft-bed-single', model: 'BED', modelManuallyEdited: true, sellingPoints: [], sizeInput: '', dimensionFields: { length: '', width: '', height: '' }, annotations: [], subjectAdjustment: { scale: 1, offsetX: 0, offsetY: 0 } };
const onOpen = vi.fn();
let container: HTMLDivElement;
let root: Root;
function TestEditor({ templateId = 'soft-bed-single' }: { templateId?: TemplateId }) {
  const project = useProjectFile({ kind: 'single', templateId, enabled: true, draft: { ...draft, templateId }, onOpen });
  return <><button onClick={() => void project.open()}>打开</button><p>{project.status}</p></>;
}
beforeEach(async () => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<TestEditor/>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.clearAllMocks(); });

it('keeps the current bed project intact when an old sofa file is selected inside its editor', async () => {
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'sofa', savedAt: '', kind: 'single', draft: { ...draft, templateId: undefined } });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).not.toHaveBeenCalled();
  expect(container.textContent).toContain('沙发单品 SKU源文件');
});

it('opens a matching template in the current editor', async () => {
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'bed', savedAt: '', kind: 'single', draft });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).toHaveBeenCalledWith(draft, 'bed');
  expect(container.textContent).toContain('项目已打开');
});

it.each(['footstool-single', 'office-chair-single', 'long-dining-table-single', 'round-extendable-table-single', 'functional-sofa-single', 'bedside-cabinet-single'] as const)('拒绝在软床编辑器中打开 %s，保留当前现场', async (templateId) => {
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'batch2', savedAt: '', kind: 'single', draft: { ...draft, templateId } });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).not.toHaveBeenCalled();
  expect(container.textContent).toContain('源文件');
  expect(container.textContent).not.toContain('项目已打开');
});

it.each(['wood-long-table-combination', 'wood-round-table-combination', 'wood-long-table-single', 'wood-round-table-single', 'shaped-vanity-single', 'wood-desk-single', 'wardrobe-single', 'shoe-cabinet-single', 'wood-bedside-single', 'drawer-chest-single', 'soft-bed-combination', 'soft-bed-multi-combination', 'mattress-double', 'pillow-single', 'study-chair-single', 'mattress-single', 'computer-chair-single', 'ergonomic-chair-single', 'dining-chair-single', 'lifting-side-table-single', 'functional-sofa-single', 'bedside-cabinet-single', 'standing-desk-single', 'standing-desk-combination'] as const)('%s 拒绝另一模板并可以打开匹配源文件', async (templateId) => {
  await act(async () => root.render(<TestEditor key={templateId} templateId={templateId}/>));
  const other = templateId === 'functional-sofa-single' ? 'bedside-cabinet-single' : 'functional-sofa-single';
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'wrong', savedAt: '', kind: 'single', draft: { ...draft, templateId: other } });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).not.toHaveBeenCalled();
  expect(container.textContent).not.toContain('项目已打开');
  const matching = { ...draft, templateId };
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'matching', savedAt: '', kind: 'single', draft: matching });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).toHaveBeenCalledWith(matching, 'matching');
});

it.each(['long-dining-table-combination', 'round-extendable-table-combination'] as const)('%s 按模板身份拒绝单品和其他组合，再打开匹配源文件', async (templateId) => {
  await act(async () => root.render(<TestEditor key={templateId} templateId={templateId}/>));
  for (const other of ['long-dining-table-single', 'round-extendable-table-single', templateId === 'long-dining-table-combination' ? 'round-extendable-table-combination' : 'long-dining-table-combination'] as const) {
    vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'wrong', savedAt: '', kind: 'single', draft: { ...draft, templateId: other } });
    await act(async () => container.querySelector('button')!.click());
    expect(onOpen).not.toHaveBeenCalled();
    expect(container.textContent).toContain('请返回模板首页打开');
  }
  const matching = { ...draft, templateId };
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'matching', savedAt: '', kind: 'single', draft: matching });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).toHaveBeenCalledWith(matching, 'matching');
});


it.each(['study-desk-single', 'study-desk-combination'] as const)('%s 拒绝另一学习桌模板并可打开匹配源文件', async (templateId) => {
  await act(async () => root.render(<TestEditor key={templateId} templateId={templateId}/>));
  const other = templateId === 'study-desk-single' ? 'study-desk-combination' : 'study-desk-single';
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'wrong-study', savedAt: '', kind: 'single', draft: { ...draft, templateId: other } });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).not.toHaveBeenCalled();
  expect(container.textContent).toContain('请返回模板首页打开');
  const matching = { ...draft, templateId };
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'matching-study', savedAt: '', kind: 'single', draft: matching });
  await act(async () => container.querySelector('button')!.click());
  expect(onOpen).toHaveBeenCalledWith(matching, 'matching-study');
});

it.each(completionIds)('收尾模板 %s 仅打开自己的源文件', async (templateId) => {
  await act(async () => root.render(<TestEditor key={templateId} templateId={templateId}/>));
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'wrong', savedAt: '', kind: 'single', draft });
  await act(async () => container.querySelector('button')!.click()); expect(onOpen).not.toHaveBeenCalled();
  const matching = { ...draft, templateId };
  vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'matching', savedAt: '', kind: 'single', draft: matching });
  await act(async () => container.querySelector('button')!.click()); expect(onOpen).toHaveBeenCalledWith(matching, 'matching');
});
