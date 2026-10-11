(function (global) {
  "use strict";

  const DB_NAME = "main-image-studio";
  const DB_VERSION = 1;
  const STORE_NAME = "myTemplates";
  let databasePromise;

  function createTemplateId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `template-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    if (global.structuredClone) return global.structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeName(name) {
    const value = String(name || "").trim();
    if (!value) throw new Error("请输入模板名称");
    if (value.length > 80) throw new Error("模板名称不能超过 80 个字符");
    return value;
  }

  function friendlyStorageError(error) {
    if (error?.name === "QuotaExceededError") {
      return new Error("本地存储空间不足，模板未保存。请删除不需要的模板或清理浏览器存储后重试。");
    }
    if (error?.name === "SecurityError") {
      return new Error("浏览器阻止了本地存储，请允许此网站保存本地数据后重试。");
    }
    if (error?.message) return error;
    return new Error("本地模板存储失败，请重试。");
  }

  function openDatabase() {
    if (!global.indexedDB) return Promise.reject(new Error("当前浏览器不支持 IndexedDB，无法保存模板。"));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = global.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: "templateId" });
          store.createIndex("updatedAt", "updatedAt");
          store.createIndex("baseTemplateId", "baseTemplateId");
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => {
        databasePromise = undefined;
        reject(friendlyStorageError(request.error));
      };
      request.onblocked = () => reject(new Error("模板存储正在被其他页面占用，请关闭其他页面后重试。"));
    });
    return databasePromise;
  }

  async function runTransaction(mode, operation) {
    try {
      const database = await openDatabase();
      return await new Promise((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        let result;
        try {
          result = operation(store, transaction);
        } catch (error) {
          reject(error);
          return;
        }
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(friendlyStorageError(transaction.error));
        transaction.onabort = () => reject(friendlyStorageError(transaction.error));
      });
    } catch (error) {
      throw friendlyStorageError(error);
    }
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(friendlyStorageError(request.error));
    });
  }

  async function saveAsMyTemplate(input) {
    const now = new Date().toISOString();
    const record = {
      schemaVersion: 1,
      templateId: createTemplateId(),
      baseTemplateId: String(input.baseTemplateId || "1"),
      name: normalizeName(input.name),
      boardCount: Number(input.boardCount || input.state?.boards?.length || 0),
      thumbnail: input.thumbnail || null,
      state: clone(input.state),
      createdAt: now,
      updatedAt: now
    };
    await runTransaction("readwrite", store => store.add(record));
    return clone(record);
  }

  async function updateMyTemplate(templateId, updates) {
    const existing = await loadMyTemplate(templateId);
    if (!existing) throw new Error("未找到要保存的模板，它可能已被删除。");
    const record = {
      ...existing,
      ...clone(updates),
      templateId: existing.templateId,
      baseTemplateId: existing.baseTemplateId,
      name: updates.name === undefined ? existing.name : normalizeName(updates.name),
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
    await runTransaction("readwrite", store => store.put(record));
    return clone(record);
  }

  async function duplicateTemplate(templateId, name) {
    const source = await loadMyTemplate(templateId);
    if (!source) throw new Error("未找到要复制的模板，它可能已被删除。");
    return saveAsMyTemplate({
      name: name || `${source.name} - 副本`,
      baseTemplateId: source.baseTemplateId,
      boardCount: source.boardCount,
      thumbnail: source.thumbnail,
      state: source.state
    });
  }

  async function deleteTemplate(templateId) {
    const existing = await loadMyTemplate(templateId);
    if (!existing) return false;
    await runTransaction("readwrite", store => store.delete(String(templateId)));
    return true;
  }

  async function renameTemplate(templateId, name) {
    return updateMyTemplate(templateId, { name: normalizeName(name) });
  }

  async function loadMyTemplate(templateId) {
    try {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const result = await requestResult(transaction.objectStore(STORE_NAME).get(String(templateId)));
      return result ? clone(result) : null;
    } catch (error) {
      throw friendlyStorageError(error);
    }
  }

  async function listMyTemplates() {
    try {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
      return records
        .map(record => ({
          templateId: record.templateId,
          baseTemplateId: record.baseTemplateId,
          name: record.name,
          boardCount: record.boardCount,
          thumbnail: record.thumbnail,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt
        }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    } catch (error) {
      throw friendlyStorageError(error);
    }
  }

  global.MyTemplateStore = Object.freeze({
    saveAsMyTemplate,
    updateMyTemplate,
    duplicateTemplate,
    deleteTemplate,
    renameTemplate,
    loadMyTemplate,
    listMyTemplates
  });
})(window);
