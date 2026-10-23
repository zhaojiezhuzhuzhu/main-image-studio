import { useEffect, useState } from 'react';
import { DesktopAccountButton } from './desktop/DesktopGate';
import { desktopCall, desktopHandle, isDesktop, openDesktopProjectInWindow, type DesktopFile } from './desktop/runtime';
import { createSceneSlot, loadDraftSummaries, type DraftSummary, type SofaCombinationDraft, type WorkbenchDraft } from './storage/draftStorage';
import { loadProjectHandle, saveProjectHandle } from './storage/projectHandleStorage';
import { loadRecentProject, loadRecentProjects, saveRecentProject, type RecentProject } from './storage/projectCatalog';
import { decodeProjectFile, projectDraftSlot } from './project/projectFile';
import { chooseProjectOpenFile, chooseProjectOpenHandle, supportsProjectFileAccess, type ProjectFileHandle } from './project/fileAccess';
import { openRelayedProject } from './project/relayFileAccess';
import { type ProjectLaunch } from './project/useProjectFile';
import { SofaCombinationWorkbench } from './SofaCombinationWorkbench';
import { SingleWorkbench } from './SingleWorkbench';
import { resolveTemplateId, templateKindLabel, TEMPLATES, TEMPLATE_IDS, type TemplateId } from './domain/templates';
import { isSingleTemplateId, isCombinationTemplateId } from './templates/registry';
import { AppMark, CATEGORY_ICON, FurnitureIcon, TEMPLATE_ICON } from './ui/FurnitureIcon';
import { SourceFileIcon } from './ui/SourceFileIcon';
export { SingleWorkbench } from './SingleWorkbench';

type LaunchedProject =
  | { kind: 'single'; project: ProjectLaunch<WorkbenchDraft> }
  | { kind: 'combination'; project: ProjectLaunch<SofaCombinationDraft> };

function formatProjectTime(timestamp: number): string {
  if (!timestamp) return '较早的现场';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

export default function App() {
  const [template, setTemplate] = useState<TemplateId>();
  const [category, setCategory] = useState<'沙发' | '睡眠' | '办公' | '餐桌' | '板木'>('沙发');
  const availableTemplates = TEMPLATE_IDS.filter((id) => TEMPLATES[id].available);
  const categoryTemplates = TEMPLATE_IDS.filter((id) => TEMPLATES[id].category === category);
  const [launchedProject, setLaunchedProject] = useState<LaunchedProject>();
  const [sceneSlot, setSceneSlot] = useState<string>();
  const [launchStatus, setLaunchStatus] = useState<'loading' | 'ready'>(() => {
    const parameters = new URLSearchParams(window.location.search);
    return parameters.has('open') || parameters.has('recent') ? 'loading' : 'ready';
  });
  const [launchError, setLaunchError] = useState('');
  const [centerStatus, setCenterStatus] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [draftSummaries, setDraftSummaries] = useState<DraftSummary[]>([]);

  async function activateProject(file: File, handle: ProjectFileHandle | undefined, access: RecentProject['access'], relayToken?: string) {
    const document = await decodeProjectFile(file);
    const templateId = resolveTemplateId(document.kind, document.draft.templateId);
    if (!TEMPLATES[templateId].available) throw new Error('该模板正在接入，请完成模板更新后打开');
    if (handle && handle.persistable !== false) await saveProjectHandle(projectDraftSlot(document.kind, document.projectId), handle);
    await saveRecentProject({
      projectId: document.projectId,
      kind: document.kind,
      templateId,
      fileName: file.name,
      model: document.draft.model,
      lastOpenedAt: Date.now(),
      access,
      relayToken,
    });
    if (document.kind === 'single') {
      setLaunchedProject({ kind: 'single', project: { projectId: document.projectId, fileName: file.name, draft: document.draft, handle } });
    } else {
      setLaunchedProject({ kind: 'combination', project: { projectId: document.projectId, fileName: file.name, draft: document.draft, handle } });
    }
    setCategory(TEMPLATES[templateId].category);
    setTemplate(templateId);
  }

  async function openRecent(projectId: string) {
    const recent = await loadRecentProject(projectId);
    if (!recent) throw new Error('最近项目记录不存在');
    if (recent.access === 'relay' && recent.relayToken) {
      const { file, handle } = await openRelayedProject(recent.relayToken);
      await activateProject(file, handle, 'relay', recent.relayToken);
      return;
    }
    const handle = await loadProjectHandle(projectDraftSlot(recent.kind, recent.projectId));
    if (!handle) throw new Error('该源文件需要重新选择；也可以再次双击源文件打开');
    if (await openDesktopProjectInWindow(handle)) return;
    await activateProject(await handle.getFile(), handle, 'handle');
  }

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const token = parameters.get('open');
    const recentId = parameters.get('recent');
    if (!token && !recentId) return;
    let cancelled = false;
    const opening = token
      ? openRelayedProject(token).then(({ file, handle }) => activateProject(file, handle, 'relay', token))
      : openRecent(recentId!);
    opening.then(() => {
      if (cancelled) return;
      setLaunchStatus('ready');
    }).catch((error) => {
      if (cancelled) return;
      setLaunchError(error instanceof Error ? error.message : '源文件无法打开');
      setLaunchStatus('ready');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (template || launchStatus === 'loading') return;
    Promise.all([loadRecentProjects(), loadDraftSummaries()]).then(([recent, summaries]) => {
      setRecentProjects(recent);
      setDraftSummaries(summaries.filter((summary) => summary.hasContent && TEMPLATES[summary.templateId].available));
    }).catch(() => setCenterStatus('项目中心读取失败，模板仍可正常使用'));
  }, [template, launchStatus]);

  async function openProjectFromHome() {
    try {
      setCenterStatus('正在打开项目源文件…');
      const handle = supportsProjectFileAccess() ? await chooseProjectOpenHandle() : undefined;
      if (await openDesktopProjectInWindow(handle)) {
        setCenterStatus('源文件已在独立窗口打开');
        return;
      }
      const file = handle ? await handle.getFile() : await chooseProjectOpenFile();
      await activateProject(file, handle, handle ? 'handle' : 'reference');
      setCenterStatus('');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setCenterStatus(error instanceof Error ? error.message : '项目源文件打开失败');
    }
  }

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    async function openPending() {
      try {
        const file = await desktopCall<DesktopFile | null>('take_pending_project');
        if (!file || cancelled) return;
        const handle = desktopHandle(file);
        await activateProject(await handle.getFile(), handle, 'handle');
      } catch (error) {
        await desktopCall('release_project');
        if (!cancelled) setCenterStatus(error instanceof Error ? error.message : '源文件打开失败');
      }
    }
    void openPending();
    return () => { cancelled = true; };
  }, []);

  async function openRecentHere(projectId: string) {
    try {
      setCenterStatus('正在打开最近项目…');
      await openRecent(projectId);
      setCenterStatus('');
    } catch (error) {
      setCenterStatus(error instanceof Error ? error.message : '最近项目打开失败');
    }
  }

  const clearLaunchQuery = () => window.history.replaceState(null, '', window.location.pathname);
  const backToTemplates = async () => {
    if (isDesktop()) await desktopCall('release_project');
    clearLaunchQuery(); setLaunchedProject(undefined); setSceneSlot(undefined); setTemplate(undefined);
  };
  const chooseTemplate = (id: TemplateId, slot = createSceneSlot()) => { clearLaunchQuery(); setLaunchedProject(undefined); setSceneSlot(slot); setTemplate(id); };

  if (launchStatus === 'loading') return <main className="launch-loading" role="status">正在打开项目源文件…</main>;
  if (template && isSingleTemplateId(template)) return <SingleWorkbench key={`${template}:${sceneSlot ?? ''}`} templateId={template} onBack={backToTemplates} initialDraftSlot={sceneSlot} initialProject={launchedProject?.kind === 'single' ? launchedProject.project : undefined} />;
  if (template && isCombinationTemplateId(template)) return <SofaCombinationWorkbench key={`${template}:${sceneSlot ?? ''}`} templateId={template} onBack={backToTemplates} initialDraftSlot={sceneSlot} initialProject={launchedProject?.kind === 'combination' ? launchedProject.project : undefined} />;
  return <main className="template-home">
    <header className="template-header"><AppMark/><strong>SKU 图制作台</strong><div className="header-actions"><span className="save-pill"><i/>项目中心已就绪</span><DesktopAccountButton/><button type="button" className="guide-button" disabled>制作规范说明</button></div></header>
    <section className="template-library">
      <div className="template-hero"><div><p>PROJECT CENTER</p><h1>新建项目或打开源文件</h1><span>临时现场和每份项目源文件独立保存，可在不同窗口同时编辑。</span>{launchError && <strong className="launch-error" role="alert">{launchError}</strong>}</div><div className="project-open-box"><button type="button" onClick={() => void openProjectFromHome()}><SourceFileIcon />打开源文件</button><small>选择电脑中的 .skuwork 源文件继续编辑</small></div></div>
      <aside className="category-panel"><h2>产品分类</h2><div className="category-list">{(['沙发', '睡眠', '办公', '餐桌', '板木'] as const).map((item) => <button type="button" key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}><FurnitureIcon name={CATEGORY_ICON[item]}/><span>{item}</span><small>{availableTemplates.filter((id) => TEMPLATES[id].category === item).length}</small></button>)}</div><div className="category-block"><h3>{category}模板类型</h3><span>新建空白模板，旧内容从现场区继续</span></div></aside>
      <section className="template-content">
        <div className="template-content-head"><div><h2>{category}模板</h2><span>当前显示 {categoryTemplates.filter((id) => TEMPLATES[id].available).length} 个可用模板</span></div></div>
        <div className="template-grid">
          {categoryTemplates.map((id) => {
            const item = TEMPLATES[id];
            const kindLabel = templateKindLabel(id);
            return <button type="button" className={`template-card${item.available ? '' : ' disabled-card'}`} key={id} disabled={!item.available} aria-label={`${item.available ? '新建空白模板' : '正在接入'}：${item.title}（${kindLabel}）`} onClick={() => chooseTemplate(id)}>
              <span className="template-preview"><FurnitureIcon name={TEMPLATE_ICON[id]}/></span>
              <span className="template-tags"><small className={`template-kind-${kindLabel === '组合' ? 'combination' : 'single'}`}><FurnitureIcon name={kindLabel === '组合' ? 'template-combination' : 'template-single'}/>{kindLabel}</small>{!item.available && <small>开发中</small>}</span>
              <strong>{item.title}</strong>
              <span className="template-description">{item.description}</span>
              <span className="template-card-action">{item.available ? '新建空白模板' : '正在接入'}{item.available && <span aria-hidden="true"><FurnitureIcon name="arrow-right"/></span>}</span>
            </button>;
          })}
        </div>
      </section>
        <section className="project-center" aria-labelledby="project-center-title">
          <div className="project-center-head"><div><h2 id="project-center-title">我的工作区</h2><span>现场与源文件互不覆盖</span></div>{centerStatus && <p role="status" aria-atomic="true">{centerStatus}</p>}</div>
          <div className="workspace-groups">
            {draftSummaries.length > 0 && <div className="workspace-group"><h3>临时现场</h3><div className="workspace-card-grid">
              {draftSummaries.map((summary) => {
                const id = summary.templateId;
                return <article className="workspace-card draft-card" key={summary.slot}><span className="workspace-kind"><FurnitureIcon name={TEMPLATE_ICON[id]}/>{TEMPLATES[id].title} 现场</span><strong>{summary.model || '未命名现场'}</strong><small>自动保存于 {formatProjectTime(summary.updatedAt)}</small><button type="button" onClick={() => chooseTemplate(id, summary.slot)}>继续制作</button></article>;
              })}
            </div></div>}
            <div className="workspace-group"><h3>最近源文件 <span>{recentProjects.length}/8</span></h3>{recentProjects.length ? <div className="workspace-card-grid recent-grid">{recentProjects.map((project) => <article className="workspace-card source-card" key={project.projectId}><div><span className="workspace-kind">{TEMPLATES[resolveTemplateId(project.kind, project.templateId)].title}</span><small>{project.access === 'handle' ? '已关联' : project.access === 'relay' ? '本次运行可打开' : '需要重新选择'}</small></div><strong className="source-file-title" title={project.fileName}><SourceFileIcon /><span>{project.fileName}</span></strong><span>{project.model || '未命名 SKU'} · {formatProjectTime(project.lastOpenedAt)}</span><div className="workspace-actions"><button type="button" onClick={() => void openRecentHere(project.projectId)}>打开</button>{!isDesktop() && <a href={`?recent=${encodeURIComponent(project.projectId)}`} target="_blank" rel="noopener">新窗口</a>}</div></article>)}</div> : <div className="workspace-empty"><strong>还没有最近源文件</strong><span>从上方打开已有的 .skuwork 文件。</span></div>}</div>
          </div>
        </section>
    </section>
  </main>;
}
