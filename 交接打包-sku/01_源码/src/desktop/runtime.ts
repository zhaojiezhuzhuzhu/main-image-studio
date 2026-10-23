import { invoke, isTauri } from '@tauri-apps/api/core';
import type { ProjectFileHandle, ProjectWritable } from '../project/fileAccess';

export type DesktopUser = { id: string; name: string; role: 'admin' | 'user'; enabled: boolean };
export type DesktopFile = { id: string; name: string };
export const isDesktop = () => typeof window !== 'undefined' && isTauri();
let activeUserId = '';
let flushEditor: (() => Promise<void>) | undefined;

export async function desktopCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try { return await invoke<T>(command, args); }
  catch (error) { throw error instanceof Error ? error : new Error(String(error)); }
}
export function setDesktopUser(user: DesktopUser | null) { activeUserId = user?.id ?? ''; }
export function accountDatabase(name: string): string {
  if (!isDesktop()) return name;
  if (!activeUserId) throw new Error('请先登录后读取制作现场');
  return `${name}:desktop:${activeUserId}`;
}
export function registerDesktopFlush(flush: () => Promise<void>) {
  if (!isDesktop()) return () => undefined;
  flushEditor = flush;
  return () => { if (flushEditor === flush) flushEditor = undefined; };
}
export async function flushDesktopEditor() { await flushEditor?.(); }

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('文件读取失败，请重试'));
    reader.readAsDataURL(blob);
  });
}
export type DesktopHandle = ProjectFileHandle & { desktopId: string };
export async function openDesktopProjectInWindow(handle?: ProjectFileHandle): Promise<boolean> {
  if (!isDesktop()) return false;
  if (!handle || !('desktopId' in handle)) throw new Error('请重新选择要打开的源文件');
  await desktopCall('open_project_window', { id: handle.desktopId });
  return true;
}
export function desktopHandle(file: DesktopFile): DesktopHandle {
  return {
    name: file.name,
    desktopId: file.id,
    async getFile() {
      const data = await desktopCall<ArrayBuffer>('read_project', { id: file.id });
      return new File([data], file.name, { type: 'application/x-skuwork' });
    },
    async createWritable(): Promise<ProjectWritable> {
      let pending: Blob | undefined;
      return {
        async write(data) { pending = data; },
        async close() {
          if (!pending) throw new Error('没有可保存的项目内容');
          await desktopCall('write_project', { id: file.id, contents: await blobBase64(pending) });
          pending = undefined;
        },
        async abort() { pending = undefined; },
      };
    },
  };
}
export async function chooseDesktopProject(save: boolean, suggestedName?: string): Promise<DesktopHandle> {
  const file = await desktopCall<DesktopFile | null>('pick_project', { save, suggestedName });
  if (!file) throw new DOMException('已取消选择', 'AbortError');
  return desktopHandle(file);
}
export async function exportCanvasJpg(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const data = canvas.toDataURL('image/jpeg', 0.95);
  if (isDesktop()) {
    await desktopCall('export_jpg', { name, contents: data.split(',')[1] });
    return;
  }
  const link = document.createElement('a'); link.download = name; link.href = data; link.click();
}
