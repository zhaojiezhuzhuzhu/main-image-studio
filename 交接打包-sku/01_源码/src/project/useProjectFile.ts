import { useEffect, useRef, useState } from 'react';
import type { SofaCombinationDraft, WorkbenchDraft } from '../storage/draftStorage';
import { saveRecentProject } from '../storage/projectCatalog';
import { saveProjectHandle } from '../storage/projectHandleStorage';
import {
  chooseProjectOpenHandle,
  chooseProjectOpenFile,
  chooseProjectSaveHandle,
  downloadProjectFile,
  ensureWritePermission,
  type ProjectFileHandle,
  supportsProjectFileAccess,
  writeProjectFile,
} from './fileAccess';
import { createProjectId, decodeProjectFile, encodeProjectFile, suggestedProjectName } from './projectFile';
import { snapshotKey } from './snapshotKey';
import { resolveTemplateId, TEMPLATES, type TemplateId } from '../domain/templates';
import { openDesktopProjectInWindow } from '../desktop/runtime';

type ProjectDraft = WorkbenchDraft | SofaCombinationDraft;
type ProjectKind = 'single' | 'combination';

export type ProjectLaunch<T extends ProjectDraft> = {
  projectId: string;
  fileName: string;
  draft: T;
  handle?: ProjectFileHandle;
};

type UseProjectFileOptions<T extends ProjectDraft> = {
  kind: ProjectKind;
  templateId?: TemplateId;
  enabled: boolean;
  draft: T;
  initialProject?: ProjectLaunch<T>;
  onOpen: (draft: T, projectId: string) => void | Promise<void>;
  onProjectIdChange?: (projectId: string) => void | Promise<void>;
};

function isCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function encode<T extends ProjectDraft>(kind: ProjectKind, draft: T, projectId: string): Promise<Blob> {
  return kind === 'single'
    ? encodeProjectFile(draft as WorkbenchDraft, 'single', projectId)
    : encodeProjectFile(draft as SofaCombinationDraft, 'combination', projectId);
}

function handleStorageKey(kind: ProjectKind, projectId: string) {
  return `project:${kind}:${projectId}`;
}

function recentProject<T extends ProjectDraft>(kind: ProjectKind, projectId: string, fileName: string, draft: T, access: 'handle' | 'reference') {
  return saveRecentProject({ projectId, kind, templateId: resolveTemplateId(kind, draft.templateId), fileName, model: draft.model, lastOpenedAt: Date.now(), access });
}

export function useProjectFile<T extends ProjectDraft>({ kind, templateId = resolveTemplateId(kind), enabled, draft, initialProject, onOpen, onProjectIdChange }: UseProjectFileOptions<T>) {
  const draftRef = useRef(draft);
  const onOpenRef = useRef(onOpen);
  const onProjectIdChangeRef = useRef(onProjectIdChange);
  const handleRef = useRef<ProjectFileHandle | undefined>(initialProject?.handle);
  const projectIdRef = useRef(initialProject?.projectId ?? '');
  const saveQueue = useRef(Promise.resolve());
  const lastSavedKey = useRef(initialProject ? snapshotKey(initialProject.draft) : '');
  const changeKey = snapshotKey(draft);
  const [fileName, setFileName] = useState(initialProject?.fileName ?? '');
  const [status, setStatus] = useState(initialProject ? '项目源文件已打开，修改后自动保存' : '尚未建立项目源文件');

  draftRef.current = draft;
  onOpenRef.current = onOpen;
  onProjectIdChangeRef.current = onProjectIdChange;

  useEffect(() => {
    if (!enabled || !handleRef.current) return;
    if (!lastSavedKey.current) {
      lastSavedKey.current = changeKey;
      return;
    }
    if (lastSavedKey.current === changeKey) return;
    const timer = window.setTimeout(() => {
      const handle = handleRef.current;
      if (!handle) return;
      const keyAtStart = snapshotKey(draftRef.current);
      setStatus('正在保存项目源文件…');
      saveQueue.current = saveQueue.current.then(async () => {
        if (!await ensureWritePermission(handle, false)) {
          setStatus('点击“保存源文件”恢复自动保存权限');
          return;
        }
        const contents = await encode(kind, draftRef.current, projectIdRef.current);
        await writeProjectFile(handle, contents);
        lastSavedKey.current = keyAtStart;
        setStatus(keyAtStart === snapshotKey(draftRef.current) ? '项目源文件已自动保存' : '源文件有新修改，等待保存');
      }).catch((error) => setStatus(error instanceof Error ? error.message : '源文件自动保存失败，请点击保存'));
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [changeKey, enabled, kind]);

  async function writeTo(handle: ProjectFileHandle, requestPermission: boolean, requestedProjectId?: string) {
    if (!await ensureWritePermission(handle, requestPermission)) throw new Error('没有获得项目源文件写入权限');
    const projectId = requestedProjectId ?? (projectIdRef.current || createProjectId());
    setStatus('正在保存项目源文件…');
    const contents = await encode(kind, draftRef.current, projectId);
    await writeProjectFile(handle, contents);
    handleRef.current = handle;
    projectIdRef.current = projectId;
    await onProjectIdChangeRef.current?.(projectId);
    setFileName(handle.name);
    lastSavedKey.current = snapshotKey(draftRef.current);
    if (handle.persistable !== false) await saveProjectHandle(handleStorageKey(kind, projectId), handle);
    await recentProject(kind, projectId, handle.name, draftRef.current, handle.persistable === false ? 'reference' : 'handle');
    setStatus('项目源文件已保存');
  }

  async function save() {
    try {
      if (!supportsProjectFileAccess()) {
        const projectId = projectIdRef.current || createProjectId();
        const contents = await encode(kind, draftRef.current, projectId);
        downloadProjectFile(contents, suggestedProjectName(draftRef.current.model, kind));
        projectIdRef.current = projectId;
        await onProjectIdChangeRef.current?.(projectId);
        lastSavedKey.current = snapshotKey(draftRef.current);
        await recentProject(kind, projectId, suggestedProjectName(draftRef.current.model, kind), draftRef.current, 'reference');
        setStatus('源文件已下载；当前浏览器需手动保存更新');
        return;
      }
      const handle = handleRef.current ?? await chooseProjectSaveHandle(suggestedProjectName(draftRef.current.model, kind));
      await writeTo(handle, true);
    } catch (error) {
      if (!isCancelled(error)) {
        setStatus(error instanceof Error ? error.message : '项目源文件保存失败');
      }
    }
  }

  async function saveAs() {
    try {
      if (!supportsProjectFileAccess()) {
        const projectId = createProjectId();
        const contents = await encode(kind, draftRef.current, projectId);
        downloadProjectFile(contents, suggestedProjectName(draftRef.current.model, kind));
        projectIdRef.current = projectId;
        await onProjectIdChangeRef.current?.(projectId);
        lastSavedKey.current = snapshotKey(draftRef.current);
        await recentProject(kind, projectId, suggestedProjectName(draftRef.current.model, kind), draftRef.current, 'reference');
        setStatus('源文件已下载；当前浏览器需手动保存更新');
        return;
      }
      const handle = await chooseProjectSaveHandle(suggestedProjectName(draftRef.current.model, kind));
      await writeTo(handle, true, createProjectId());
    } catch (error) {
      if (!isCancelled(error)) {
        setStatus(error instanceof Error ? error.message : '项目源文件另存失败');
      }
    }
  }

  async function flush() {
    const handle = handleRef.current;
    if (!handle || !await ensureWritePermission(handle, false).catch(() => false)) return;
    const keyAtStart = snapshotKey(draftRef.current);
    if (keyAtStart === lastSavedKey.current) return;
    await saveQueue.current.catch(() => undefined);
    const contents = await encode(kind, draftRef.current, projectIdRef.current);
    await writeProjectFile(handle, contents);
    lastSavedKey.current = keyAtStart;
    setStatus('项目源文件已保存');
  }

  async function open() {
    const previousStatus = status;
    try {
      setStatus('正在打开项目源文件…');
      const handle = supportsProjectFileAccess() ? await chooseProjectOpenHandle() : undefined;
      if (await openDesktopProjectInWindow(handle)) {
        setStatus('源文件已在独立窗口打开，当前项目保留');
        return;
      }
      const file = handle ? await handle.getFile() : await chooseProjectOpenFile();
      const document = await decodeProjectFile(file);
      const documentTemplateId = resolveTemplateId(document.kind, document.draft.templateId);
      if (document.kind !== kind || documentTemplateId !== templateId) throw new Error(`这是${TEMPLATES[documentTemplateId].title}源文件，请返回模板首页打开`);
      await onOpenRef.current(document.draft as T, document.projectId);
      handleRef.current = handle;
      projectIdRef.current = document.projectId;
      setFileName(file.name);
      lastSavedKey.current = snapshotKey(document.draft);
      if (handle && handle.persistable !== false) await saveProjectHandle(handleStorageKey(kind, document.projectId), handle);
      await recentProject(kind, document.projectId, file.name, document.draft as T, handle ? 'handle' : 'reference');
      setStatus(handle ? '项目源文件已打开' : '项目已打开；当前浏览器需手动保存更新');
    } catch (error) {
      if (!isCancelled(error)) {
        setStatus(error instanceof Error ? error.message : '项目源文件打开失败');
      } else setStatus(previousStatus);
    }
  }

  return { fileName, status, open, save, saveAs, flush };
}
