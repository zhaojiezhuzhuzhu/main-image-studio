<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElButton } from 'element-plus'

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
        <div class="brand">主图生成器</div>
        <span class="header-meta">模板大厅</span>
      </header>

      <main class="gallery-main">
        <div class="page-head">
          <h1>模板列表</h1>
          <span class="count">4 个模板 · 每套 5 张竖版主图</span>
        </div>

        <section v-for="template in templates" :key="template.id" class="template-row" :aria-labelledby="`template-${template.id}`">
          <div class="template-info">
            <div>
              <h2 :id="`template-${template.id}`">{{ template.name }}</h2>
              <p>{{ template.description }}</p>
            </div>
            <el-button class="edit-link" type="primary" size="small" @click="goEditor(template.id)">点击编辑 <span aria-hidden="true">→</span></el-button>
          </div>
          <div class="previews">
            <div v-for="(image, index) in template.images" :key="`${template.id}-${index}`" class="preview" :class="{ empty: !image }">
              <img v-if="image" :src="`/assets/${image}`" :alt="`${template.name} 主图${index + 1}竖版预览`" />
              <span class="number">主图{{ index + 1 }}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
