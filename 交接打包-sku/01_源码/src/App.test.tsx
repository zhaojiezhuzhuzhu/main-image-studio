// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { loadDraftSummaries } from './storage/draftStorage';
import { decodeProjectFile } from './project/projectFile';

vi.mock('./SingleWorkbench', () => ({ SingleWorkbench: ({ templateId, initialDraftSlot, onBack }: { templateId: string; initialDraftSlot?: string; onBack: () => void }) => <div data-template={templateId} data-slot={initialDraftSlot}>单品编辑器<button onClick={onBack}>返回</button></div> }));
vi.mock('./SofaCombinationWorkbench', () => ({ SofaCombinationWorkbench: ({ templateId, initialDraftSlot, onBack }: { templateId: string; initialDraftSlot?: string; onBack: () => void }) => <div data-template={templateId} data-slot={initialDraftSlot}>组合编辑器<button onClick={onBack}>返回</button></div> }));
vi.mock('./domain/templates', async (original) => {
  const values = await original<typeof import('./domain/templates')>();
  return { ...values, TEMPLATES: Object.fromEntries(Object.entries(values.TEMPLATES).map(([id, value]) => [id, { ...value, available: true }])) };
});
vi.mock('./storage/draftStorage', () => ({ loadDraftSummaries: vi.fn(async () => []), createSceneSlot: () => `scene:${crypto.randomUUID()}` }));
vi.mock('./storage/projectCatalog', () => ({ loadRecentProjects: vi.fn(async () => []), loadRecentProject: vi.fn(), saveRecentProject: vi.fn() }));
vi.mock('./storage/projectHandleStorage', () => ({ loadProjectHandle: vi.fn(), saveProjectHandle: vi.fn() }));
vi.mock('./project/fileAccess', () => ({ supportsProjectFileAccess: () => false, chooseProjectOpenFile: async () => new File([], 'example.skuwork') }));
vi.mock('./project/projectFile', async (original) => ({ ...await original<typeof import('./project/projectFile')>(), decodeProjectFile: vi.fn() }));

let container: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  window.history.replaceState(null, '', '/');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<App/>));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('模板首页与源文件识别', () => {
  it('starts a fresh scene on every new-template click while preserving separate recovery entries', async () => {
    vi.mocked(loadDraftSummaries).mockResolvedValueOnce([
      { slot: 'scene:old-a', kind: 'single', templateId: 'sofa-single', model: '旧现场甲', updatedAt: 2, hasContent: true },
      { slot: 'scene:old-b', kind: 'single', templateId: 'sofa-single', model: '旧现场乙', updatedAt: 1, hasContent: true },
    ]);
    await act(async () => root.render(<App key="fresh-scenes"/>));
    expect(container.querySelectorAll('.draft-card')).toHaveLength(2);
    const start = () => container.querySelector<HTMLButtonElement>('button[aria-label="新建空白模板：沙发单品 SKU（单品）"]')!;
    await act(async () => start().click());
    const first = container.querySelector('[data-slot]')!.getAttribute('data-slot');
    expect(first).toMatch(/^scene:/);
    expect(first).not.toBe('scene:old-a');
    expect(first).not.toBe('scene:old-b');
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click());
    await act(async () => start().click());
    expect(container.querySelector('[data-slot]')!.getAttribute('data-slot')).not.toBe(first);
  });

  it('opens the correct editor from the sleeping category', async () => {
    const sleeping = [...container.querySelectorAll('button')].find((button) => button.textContent?.startsWith('睡眠'))!;
    await act(async () => sleeping.click());
    const card = [...container.querySelectorAll<HTMLButtonElement>('.template-card')].find((item) => item.textContent?.includes('软床单品 SKU'))!;
    await act(async () => card.click());
    expect(container.querySelector('[data-template]')?.getAttribute('data-template')).toBe('soft-bed-single');
  });

  it.each([
    ['single', 'soft-bed-single'],
    ['combination', 'sofa-bed-combination'],
    ['single', 'footstool-single'],
    ['single', 'office-chair-single'],
    ['single', 'long-dining-table-single'],
    ['single', 'round-extendable-table-single'],
    ['single', 'functional-sofa-single'],
    ['single', 'bedside-cabinet-single'],
    ['single', 'long-dining-table-combination'],
    ['single', 'round-extendable-table-combination'],
    ['single', 'standing-desk-single'],
    ['single', 'standing-desk-combination'],
    ['single', 'computer-chair-single'],
    ['single', 'ergonomic-chair-single'],
    ['single', 'study-chair-single'],
    ['single', 'mattress-single'],
    ['single', 'mattress-double'],
    ['single', 'pillow-single'],
    ['single', 'soft-bed-combination'],
    ['single', 'soft-bed-multi-combination'],
    ['single', 'wardrobe-single'],
    ['single', 'shoe-cabinet-single'],
    ['single', 'shaped-vanity-single'],
    ['single', 'wood-desk-single'],
    ['single', 'wardrobe-combination'],
    ['single', 'shoe-cabinet-combination'],
    ['single', 'vanity-dresser-single'],
    ['single', 'vanity-dresser-combination'],
    ['single', 'shaped-vanity-combination'],
    ['single', 'drawer-chest-combination'],
    ['single', 'wood-desk-combination'],
    ['single', 'wood-desk-multi-combination'],
    ['single', 'wood-bed-combination'],
    ['single', 'wood-bed-multi-combination'],
    ['single', 'wood-bed-single'],
    ['single', 'wood-dining-chair-single'],
    ['combination', 'functional-sofa-combination'],
    ['single', 'wood-long-table-combination'],
    ['single', 'wood-round-table-combination'],
    ['single', 'wood-long-table-single'],
    ['single', 'wood-round-table-single'],
    ['single', 'wood-bedside-single'],
    ['single', 'drawer-chest-single'],
    ['single', 'dining-chair-single'],
    ['single', 'lifting-side-table-single'],
    ['single', 'study-desk-single'],
    ['single', 'study-desk-combination'],
    ['single', undefined],
  ] as const)('routes a %s source file to its saved template %s', async (kind, templateId) => {
    vi.mocked(decodeProjectFile).mockResolvedValue({ projectId: 'test', kind, draft: { model: 'TEST', templateId } } as Awaited<ReturnType<typeof decodeProjectFile>>);
    await act(async () => [...container.querySelectorAll('button')].find((button) => button.textContent === '打开源文件')!.click());
    expect(container.querySelector('[data-template]')?.getAttribute('data-template')).toBe(templateId ?? 'sofa-single');
  });

  it.each([['板木', '板木衣柜组合 SKU', 'wardrobe-combination'], ['板木', '板木鞋柜组合 SKU', 'shoe-cabinet-combination'], ['板木', '斗柜妆台单品 SKU', 'vanity-dresser-single'], ['板木', '斗柜妆台组合 SKU', 'vanity-dresser-combination'], ['板木', '异形妆台组合 SKU', 'shaped-vanity-combination'], ['板木', '板木斗柜组合 SKU', 'drawer-chest-combination'], ['板木', '板木书桌组合 SKU', 'wood-desk-combination'], ['板木', '板木书桌多组合 SKU', 'wood-desk-multi-combination'], ['板木', '板木床组合 SKU', 'wood-bed-combination'], ['板木', '板木床多组合 SKU', 'wood-bed-multi-combination'], ['板木', '板木床单品 SKU', 'wood-bed-single'], ['板木', '板木餐椅双视图 SKU', 'wood-dining-chair-single'], ['沙发', '功能沙发多规格 SKU', 'functional-sofa-combination'], ['板木', '板木长餐桌组合 SKU', 'wood-long-table-combination'], ['板木', '板木圆餐桌组合 SKU', 'wood-round-table-combination'], ['板木', '板木长餐桌单品 SKU', 'wood-long-table-single'], ['板木', '板木圆餐桌单品 SKU', 'wood-round-table-single'], ['板木', '异形妆台单品 SKU', 'shaped-vanity-single'], ['板木', '板木书桌单品 SKU', 'wood-desk-single'], ['板木', '板木衣柜单品 SKU', 'wardrobe-single'], ['板木', '板木鞋柜单品 SKU', 'shoe-cabinet-single'], ['板木', '板木床头柜单品 SKU', 'wood-bedside-single'], ['板木', '板木斗柜单品 SKU', 'drawer-chest-single'], ['睡眠', '软床组合 SKU', 'soft-bed-combination'], ['睡眠', '软床多组合 SKU', 'soft-bed-multi-combination'], ['睡眠', '床垫单品（双面睡）SKU', 'mattress-double'], ['睡眠', '枕头单品 SKU', 'pillow-single'], ['办公', '儿童学习椅 SKU', 'study-chair-single'], ['睡眠', '床垫单品（单面睡）SKU', 'mattress-single'], ['办公', '电脑椅 SKU', 'computer-chair-single'], ['办公', '工学椅 SKU', 'ergonomic-chair-single'], ['餐桌', '餐椅双视图 SKU', 'dining-chair-single'], ['办公', '升降边桌 SKU', 'lifting-side-table-single'], ['办公', '儿童学习桌单品 SKU', 'study-desk-single'], ['办公', '儿童学习桌组合 SKU', 'study-desk-combination'], ['办公', '电动升降桌单品 SKU', 'standing-desk-single'], ['办公', '电动升降桌组合 SKU', 'standing-desk-combination'], ['沙发', '脚踏 SKU', 'footstool-single'], ['办公', '无功能书椅 SKU', 'office-chair-single'], ['餐桌', '长餐桌单品 SKU', 'long-dining-table-single'], ['餐桌', '圆伸缩餐桌单品 SKU', 'round-extendable-table-single'], ['沙发', '功能单人沙发 SKU', 'functional-sofa-single'], ['睡眠', '软体床头柜单品 SKU', 'bedside-cabinet-single'], ['餐桌', '长餐桌组合 SKU', 'long-dining-table-combination'], ['餐桌', '圆伸缩餐桌组合 SKU', 'round-extendable-table-combination']])('从 %s 分类打开 %s', async (category, title, id) => {
    await act(async () => [...container.querySelectorAll('.category-list button')].find((button) => button.textContent?.startsWith(category))!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const cards = [...container.querySelectorAll<HTMLButtonElement>('.template-card')].filter((item) => item.querySelector('strong')?.textContent === title);
    expect(cards).toHaveLength(1);
    if (id.endsWith('table-combination')) expect(cards[0].querySelector('.template-tags')?.textContent).toBe('组合');
    await act(async () => cards[0].click());
    expect(container.querySelector('[data-template]')?.getAttribute('data-template')).toBe(id);
  });

  it('loads all temporary workspaces separately', () => {
    expect(loadDraftSummaries).toHaveBeenCalledOnce();
    expect(container.querySelectorAll('.draft-card')).toHaveLength(0);
    expect([...container.querySelectorAll('.workspace-group h3')].some((heading) => heading.textContent === '临时现场')).toBe(false);
    expect(container.querySelectorAll('button.template-card:not(:disabled)').length).toBeGreaterThan(0);
  });

  it('shows only saved workspaces with content and can resume an unnamed workspace', async () => {
    vi.mocked(loadDraftSummaries).mockResolvedValueOnce([
      { slot: 'scene:empty', kind: 'single', templateId: 'sofa-single', model: '', updatedAt: 1, hasContent: false },
      { slot: 'scene:first', kind: 'combination', templateId: 'sofa-combination', model: 'PS060-A1', updatedAt: 2, hasContent: true },
      { slot: 'scene:second', kind: 'combination', templateId: 'sofa-bed-combination', model: '', updatedAt: 3, hasContent: true },
    ]);
    await act(async () => root.render(<App key="saved-workspaces"/>));

    const cards = [...container.querySelectorAll('.draft-card')];
    expect(cards.map((card) => card.querySelector('strong')?.textContent)).toEqual(['PS060-A1', '未命名现场']);
    expect(container.textContent).not.toContain('空白现场');
    await act(async () => cards[1].querySelector<HTMLButtonElement>('button')!.click());
    expect(container.querySelector('[data-template]')?.getAttribute('data-template')).toBe('sofa-bed-combination');
    expect(container.querySelector('[data-slot]')?.getAttribute('data-slot')).toBe('scene:second');
  });
});
