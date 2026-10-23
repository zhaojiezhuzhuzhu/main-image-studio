import type { ProjectKind } from '../project/projectFile';
import { accountDatabase } from '../desktop/runtime';
import type { TemplateId } from '../domain/templates';

const DATABASE_NAME = 'sofa-sku-project-catalog';
const DATABASE_VERSION = 1;
const STORE_NAME = 'recent-projects';
const RECENT_LIMIT = 8;

export type ProjectAccess = 'handle' | 'relay' | 'reference';

export type RecentProject = {
  projectId: string;
  kind: ProjectKind;
  templateId?: TemplateId;
  fileName: string;
  model: string;
  lastOpenedAt: number;
  access: ProjectAccess;
  relayToken?: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(accountDatabase(DATABASE_NAME), DATABASE_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('无法打开项目中心存储'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('项目中心存储失败'));
  });
}

export async function saveRecentProject(project: RecentProject): Promise<void> {
  const database = await openDatabase();
  try {
    const previous = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(project.projectId) as IDBRequest<RecentProject | undefined>);
    const access = project.access === 'reference' && previous && previous.access !== 'reference' ? previous.access : project.access;
    await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({
      ...previous,
      ...project,
      access,
      relayToken: project.relayToken ?? previous?.relayToken,
    } satisfies RecentProject));
    const entries = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll() as IDBRequest<RecentProject[]>);
    const stale = entries.sort((left, right) => right.lastOpenedAt - left.lastOpenedAt).slice(RECENT_LIMIT);
    if (stale.length) {
      const cleanupStore = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
      await Promise.all(stale.map((entry) => requestResult(cleanupStore.delete(entry.projectId))));
    }
  } finally {
    database.close();
  }
}

export async function loadRecentProjects(): Promise<RecentProject[]> {
  const database = await openDatabase();
  try {
    const entries = await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll() as IDBRequest<RecentProject[]>);
    return entries.sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
  } finally {
    database.close();
  }
}

export async function loadRecentProject(projectId: string): Promise<RecentProject | null> {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(projectId) as IDBRequest<RecentProject | undefined>) ?? null;
  } finally {
    database.close();
  }
}

export async function clearRecentProjects(): Promise<void> {
  const database = await openDatabase();
  try {
    await requestResult(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear());
  } finally {
    database.close();
  }
}
