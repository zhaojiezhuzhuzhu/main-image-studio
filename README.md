# 主图生成器共享站点

Vue 3 + Vite + Element Plus 单项目，整合了模板大厅和双画板主图编辑器。项目不需要账号或后端，图片和模板素材全部随静态站点部署。

## 启动

```bash
npm install
npm run dev
```

打开终端显示的本地地址即可使用。生产构建使用：

```bash
npm run build
npm run preview
```

模板大厅由 `src/App.vue` 管理；完整编辑器保留在 `public/legacy/editor.html`，由 Vue 页面按模板参数加载，原有上传、画板编辑、撤销恢复、图层操作、JPG 和 ZIP 导出功能均可继续使用。静态素材位于 `public/assets` 和 `public/fonts`。

## 目录

```text
src/                  Vue 页面和样式
public/assets/        模板图片和组件素材
public/fonts/         编辑器字体
public/legacy/        双画板编辑器运行文件
dist/                 npm run build 生成的部署文件
```

旧版源目录、备份 HTML、提取脚本和重复发布副本已清理，当前项目以 Vue 入口为准。

编辑器默认展示全部画板；点击画板后进入单画板模式，主图居中显示，右侧打开图层与组件属性面板。组件编辑只在单画板模式启用。
