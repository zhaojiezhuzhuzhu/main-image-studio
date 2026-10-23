import type { ProjectFileHandle } from '../project/fileAccess';
import { accountDatabase, desktopHandle, type DesktopHandle } from '../desktop/runtime';
import type { DraftSlot } from './draftStorage';

const DATABASE_NAME = 'sofa-sku-project-handles';
const DATABASE_VERSION = 1;
const STORE_NAME = 'handles';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(accountDatabase(DATABASE_NAME), DATABASE_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开项目文件关联存储'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('项目文件关联存储失败'));
    transaction.onabort = () => reject(transaction.error ?? new Error('项目文件关联存储已中止'));
  });
}

export async function saveProjectHandle(slot: DraftSlot, handle: ProjectFileHandle): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const desktopId = (handle as DesktopHandle).desktopId;
    transaction.objectStore(STORE_NAME).put(desktopId ? { desktopId, name: handle.name } : handle, slot);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function loadProjectHandle(slot: DraftSlot): Promise<ProjectFileHandle | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(slot);
      request.onsuccess = () => {
        const stored = request.result as (ProjectFileHandle & { desktopId?: string }) | undefined;
        resolve(stored?.desktopId ? desktopHandle({ id: stored.desktopId, name: stored.name }) : stored ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('读取项目文件关联失败'));
    });
  } finally {
    database.close();
  }
}

export async function clearProjectHandle(slot: DraftSlot): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(slot);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
