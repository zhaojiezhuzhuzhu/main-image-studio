const DB_NAME = 'main-image-studio-single'
const DB_VERSION = 1
const STORE_NAME = 'projects'

let databasePromise

function friendlyStorageError(error) {
  if (error?.name === 'QuotaExceededError') {
    return new Error('本地存储空间不足。请删除不需要的单图项目后重试。')
  }
  if (error?.name === 'SecurityError') {
    return new Error('浏览器阻止了本地存储，请允许此站点保存数据。')
  }
  return error instanceof Error ? error : new Error('单图项目保存失败，请重试。')
}

function openDatabase() {
  if (!window.indexedDB) return Promise.reject(new Error('当前浏览器不支持 IndexedDB，无法保存单图项目。'))
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'projectId' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = undefined
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = undefined
      reject(friendlyStorageError(request.error))
    }
    request.onblocked = () => reject(new Error('本地项目数据库正在被其他页面占用。'))
  })

  return databasePromise
}

function clone(value) {
  if (value === undefined) return undefined
  // Vue refs may contain Proxy objects that structuredClone cannot serialize.
  return JSON.parse(JSON.stringify(value))
}

async function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(friendlyStorageError(request.error))
  })
}

async function withStore(mode, operation) {
  try {
    const database = await openDatabase()
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const store = transaction.objectStore(STORE_NAME)
      let result
      try {
        result = operation(store)
      } catch (error) {
        reject(error)
        return
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(friendlyStorageError(transaction.error))
      transaction.onabort = () => reject(friendlyStorageError(transaction.error))
    })
  } catch (error) {
    throw friendlyStorageError(error)
  }
}

export function createProjectId() {
  return window.crypto?.randomUUID?.() || `single-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function saveSingleProject(project) {
  const now = new Date().toISOString()
  const record = {
    ...clone(project),
    schemaVersion: 1,
    projectId: String(project.projectId || createProjectId()),
    name: String(project.name || '未命名单图').trim().slice(0, 80) || '未命名单图',
    createdAt: project.createdAt || now,
    updatedAt: now
  }
  await withStore('readwrite', store => store.put(record))
  return clone(record)
}

export async function loadSingleProject(projectId) {
  try {
    const database = await openDatabase()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(String(projectId)))
    return record ? clone(record) : null
  } catch (error) {
    throw friendlyStorageError(error)
  }
}

export async function listSingleProjects() {
  try {
    const database = await openDatabase()
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll())
    return records
      .map(record => ({
        projectId: record.projectId,
        name: record.name,
        thumbnail: record.editState?.previewImage || record.currentImage || record.sourceImage || record.rawImage || null,
        stage: record.stage || 'generate',
        historyCount: record.history?.length || 0,
        sourceWidth: record.stage === 'crop' ? record.rawWidth || record.sourceWidth || 0 : record.sourceWidth || 0,
        sourceHeight: record.stage === 'crop' ? record.rawHeight || record.sourceHeight || 0 : record.sourceHeight || 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  } catch (error) {
    throw friendlyStorageError(error)
  }
}

export async function deleteSingleProject(projectId) {
  await withStore('readwrite', store => store.delete(String(projectId)))
}
