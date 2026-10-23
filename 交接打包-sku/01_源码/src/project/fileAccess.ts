import { chooseDesktopProject, isDesktop } from '../desktop/runtime';

export type ProjectWritable = {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
};

export type ProjectFileHandle = {
  name: string;
  persistable?: boolean;
  getFile(): Promise<File>;
  createWritable(): Promise<ProjectWritable>;
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>;
};

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<ProjectFileHandle>;
  showOpenFilePicker?: (options: {
    multiple: false;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<ProjectFileHandle[]>;
};

const PICKER_TYPES = [{
  description: 'SKU 制作台项目源文件',
  accept: { 'application/x-skuwork': ['.skuwork'] },
}];

export function supportsProjectFileAccess(): boolean {
  if (isDesktop()) return true;
  const pickerWindow = window as FilePickerWindow;
  return Boolean(pickerWindow.showSaveFilePicker && pickerWindow.showOpenFilePicker);
}

export async function chooseProjectSaveHandle(suggestedName: string): Promise<ProjectFileHandle> {
  if (isDesktop()) return chooseDesktopProject(true, suggestedName);
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  if (!picker) throw new Error('当前浏览器不支持源文件自动保存，请使用最新版 Edge 或 Chrome');
  return picker({ suggestedName, types: PICKER_TYPES });
}

export async function chooseProjectOpenHandle(): Promise<ProjectFileHandle> {
  if (isDesktop()) return chooseDesktopProject(false);
  const picker = (window as FilePickerWindow).showOpenFilePicker;
  if (!picker) throw new Error('当前浏览器不支持打开项目源文件，请使用最新版 Edge 或 Chrome');
  const [handle] = await picker({ multiple: false, types: PICKER_TYPES });
  if (!handle) throw new Error('没有选择项目源文件');
  return handle;
}

export function chooseProjectOpenFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.skuwork,application/x-skuwork';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) resolve(file);
      else reject(new DOMException('没有选择项目源文件', 'AbortError'));
    }, { once: true });
    input.click();
  });
}

export function downloadProjectFile(contents: Blob, fileName: string): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(contents);
  link.download = fileName;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function ensureWritePermission(handle: ProjectFileHandle, request: boolean): Promise<boolean> {
  if (!handle.queryPermission) return true;
  if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') return true;
  if (!request || !handle.requestPermission) return false;
  return await handle.requestPermission({ mode: 'readwrite' }) === 'granted';
}

export async function writeProjectFile(handle: ProjectFileHandle, contents: Blob): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(contents);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
}
