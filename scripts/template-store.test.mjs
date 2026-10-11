import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'

class FakeRequest {
  result = undefined
  error = null
  onsuccess = null
  onerror = null
  onupgradeneeded = null
  onblocked = null
}

class FakeObjectStore {
  constructor(records, transaction = null) {
    this.records = records
    this.transaction = transaction
  }

  createIndex() {}

  finish(request, operation) {
    queueMicrotask(() => {
      try {
        request.result = operation()
        request.onsuccess?.()
        this.transaction?.oncomplete?.()
      } catch (error) {
        request.error = error
        request.onerror?.()
        if (this.transaction) {
          this.transaction.error = error
          this.transaction.onerror?.()
        }
      }
    })
    return request
  }

  add(value) {
    return this.finish(new FakeRequest(), () => {
      if (this.records.has(value.templateId)) throw new Error('duplicate key')
      this.records.set(value.templateId, structuredClone(value))
      return value.templateId
    })
  }

  put(value) {
    return this.finish(new FakeRequest(), () => {
      this.records.set(value.templateId, structuredClone(value))
      return value.templateId
    })
  }

  get(key) {
    return this.finish(new FakeRequest(), () => {
      const value = this.records.get(key)
      return value ? structuredClone(value) : undefined
    })
  }

  getAll() {
    return this.finish(new FakeRequest(), () => [...this.records.values()].map(value => structuredClone(value)))
  }

  delete(key) {
    return this.finish(new FakeRequest(), () => this.records.delete(key))
  }
}

class FakeDatabase {
  constructor() {
    this.records = new Map()
    this.objectStoreNames = { contains: name => name === 'myTemplates' && this.created }
  }

  createObjectStore() {
    this.created = true
    return new FakeObjectStore(this.records)
  }

  transaction() {
    const transaction = { error: null, oncomplete: null, onerror: null, onabort: null }
    transaction.objectStore = () => new FakeObjectStore(this.records, transaction)
    return transaction
  }

  close() {}
}

const database = new FakeDatabase()
const indexedDB = {
  open() {
    const request = new FakeRequest()
    queueMicrotask(() => {
      request.result = database
      request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  }
}

const window = { indexedDB, structuredClone, crypto: webcrypto }
const source = await readFile(new URL('../public/template-store.js', import.meta.url), 'utf8')
vm.runInNewContext(source, { window, Date, Error, JSON, Math, Number, Object, Promise, String })

const store = window.MyTemplateStore
const sourceState = { boards: [{ key: 'square', text1: '原文', extra: [{ id: 1, style: { color: '#fff' } }] }] }
const original = await store.saveAsMyTemplate({ name: '模板A', baseTemplateId: '1', state: sourceState, boardCount: 10 })

sourceState.boards[0].text1 = '外部修改'
assert.equal((await store.loadMyTemplate(original.templateId)).state.boards[0].text1, '原文', '保存数据必须和编辑器对象隔离')

await store.updateMyTemplate(original.templateId, { state: { boards: [{ key: 'square', text1: '已保存修改' }] } })
assert.equal((await store.loadMyTemplate(original.templateId)).state.boards[0].text1, '已保存修改', '保存修改应覆盖当前模板')

const copy = await store.duplicateTemplate(original.templateId)
assert.notEqual(copy.templateId, original.templateId, '复制模板必须生成独立 templateId')
assert.equal(copy.name, '模板A - 副本')
await store.updateMyTemplate(copy.templateId, { state: { boards: [{ key: 'square', text1: '副本内容' }] } })
assert.equal((await store.loadMyTemplate(original.templateId)).state.boards[0].text1, '已保存修改', '修改副本不得影响原模板')

await store.renameTemplate(original.templateId, '模板A（重命名）')
assert.equal((await store.loadMyTemplate(original.templateId)).name, '模板A（重命名）')
assert.equal((await store.listMyTemplates()).length, 2)

assert.equal(await store.deleteTemplate(copy.templateId), true)
assert.equal(await store.loadMyTemplate(copy.templateId), null)
assert.ok(await store.loadMyTemplate(original.templateId), '删除副本不得影响原模板')

console.log('template-store tests passed')
