<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElTooltip } from 'element-plus'
import { EditPen, Grid, Picture } from '@element-plus/icons-vue'

const editing = ref(false)
const templateId = ref('1')

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

const currentTemplate = computed(() => templates.find(item => item.id === templateId.value) || templates[0])
const editorUrl = computed(() => `/legacy/editor.html?template=${encodeURIComponent(templateId.value)}`)

function getTemplateDescription(template) {
  const configuredIndexes = template.images
    .map((image, index) => image ? index + 1 : null)
    .filter(Boolean)

  if (!configuredIndexes.length) return template.description

  return `已配置${configuredIndexes.length * 2}个画板`
}

function goEditor(id) {
  templateId.value = id
  editing.value = true
  window.history.pushState({ editor: true, template: id }, '', `/#/editor?template=${encodeURIComponent(id)}`)
  document.title = `${currentTemplate.value.name} · 主图编辑器`
}

function syncRoute() {
  const hash = window.location.hash
  const isEditorRoute = hash.startsWith('#/editor')
  const params = new URLSearchParams(hash.split('?')[1] || '')
  if (isEditorRoute) {
    templateId.value = params.get('template') || '1'
    editing.value = true
    document.title = `${currentTemplate.value.name} · 主图编辑器`
  } else {
    editing.value = false
    document.title = '主图生成器 · 模板大厅'
  }
}

onMounted(() => {
  window.addEventListener('popstate', syncRoute)
  window.addEventListener('hashchange', syncRoute)
})
onUnmounted(() => {
  window.removeEventListener('popstate', syncRoute)
  window.removeEventListener('hashchange', syncRoute)
})
syncRoute()
</script>

<template>
  <div class="app-shell">
    <main v-if="editing" class="editor-shell">
      <iframe :key="editorUrl" class="editor-frame" :src="editorUrl" :title="`${currentTemplate.name}编辑器`" allow="download" />
    </main>

    <div v-else class="gallery-shell">
      <header class="site-header">
        <div class="header-inner">
          <div class="brand">
            <span class="brand-mark" aria-hidden="true"><Grid /></span>
            <span>主图生成器</span>
          </div>
        </div>
      </header>

      <main class="gallery-main">
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
              <button
                class="edit-link"
                type="button"
                :aria-label="`编辑${template.name}`"
                @click="goEditor(template.id)"
              >
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
    </div>
  </div>
</template>
