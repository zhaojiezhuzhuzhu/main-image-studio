<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox, ElTooltip } from 'element-plus'
import { CopyDocument, Delete, EditPen, FolderOpened, Grid, Picture } from '@element-plus/icons-vue'

const editing = ref(false)
const activePage = ref('templates')
const templateId = ref('1')
const myTemplateId = ref('')
const myTemplateBaseId = ref('1')
const myTemplates = ref([])
const myTemplatesLoading = ref(false)
const myTemplatesError = ref('')

const templates = [
  {
    id: '1',
    name: '沙发模板1',
    description: '已配置 10 张画板',
    images: ['main1-thumbnail.jpg', 'catalog-portrait-2.jpg', 'catalog-portrait-3.jpg', 'catalog-portrait-4.jpg', 'catalog-portrait-5.jpg']
  },
  {
    id: '2',
    name: '沙发模板2',
    description: '已配置主图1-5竖版',
    images: ['template2-reference-1.jpg', 'template2-reference-2.jpg', 'template2-reference-3.jpg', 'template2-reference-4.jpg', 'sofa-template2/main5-portrait.jpg']
  },
  { id: '3', name: '沙发模板3', description: '画板样式待配置', images: [null, null, null, null, null] },
  { id: 'custom', name: '自定义模板', description: '空白画板', images: [null, null, null, null, null] }
]

const originalTemplate = computed(() => templates.find(item => item.id === templateId.value) || templates[0])
const activeMyTemplate = computed(() => myTemplates.value.find(item => item.templateId === myTemplateId.value))
const currentTemplateName = computed(() => activeMyTemplate.value?.name || originalTemplate.value.name)
const editorUrl = computed(() => {
  const params = new URLSearchParams({ template: myTemplateBaseId.value || templateId.value })
  if (myTemplateId.value) params.set('myTemplate', myTemplateId.value)
  return `/legacy/editor.html?${params}`
})

function getTemplateDescription(template) {
  const configuredIndexes = template.images.map((image, index) => image ? index + 1 : null).filter(Boolean)
  if (!configuredIndexes.length) return template.description
  return `已配置${configuredIndexes.length * 2}个画板`
}

function goEditor(id) {
  templateId.value = id
  myTemplateId.value = ''
  myTemplateBaseId.value = id
  window.location.hash = `/editor?template=${encodeURIComponent(id)}`
}

function editMyTemplate(template) {
  templateId.value = template.baseTemplateId || '1'
  myTemplateBaseId.value = template.baseTemplateId || '1'
  myTemplateId.value = template.templateId
  window.location.hash = `/editor?myTemplate=${encodeURIComponent(template.templateId)}&base=${encodeURIComponent(myTemplateBaseId.value)}`
}

function showPage(page) {
  window.location.hash = page === 'my-templates' ? '/my-templates' : '/'
}

async function refreshMyTemplates() {
  myTemplatesLoading.value = true
  myTemplatesError.value = ''
  try {
    myTemplates.value = await window.MyTemplateStore.listMyTemplates()
  } catch (error) {
    myTemplatesError.value = error?.message || '读取我的模板失败，请重试。'
  } finally {
    myTemplatesLoading.value = false
  }
}

async function duplicateMyTemplate(template) {
  try {
    const copy = await window.MyTemplateStore.duplicateTemplate(template.templateId)
    await refreshMyTemplates()
    ElMessage.success(`已复制为“${copy.name}”`)
  } catch (error) {
    ElMessage.error(error?.message || '复制模板失败，请重试。')
  }
}

async function renameMyTemplate(template) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的模板名称', '重命名模板', {
      inputValue: template.name,
      inputPattern: /\S/,
      inputErrorMessage: '模板名称不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    })
    await window.MyTemplateStore.renameTemplate(template.templateId, value)
    await refreshMyTemplates()
    ElMessage.success('模板名称已更新')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '重命名失败，请重试。')
  }
}

async function deleteMyTemplate(template) {
  try {
    await ElMessageBox.confirm(`删除后无法恢复，确定删除“${template.name}”吗？`, '删除模板', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      confirmButtonClass: 'danger-confirm'
    })
    await window.MyTemplateStore.deleteTemplate(template.templateId)
    await refreshMyTemplates()
    ElMessage.success('模板已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error?.message || '删除模板失败，请重试。')
  }
}

function formatUpdatedAt(value) {
  if (!value) return '未知时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date)
}

async function syncRoute() {
  const hash = window.location.hash || '#/'
  const isEditorRoute = hash.startsWith('#/editor')
  const params = new URLSearchParams(hash.split('?')[1] || '')
  if (isEditorRoute) {
    editing.value = true
    myTemplateId.value = params.get('myTemplate') || ''
    if (myTemplateId.value) {
      let baseId = params.get('base') || ''
      if (!baseId) {
        try {
          const record = await window.MyTemplateStore.loadMyTemplate(myTemplateId.value)
          baseId = record?.baseTemplateId || '1'
        } catch {
          baseId = '1'
        }
      }
      myTemplateBaseId.value = baseId
      templateId.value = baseId
    } else {
      templateId.value = params.get('template') || '1'
      myTemplateBaseId.value = templateId.value
    }
    document.title = `${currentTemplateName.value} · 主图编辑器`
    return
  }

  editing.value = false
  myTemplateId.value = ''
  activePage.value = hash.startsWith('#/my-templates') ? 'my-templates' : 'templates'
  document.title = activePage.value === 'my-templates' ? '我的模板 · 主图生成器' : '主图生成器 · 模板大厅'
  if (activePage.value === 'my-templates') await refreshMyTemplates()
}

async function handleEditorMessage(event) {
  if (event.origin !== window.location.origin) return
  const message = event.data || {}
  if (message.type !== 'my-template-saved' && message.type !== 'my-template-updated') return
  await refreshMyTemplates()
}

onMounted(async () => {
  window.addEventListener('popstate', syncRoute)
  window.addEventListener('hashchange', syncRoute)
  window.addEventListener('message', handleEditorMessage)
  await refreshMyTemplates()
  await syncRoute()
})

onUnmounted(() => {
  window.removeEventListener('popstate', syncRoute)
  window.removeEventListener('hashchange', syncRoute)
  window.removeEventListener('message', handleEditorMessage)
})
</script>

<template>
  <div class="app-shell">
    <main v-if="editing" class="editor-shell">
      <iframe :key="editorUrl" class="editor-frame" :src="editorUrl" :title="`${currentTemplateName}编辑器`" allow="download" />
    </main>

    <div v-else class="gallery-shell">
      <header class="site-header">
        <div class="header-inner">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true"><Grid /></span>
            <span>主图生成器</span>
          </div>
          <nav class="header-nav" aria-label="模板导航">
            <button :class="{ active: activePage === 'templates' }" type="button" @click="showPage('templates')">模板列表</button>
            <button :class="{ active: activePage === 'my-templates' }" type="button" @click="showPage('my-templates')">
              我的模板<span v-if="myTemplates.length" class="nav-count">{{ myTemplates.length }}</span>
            </button>
          </nav>
        </div>
      </header>

      <main v-if="activePage === 'templates'" class="gallery-main">
        <div class="page-head">
          <h1>模板列表</h1>
          <span class="count">{{ templates.length }} 个模板<span class="count-separator" aria-hidden="true">/</span>每套 5 张竖版主图</span>
        </div>

        <section v-for="template in templates" :key="template.id" class="template-row" :aria-labelledby="`template-${template.id}`">
          <div class="template-info">
            <div>
              <h2 :id="`template-${template.id}`">{{ template.name }}</h2>
              <p>{{ getTemplateDescription(template) }}</p>
            </div>
            <el-tooltip content="编辑模板" placement="top" :show-after="300">
              <button class="edit-link" type="button" :aria-label="`编辑${template.name}`" @click="goEditor(template.id)">
                <EditPen class="edit-icon" aria-hidden="true" />
              </button>
            </el-tooltip>
          </div>
          <div class="previews">
            <figure v-for="(image, index) in template.images" :key="`${template.id}-${index}`" class="preview">
              <div class="preview-image" :class="{ empty: !image }">
                <img v-if="image" :src="`/assets/${image}`" :alt="`${template.name} 主图${index + 1}竖版预览`" />
                <div v-else class="empty-content">
                  <Picture aria-hidden="true" />
                  <span>{{ template.id === 'custom' ? '空白画板' : '待添加' }}</span>
                </div>
              </div>
              <figcaption class="preview-caption">
                <span>主图 {{ String(index + 1).padStart(2, '0') }}</span>
                <span class="preview-format">竖版</span>
              </figcaption>
            </figure>
          </div>
        </section>
      </main>

      <main v-else class="gallery-main my-templates-main">
        <div class="page-head">
          <div>
            <h1>我的模板</h1>
            <p class="page-description">这里的模板是独立副本，编辑、复制或删除都不会影响系统原始模板。</p>
          </div>
          <span class="count">{{ myTemplates.length }} 个已保存模板</span>
        </div>

        <div v-if="myTemplatesLoading" class="empty-state">正在读取本地模板…</div>
        <div v-else-if="myTemplatesError" class="empty-state error-state">
          <strong>无法读取我的模板</strong>
          <span>{{ myTemplatesError }}</span>
          <button type="button" @click="refreshMyTemplates">重试</button>
        </div>
        <div v-else-if="!myTemplates.length" class="empty-state">
          <FolderOpened aria-hidden="true" />
          <strong>还没有保存的模板</strong>
          <span>打开任意原始模板进行编辑，然后点击“保存到我的模板”。</span>
          <button type="button" @click="showPage('templates')">浏览模板列表</button>
        </div>
        <section v-else class="my-template-grid" aria-label="已保存模板列表">
          <article v-for="template in myTemplates" :key="template.templateId" class="my-template-card">
            <button class="my-template-preview" type="button" :aria-label="`编辑${template.name}`" @click="editMyTemplate(template)">
              <img v-if="template.thumbnail" :src="template.thumbnail" :alt="`${template.name}缩略图`" />
              <span v-else class="empty-content"><Picture aria-hidden="true" />暂无缩略图</span>
              <span class="preview-edit">打开编辑</span>
            </button>
            <div class="my-template-body">
              <h2 :title="template.name">{{ template.name }}</h2>
              <p>{{ template.boardCount || 0 }} 张画板</p>
              <time :datetime="template.updatedAt">最近修改 {{ formatUpdatedAt(template.updatedAt) }}</time>
              <div class="card-actions">
                <button class="primary-card-action" type="button" @click="editMyTemplate(template)"><EditPen />编辑</button>
                <el-tooltip content="重命名" placement="top"><button type="button" aria-label="重命名" @click="renameMyTemplate(template)"><EditPen /></button></el-tooltip>
                <el-tooltip content="复制" placement="top"><button type="button" aria-label="复制" @click="duplicateMyTemplate(template)"><CopyDocument /></button></el-tooltip>
                <el-tooltip content="删除" placement="top"><button class="danger-action" type="button" aria-label="删除" @click="deleteMyTemplate(template)"><Delete /></button></el-tooltip>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  </div>
</template>
