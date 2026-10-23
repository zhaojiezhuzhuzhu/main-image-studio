# SKU 制作台资料

SKU 制作台用于将家具产品图片、型号、尺寸、卖点和搭配信息制作成统一规格的 SKU 图片。项目提供浏览器工作台和 Windows 桌面应用，包含 49 个模板入口，覆盖沙发、睡眠、办公、餐桌和板木五类。

本文是制作使用、环境配置和代码接续的统一阅读入口。模板制作规则对应[最终规范 PPT](../../02_规范资料/规范文件/0-各品类SKU模版规范汇总-勿动（最终文件只看这一份为准）.pptx)；精确绘图参数由各模板规则和布局模块定义。

## 阅读导航

- [资料位置](#资料位置)
- [制作流程](#制作流程)
- [画布与编辑](#画布与编辑)
- [源文件与数据](#源文件与数据)
- [环境与启动](#环境与启动)
- [代码结构与整合](#代码结构与整合)
- [开发检查](#开发检查)
- [模板目录](#模板目录)

## 资料位置

以下路径相对交接目录。

| 路径 | 内容 |
|---|---|
| `01_源码/` | React 前端、模板、测试、脚本、Tauri 桌面端和配置 |
| `02_规范资料/规范文件/` | 51 页最终规范 PPT、分层 TIF 与产品参考素材 |
| `02_规范资料/AI阅读版/` | 按 PPT 页码组织的文字与页内图片 |
| `03_验收案例/` | 2 份 `.skuwork` 操作案例及配套产品素材 |
| `04_可选资源/` | 桌面安装程序和 U²-Net 模型 |
| `05_演示资料/` | SKU 操作流程视频 |
| `06_索引与校验/` | 模板索引、文件清单和 SHA256 校验工具 |

[模板索引](../../06_索引与校验/模板索引.json)可按模板 ID、分类和规范页定位；[案例索引](../../03_验收案例/案例可读索引.json)提供源文件中的制作状态和图片资源信息。

规范文字索引便于搜索，原 PPT 提供页面构图、字体、线条、色彩和图层关系。参考素材覆盖规范示例，工作台可用模板见本文模板目录。两份可编辑案例覆盖沙发单品与长餐桌单品，用于操作、文件往返和绘图检查；案例字段展示填写方式，正式制作依据对应商品资料。

## 制作流程

1. 选择产品分类与模板，点击新建空白模板；继续已有制作时，从临时现场或最近源文件进入。
2. 上传产品图片。单品、整组组合、独立搭配图和细节卡按所选模板准备。
3. 填写真实型号、规格、尺寸、卖点、软硬度和搭配说明。
4. 在画布定位产品、尺寸端点、辅助线、型号及说明文字；按模板要求检查安全区与间距。
5. 保存 `.skuwork` 源文件，保留可继续编辑的制作内容。
6. 导出 1440 × 1440 白底 JPG，检查实际商品占比、文字和尺寸线位置。

### 图片准备

- 图片入口支持 PNG、JPG/JPEG 和 WebP，每张图片上限为 30 MB、6400 万像素。
- 透明素材直接进入编辑。白底产品图通过本机 Photoshop 2020 或更高版本生成保持原始像素尺寸和产品位置的透明 PNG。
- 图片自带路径时使用已保存路径；多个路径选择包围范围最大的路径。缺少路径时使用 Photoshop 的主体选择。
- 细节与材质卡片按模板保留背景，支持独立取景和缩放。
- 白底识别与图片处理提示会保留已有画布内容，便于替换合适素材后继续制作。

### 型号与产品信息

文件名解析保留交错字母数字型号、连字符后缀和完整规格，分离材质、颜色等信息。例如 `YZ2R-A-透明素材-1.6m长餐桌-（罗马洞石）.png` 可识别为型号 `YZ2R-A`、规格 `1.6m长餐桌`、其他信息 `罗马洞石`。

名称为空且保持自动填写状态时，上传成功后填入文件名候选；已有名称与手动编辑内容保持原值。可点击“采用文件名名称”使用新候选，并通过撤销恢复。尺寸、材质、功能和软硬度依据实际产品资料填写。

## 画布与编辑

成品画布为 1440 × 1440。字号按 72 ppi 对应 `1pt = 1px`。导出使用 JPG，JPEG 编码质量为 0.95；产品原始透明素材保存在 `.skuwork` 中。

### 产品与尺寸

- 产品支持移动、等比缩放、旋转和恢复自动布局。
- 尺寸微调提供“主线端点”和“辅助线”两种模式，分别使用圆形和菱形控制点。
- 主线端点与辅助线可独立调整，方向键微调、Shift 加速；新建标注及端点拖动时，Shift 按拖动方向约束水平或垂直。
- 拖动高亮主线可平移整条标注，保留尺寸值、线段长度、角度和辅助线长度。
- 拖动过程显示预览，松开后按模板安全区整体适配并保存为一步操作；Esc、失焦或指针取消恢复拖动前状态。

每张产品图可选择“尺寸线固定”或“随产品联动”。首次上传使用联动；成功替换已有产品图片后，对应标注切为固定。重新联动时以当前排版建立相对位置。

### 文字

型号、卖点和尺寸文字按模板支持画布编辑。点击尺寸文字后，可开启“移动标注位置”并拖动文字，也可选择深色或白色。手动定位后的尺寸文字保持画布位置，自动定位的文字按标注关系跟随。

功能单人沙发的摇动与旋转标注支持文字编辑及三点曲线调整。上方为圆弧，下方为椭圆弧；圆形端点控制位置，菱形控制弯曲程度。功能说明由制作者填写。

### 导出条件

导出需要产品图片、型号、有效尺寸标注、规定字体和符合安全区的排版。可选项的检查范围由模板定义。文本容量检查保留完整内容并提示调整。

选框、控制点、编辑输入框和制作要点位于操作覆盖层。成品内容由模板绘制层输出。

### 操作界面

- 使用 B 方案圆角布局与月白石墨配色：灰白背景 `#F1F2F4`、白色面板、石墨色主操作 `#353D49`，选中状态使用青色 `#3AEFD0`。
- 左侧按独立产品组织填写卡片，图片、型号、尺寸和专属字段放在对应卡片中。
- 右侧使用 `WorkbenchSidebar`：上方为可折叠制作要点，下方微调区适配剩余高度。
- 画布标题与实时操作提示使用 `CanvasPanelHeader`。
- 界面样式集中于 `src/ui-moonstone.css`，使用 `--ui-*` 变量及组件作用域；画布字体、线条和布局由模板独立定义。

## 源文件与数据

### 保存与恢复

`.skuwork` 保存产品图片、模板身份、型号、尺寸、标注位置、专属选项和布局。交接制作内容时使用此格式。

- 新建模板从空白开始，同一模板可以保留多份临时现场。
- 有制作内容的临时现场保存在首页，保存源文件后进入最近源文件。
- 支持文件写入授权的浏览器首次保存时选择位置，后续编辑约 1.2 秒后写回同一文件；需要重新授权时通过“保存源文件”恢复权限。
- 采用下载方式保存的浏览器，通过再次保存下载更新后的文件。
- 当前会话保留最近 30 步撤销，支持 Ctrl+Z、Ctrl+Y、Ctrl+Shift+Z；连续输入和移动停止约 450ms 后合并为一步。
- 浏览器恢复区保留最近 10 个轻量状态；打开源文件后建立新的撤销起点。

### 桌面账号与窗口

Windows 桌面版在首次使用时设置本机管理员，密码至少 8 个字符。管理员管理普通用户，两种角色均使用全部制作模板。账号、草稿和最近文件按当前 Windows 用户及软件账号组织。

每份源文件使用独立窗口，相同文件再次打开时激活已有窗口。各窗口独立保存和关闭；返回模板库或正常关闭前保存当前内容。源文件发生外部修改时通过另存处理冲突。

换电脑或在浏览器与桌面之间转移制作内容时，先保存 `.skuwork`，再在目标环境打开。软件升级沿用应用标识 `com.skuworkbench.desktop`，账号与草稿保存在当前 Windows 用户的应用数据目录。

### 文件格式与存储接口

`.skuwork` 使用 `SKUWORK1` 二进制容器：8 字节标记、4 字节小端序清单长度、UTF-8 JSON 清单和顺序图片资源。清单格式版本为 1，记录模板状态、图片长度及 SHA256。

模板身份由 `templateId` 与 `kind` 共同确定。`kind` 为 `single` 或 `combination`，用于编辑器和源文件类型；首页显示的单品/组合标签由模板展示配置决定。

浏览器使用以下 IndexedDB：

| 数据库 | 用途 |
|---|---|
| `sofa-sku-workbench`，版本 2 | 临时现场与恢复状态 |
| `sofa-sku-project-catalog` | 最近源文件 |
| `sofa-sku-project-handles` | 文件访问句柄 |

桌面端通过 `accountDatabase` 添加 `:desktop:<用户ID>` 后缀。统一产品涉及域名、账号或应用标识变化时，应配套安排数据迁移。

## 环境与启动

### 网页开发

工作目录为 `01_源码/`。Node.js 版本满足 Vite 锁定依赖要求：`^20.19.0 || >=22.12.0`。依赖按 `package-lock.json` 安装。

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 43157 --strictPort
```

浏览器打开 `http://127.0.0.1:43157`。使用空闲端口与独立工作副本进行开发验证。

双击 `打开SKU工作台.cmd` 使用本地启动入口，默认端口为 4173。启动器识别本项目服务，并配置当前 Windows 用户的 `.skuwork` 文件图标。

### 字体与 Photoshop

各模板通过 `requiredFonts` 指定字体。本机字体映射位于 `src/project/useCanvasFonts.ts`，涉及 Montserrat Regular、SemiBold，以及方正兰亭准黑、中黑、中粗黑、粗黑等字体。字体通过公司授权渠道安装。

白底图处理需要 Photoshop 2020 或更高版本。处理脚本从 Windows COM 注册表自动识别版本和安装路径；如果已有一个 Photoshop 实例正在运行，则优先安全复用该版本并保留用户当前文档。网页开发服务与桌面端分别通过本地接口和原生命令调用处理脚本。

U²-Net 模型位于 `04_可选资源/本机抠图模型/`。内部模型方案通过 `engine: 'model'` 调用；使用时将模型放到源码的 `public/models/cutout/u2net.onnx`。模型来源、准备脚本和许可证分别位于 `public/models/cutout/` 与 `scripts/prepare-cutout-model.mjs`。

### 桌面开发

桌面环境为 Windows 10/11 x64，运行组件为 WebView2。构建环境使用 Rust stable MSVC 和 Visual Studio C++ 构建工具，Rust 依赖按 `Cargo.lock` 解析。

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run desktop:dev
```

桌面开发配置使用 1420 端口。生成安装包：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-desktop.ps1
```

输出位置为 `releases/<版本>/`，安装程序随附 [Windows 使用说明](desktop-testing-guide.md)。

### 版本信息

| 对象 | 版本 | 代码基线 |
|---|---|---|
| 源码 | 0.1.3 | `427e14959ef74aac1146f5cec8133c97dc8c256b` |
| 桌面安装程序 | 0.1.3 | `02969f30dac7af578b545a43f928ec191eaa44a5` |

安装程序位于 `04_可选资源/桌面安装包0.1.3/`。各依赖的锁定版本见交接根目录的 `项目索引.json`。

## 代码结构与整合

以下路径相对 `01_源码/`。

| 能力 | 主要入口 |
|---|---|
| 应用挂载、首页与模板选择 | `src/main.tsx`、`src/App.tsx` |
| 模板身份与注册 | `src/domain/templates.ts`、`src/templates/registry.ts`、`src/templates/types.ts` |
| 公共编辑器 | `src/SingleWorkbench.tsx`、`src/SofaCombinationWorkbench.tsx` |
| 专属模板规则与布局 | `src/templates/`、`src/domain/*Layout.ts` |
| 画布、文字和尺寸 | `src/CanvasStage.tsx`、`src/Canvas*Editor.tsx`、`src/domain/dimension*.ts` |
| 填写卡片、侧栏与样式 | `src/WorkbenchInputCards.tsx`、`src/WorkbenchChrome.tsx`、`src/ui-moonstone.css` |
| 源文件读写 | `src/project/projectFile.ts`、`useProjectFile.ts`、`fileAccess.ts` |
| 临时现场、最近文件与撤销 | `src/storage/`、`src/history/` |
| 图片导入与抠图 | `src/project/useImageImport.ts`、`photoshopCutout.ts`、`scripts/photoshop-cutout*` |
| 桌面登录、文件和窗口 | `src/desktop/`、`src-tauri/src/` |
| 成品导出 | `src/desktop/runtime.ts` 及公共编辑器的调用处 |

应用入口按顺序加载 `styles.css`、`ui-b.css`、`ui-moonstone.css`。家具图标通过 `src/ui/FurnitureIcon.tsx` 和 `src/ui/furniture-icons.svg` 管理，模板、分类与源文件图标分别使用对应映射。

### 整合原则

主图项目与 SKU 项目可以统一外层导航、入口和视觉样式。SKU 模板计算、画布内容、源文件格式及制作数据保持独立职责。

- 保留 49 个模板 ID 与编辑器类型，按模板注册表接入入口。
- 公共编辑器负责图片交互、文字、标注、撤销恢复和文件操作；专属模板负责自己的字体、布局、选项和校验。
- 制作要点用于界面说明，绘图与计算使用规则模块。
- 图片上传、尺寸标注、拖动缩放、文字编辑、撤销重做、草稿、源文件和导出纳入整合验收。
- 账号整合同时处理本机文件权限、草稿隔离和数据迁移。
- 网页部署方案需要明确本机 Photoshop 服务的连接方式。
- 依赖合并以两侧锁文件和实际调用为依据，先验证兼容性，再调整版本。

### 数值计算配置

制作规范第 2 页规定尺寸使用 cm、截断到一位小数。普通沙发单品 `sofa-single` 与沙发组合 `sofa-combination` 的现有精度配置为 `round`，沿用四舍五入显示；其余 47 个模板使用 `truncate`。整合时保留现有计算与源文件兼容，尺寸规则调整按专项制作需求处理。

### 模板开发入口

扩展模板时，在 `src/domain/templates.ts` 声明身份，在 `src/templates/registry.ts` 注册规则；专属布局放在 `src/domain/`，规则和选项放在 `src/templates/`。模板提供自己的 `productionNotes`、字体列表、名称策略、字段与校验。

专属状态使用模板自己的字段，保存时保留隐藏选项和素材。新增模板根据编辑器接口复用文件读写、撤销状态、图片导入及画布交互。

## 开发检查

在独立工作副本执行：

```powershell
npm test -- --dir src --maxWorkers 4
npx vitest run scripts/photoshop-cutout-server.test.ts
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./launch-sku-workbench.test.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./install-source-icon.test.ps1
npm run build
```

公共编辑器或模板规则改动覆盖全部模板测试，并使用真实素材检查相关分支。验收包括：

1. 模板入口、字段、素材槽及规则配置。
2. 上传、换图、拖动缩放、尺寸和文字编辑。
3. 撤销重做、同模板多现场、保存、重开、关闭与冲突处理。
4. 组合、双视图、多规格、多搭配、软硬度和隐藏内容恢复。
5. 规范字体、1440 × 1440 JPG、商品占比、标注避让及成品排版。
6. 桌面账号权限、独立窗口、安装与升级的数据保留。

绘图快照作为模板输出基准，视觉结果与规范原件逐项对照。验收结果对应实际代码版本、操作环境和样张。

交接目录的文件完整性通过 `06_索引与校验/校验交接文件.ps1` 检查。文件清单按相对路径记录大小和 SHA256。

## 模板目录

各模板条目包含制作要点、规范页码、字体及源码入口。精确坐标、容量和状态字段可沿规则文件进入对应布局模块。

### 沙发（6 个）

| 模板 | ID | 规范页 |
|---|---|---|
| [功能沙发多规格 SKU](#template-functional-sofa-combination) | `functional-sofa-combination` | 2–3、15、17–18 |
| [沙发单品 SKU](#template-sofa-single) | `sofa-single` | 2–3、15–16 |
| [沙发组合 SKU](#template-sofa-combination) | `sofa-combination` | 2–3、15、17 |
| [沙发床组合 SKU](#template-sofa-bed-combination) | `sofa-bed-combination` | 2–3、15–16、19 |
| [脚踏 SKU](#template-footstool-single) | `footstool-single` | 2–3、15–16、18 |
| [功能单人沙发 SKU](#template-functional-sofa-single) | `functional-sofa-single` | 2–3、15–16、18 |

<a id="template-functional-sofa-combination"></a>
#### 功能沙发多规格 SKU

模板 ID：`functional-sofa-combination`。规范页：2–3、15、17–18。[主参考页](../../02_规范资料/AI阅读版/按页文字/第18页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数。
- 一个颜色一张 SKU；蓝标只写型号，不写规格。
- 主推规格用侧面图保留投影；上传实际左单电动、右单电动或双电动状态，不镜像素材推断功能。
- 收起到展开的宽度、高度范围完整填写；高度范围分两行，数值截断1位小数。
- 型号标和底部备注位置固定；产品与标注不得进入规范红色禁区。
- “其他可选尺寸”标签可上下移动，文案不可修改。

字体：`Montserrat`、`方正兰亭中黑_GBK`、`FZLanTingHeiS-DB-GBK`、`FZLanTingHeiS-R-GBK`。

规则入口：[src/templates/functional-sofa-combination.tsx](../src/templates/functional-sofa-combination.tsx)。编辑器类型：`combination`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[functionalSofaCombinationLayout](../src/domain/functionalSofaCombinationLayout.ts)、[typography](../src/domain/typography.ts)、[workbenchValidation](../src/domain/workbenchValidation.ts)。

<a id="template-sofa-single"></a>
#### 沙发单品 SKU

模板 ID：`sofa-single`。规范页：2–3、15–16。[主参考页](../../02_规范资料/AI阅读版/按页文字/第16页.md)。

- 尺寸用 cm；规范要求截断到 1 位小数，当前沙发模板沿用四舍五入显示。
- 一个颜色一张 SKU；脚踏、贵妃位等特殊规格单独制作。
- 选主推规格侧面图，保留投影；蓝标只写型号，不写规格。
- 型号标位置、高度固定；产品与标注不得进入规范红色禁区。
- 卖点通常 3 个，特殊情况可 2 个；每条建议不超过 7 字，较长时缩短其余卖点。
- 卖点位置和框高固定；长文案可调框宽或字间距。
- 坐感标识可选开启；数值、说明和指示位置按实际资料填写，位置不按分数自动换算（另据BS672分层样例）。

字体：`Montserrat`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/sofa-single.ts](../src/templates/sofa-single.ts)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[sofaSingleLayout](../src/domain/sofaSingleLayout.ts)、[sellingPointCapacity](../src/domain/sellingPointCapacity.ts)、[typography](../src/domain/typography.ts)、[sofaFirmness](../src/domain/sofaFirmness.ts)。

<a id="template-sofa-combination"></a>
#### 沙发组合 SKU

模板 ID：`sofa-combination`。规范页：2–3、15、17。[主参考页](../../02_规范资料/AI阅读版/按页文字/第17页.md)。

- 尺寸用 cm；规范要求截断到 1 位小数，当前沙发模板沿用四舍五入显示。
- 一个颜色一张 SKU；蓝标只写型号，不写规格。
- 主推规格用侧面图并保留投影；次推规格用侧面图、不带投影，各规格高度一致。
- 型号标和底部备注位置固定；产品与标注不得进入规范红色禁区。
- “其他可选尺寸”标签可上下移动，文案不可修改。

字体：`Montserrat`、`方正兰亭中黑_GBK`、`FZLanTingHeiS-DB-GBK`、`FZLanTingHeiS-R-GBK`。

规则入口：[src/templates/sofa-combination.tsx](../src/templates/sofa-combination.tsx)。编辑器类型：`combination`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[sofaCombinationLayout](../src/domain/sofaCombinationLayout.ts)、[typography](../src/domain/typography.ts)、[workbenchValidation](../src/domain/workbenchValidation.ts)。

<a id="template-sofa-bed-combination"></a>
#### 沙发床组合 SKU

模板 ID：`sofa-bed-combination`。规范页：2–3、15–16、19。[主参考页](../../02_规范资料/AI阅读版/按页文字/第19页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数。
- 一个颜色一张 SKU；蓝标只写型号，不写规格。
- 主推规格用侧面图并保留投影；次推规格不带投影，各规格高度一致。
- 型号标和底部备注位置固定；产品与标注不得进入规范红色禁区。
- “其他可选尺寸”标签位置固定，文案不可修改。
- 单个 SKU 需加卖点，沿用沙发单品标准：每条建议不超过 7 字，位置和框高固定。

字体：`Montserrat`、`方正兰亭中黑_GBK`、`FZLanTingHeiS-DB-GBK`、`FZLanTingHeiS-R-GBK`。

规则入口：[src/templates/sofa-bed-combination.tsx](../src/templates/sofa-bed-combination.tsx)。编辑器类型：`combination`。

领域模块：[sofaBedCombinationLayout](../src/domain/sofaBedCombinationLayout.ts)、[typography](../src/domain/typography.ts)、[workbenchValidation](../src/domain/workbenchValidation.ts)。

<a id="template-footstool-single"></a>
#### 脚踏 SKU

模板 ID：`footstool-single`。规范页：2–3、15–16、18。[主参考页](../../02_规范资料/AI阅读版/按页文字/第18页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数，标清长、宽、高。
- 蓝标写完整型号＋规格，必须包含“脚踏”；标签可加宽，高度不变。
- 脚踏单独制作 SKU；使用侧面图，保留产品投影。
- 按脚踏案例不放卖点框，保留底部“*实际尺寸请以下单规格为准”。
- 型号标与备注位置固定；产品与标注不得进入规范红色禁区。

字体：`Montserrat`、`方正兰亭准黑_GBK`。

规则入口：[src/templates/footstool-single.ts](../src/templates/footstool-single.ts)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[footstoolSingleLayout](../src/domain/footstoolSingleLayout.ts)、[typography](../src/domain/typography.ts)。

<a id="template-functional-sofa-single"></a>
#### 功能单人沙发 SKU

模板 ID：`functional-sofa-single`。规范页：2–3、15–16、18。[主参考页](../../02_规范资料/AI阅读版/按页文字/第18页.md)。

- 尺寸用 cm，截断保留 1 位小数；收起与展开范围须按实际产品资料完整填写。
- 一个颜色一张 SKU，主推规格使用侧面图并保留投影；蓝标只写型号。
- 型号位置和高度固定，产品、尺寸及功能标注均不得进入禁区。
- 摇动使用上方曲线箭头，旋转使用底部弧形箭头；按实际功能开启并填写说明。
- 卖点通常 3 个，特殊情况可 2 个；建议每条不超过 7 字，位置与框高固定。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/functional-sofa-single.tsx](../src/templates/functional-sofa-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[functionalSofaSingleLayout](../src/domain/functionalSofaSingleLayout.ts)、[functionalSofaCurve](../src/domain/functionalSofaCurve.ts)。

### 睡眠（7 个）

| 模板 | ID | 规范页 |
|---|---|---|
| [软床单品 SKU](#template-soft-bed-single) | `soft-bed-single` | 2–3、5、9 |
| [软体床头柜单品 SKU](#template-bedside-cabinet-single) | `bedside-cabinet-single` | 2–4、9 |
| [床垫单品（单面睡）SKU](#template-mattress-single) | `mattress-single` | 2–3、10 |
| [床垫单品（双面睡）SKU](#template-mattress-double) | `mattress-double` | 2–3、10–11、13 |
| [枕头单品 SKU](#template-pillow-single) | `pillow-single` | 2–3、12–13 |
| [软床组合 SKU](#template-soft-bed-combination) | `soft-bed-combination` | 2–3、6、8、10–11 |
| [软床多组合 SKU](#template-soft-bed-multi-combination) | `soft-bed-multi-combination` | 2–3、7–8、10–11 |

<a id="template-soft-bed-single"></a>
#### 软床单品 SKU

模板 ID：`soft-bed-single`。规范页：2–3、5、9。[主参考页](../../02_规范资料/AI阅读版/按页文字/第05页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数。
- 蓝标写型号＋规格，规格简写为“床”；文案过长可由 45pt 调为 35pt。
- 床单品需分别标床头宽、床尾宽，并标清总长和总高。
- 卖点通常 3 个，特殊情况可 2 个；排骨架名称必须完整、准确。
- 卖点框高度不变，可调框宽或字间距；与产品间距建议 60px，最小 25px。
- 带灯光效果的床，素材需展示灯光效果。

字体：`Montserrat`、`方正兰亭中黑_GBK`、`方正兰亭准黑_GBK`。

规则入口：[src/templates/soft-bed-single.tsx](../src/templates/soft-bed-single.tsx)。编辑器类型：`single`。

领域模块：[softBedSingleLayout](../src/domain/softBedSingleLayout.ts)。

<a id="template-bedside-cabinet-single"></a>
#### 软体床头柜单品 SKU

模板 ID：`bedside-cabinet-single`。规范页：2–4、9。[主参考页](../../02_规范资料/AI阅读版/按页文字/第09页.md)。

- 单件床头柜与双件床头柜各输出一版；双件使用产品旁独立 x2 圆标，单件不显示。
- 型号与规格蓝标居中，字号 45pt；x2 字号 60pt、白字蓝底、圆角值 100。
- 尺寸用 cm，换算不四舍五入、保留 1 位小数，长宽高用 45pt 标清。
- 卖点通常 3 个，特殊情况可 2 个；中文中黑、50pt、蓝字蓝框。
- 带灯款必须使用已展示灯光效果的产品图；线和箭头统一 #545454。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/bedside-cabinet-single.tsx](../src/templates/bedside-cabinet-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[bedsideCabinetSingleLayout](../src/domain/bedsideCabinetSingleLayout.ts)、[typography](../src/domain/typography.ts)。

<a id="template-mattress-single"></a>
#### 床垫单品（单面睡）SKU

模板 ID：`mattress-single`。规范页：2–3、10。[主参考页](../../02_规范资料/AI阅读版/按页文字/第10页.md)。

- 本模板仅用于单面睡床垫；主图与三张材质卖点图分别上传，产品事实按真实资料填写。
- 顶部327px价格区留白；标题100pt中黑，英文/数字Semi Bold；说明33pt兰亭黑、灰色。
- 右上型号45pt白字蓝底，字距−25、圆角8；不缩小或省略完整型号。
- 只标床垫厚度，按信息表填写，52pt Semi Bold；cm单位截断保留1位小数。
- 单面睡仅显示一个硬度，按规范五档区间微调位置；圆内46pt、档名35pt，不根据素材推断数值。
- 底部固定三张材质卖点图，文字35pt单行、底部叠暗；深色图白字、浅色图黑字。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭黑_GBK`、`方正兰亭准黑_GBK`。

规则入口：[src/templates/mattress-single.tsx](../src/templates/mattress-single.tsx)。编辑器类型：`single`。

领域模块：[mattressSingleLayout](../src/domain/mattressSingleLayout.ts)。

<a id="template-mattress-double"></a>
#### 床垫单品（双面睡）SKU

模板 ID：`mattress-double`。规范页：2–3、10–11、13。[主参考页](../../02_规范资料/AI阅读版/按页文字/第11页.md)。

- 双面睡须分别确认正反面硬度；主图与三张材质卖点图独立上传，厚度以信息表为准。
- 顶部327px留白；标题100pt，说明33pt灰字，正面/反面说明前缀使用中粗黑。
- 右上型号45pt白字蓝底、字距−25、圆角8；厚度52pt Semi Bold，cm截断保留1位小数。
- 硬0–2（不含0）、偏硬大于2至4、适中大于4至6、偏软大于6至8、软大于8至10。
- 同区间用成对固定位置；不同区间分别微调且圆标不重叠；数值相同合并标为“正反面”。
- 材质文案35pt单行；底部叠暗，深色素材白字、浅色素材黑字。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭黑_GBK`、`方正兰亭中粗黑_GBK`、`方正兰亭准黑_GBK`。

规则入口：[src/templates/mattress-double.tsx](../src/templates/mattress-double.tsx)。编辑器类型：`single`。

领域模块：[mattressDoubleLayout](../src/domain/mattressDoubleLayout.ts)。

<a id="template-pillow-single"></a>
#### 枕头单品 SKU

模板 ID：`pillow-single`。规范页：2–3、12–13。[主参考页](../../02_规范资料/AI阅读版/按页文字/第12页.md)。

- 枕头和枕头x2各输出一版；主产品图保持单个枕头，双件增加60pt白字蓝底数量圆标。
- 顶部327px留白；标题100pt中黑，英文/数字Semi Bold；说明33pt兰亭黑、灰色。
- 右上型号45pt Montserrat白字蓝底，字距−25、圆角8，保留完整内容。
- 尺寸50pt黑字、线和箭头#545454，cm截断保留1位小数；局部尺寸按产品真实资料选填。
- 产品距说明至少40px、距底部卡片至少25px；三张材质图独立上传与取景。
- 材质卖点35pt单行，深色素材白字、浅色素材黑字，不将示例卖点作为默认事实。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭黑_GBK`、`方正兰亭准黑_GBK`。

规则入口：[src/templates/pillow-single.tsx](../src/templates/pillow-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[pillowSingleLayout](../src/domain/pillowSingleLayout.ts)。

<a id="template-soft-bed-combination"></a>
#### 软床组合 SKU

模板 ID：`soft-bed-combination`。规范页：2–3、6、8、10–11。[主参考页](../../02_规范资料/AI阅读版/按页文字/第06页.md)。

- 床＋床垫、床＋床头柜、三件搭配可切换；每件独立上传透明PNG，储物床展示打开效果。
- 顶部370px预留，型号33pt准黑/Montserrat白字蓝底、圆角8，按真实型号和规格填写。
- 只标床体长宽高；尺寸35pt、斜线25pt、黑字，cm截断保留1位小数，最多三种并列规格。
- 单床垫配说明卡：名称与厚度蓝标、型号28pt灰字、三个卖点30pt灰字。
- 床垫软硬度20pt，单/双面按真实资料填写；同档固定位置，同值合并，不同档分别微调。
- 普通床间距建议100/80px，储物床最小30/40px；底部固定一句42pt灰色搭配备注。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/soft-bed-combination.tsx](../src/templates/soft-bed-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[softBedCombinationLayout](../src/domain/softBedCombinationLayout.ts)。

<a id="template-soft-bed-multi-combination"></a>
#### 软床多组合 SKU

模板 ID：`soft-bed-multi-combination`。规范页：2–3、7–8、10–11。[主参考页](../../02_规范资料/AI阅读版/按页文字/第07页.md)。

- 两至三款床垫、零至两款床头柜独立搭配；款数表示搭配款式，发货数量按实际订单确定，储物床应展示打开效果。
- 顶部370px预留；所有蓝标33pt准黑/Montserrat白字、圆角8，床垫型号33pt黑字。
- 床体尺寸35pt、斜线25pt，cm截断保留1位小数，最多三种并列规格；只标床体长宽高。
- 每款床垫独立填写名称、厚度、型号和软硬度；20pt圆标保留面名与档名，不套用示例事实。
- 上下间距建议40px，最小30/15px；床垫左右间隔30px，多组合不附加单床垫卖点卡。
- 底部仅一句固定42pt灰色备注；售后风险放尺寸图或材料解析。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/soft-bed-multi-combination.tsx](../src/templates/soft-bed-multi-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[softBedMultiCombinationLayout](../src/domain/softBedMultiCombinationLayout.ts)。

### 办公（9 个）

| 模板 | ID | 规范页 |
|---|---|---|
| [无功能书椅 SKU](#template-office-chair-single) | `office-chair-single` | 2–3、46、48 |
| [电动升降桌单品 SKU](#template-standing-desk-single) | `standing-desk-single` | 2–3、43 |
| [电动升降桌组合 SKU](#template-standing-desk-combination) | `standing-desk-combination` | 2–3、44–45 |
| [儿童学习桌单品 SKU](#template-study-desk-single) | `study-desk-single` | 2–3、46–48 |
| [儿童学习桌组合 SKU](#template-study-desk-combination) | `study-desk-combination` | 2–3、44、46–48 |
| [升降边桌 SKU](#template-lifting-side-table-single) | `lifting-side-table-single` | 2–3、49 |
| [电脑椅 SKU](#template-computer-chair-single) | `computer-chair-single` | 2–3、49–50 |
| [工学椅 SKU](#template-ergonomic-chair-single) | `ergonomic-chair-single` | 2–3、49–50 |
| [儿童学习椅 SKU](#template-study-chair-single) | `study-chair-single` | 2–3、49–50 |

<a id="template-office-chair-single"></a>
#### 无功能书椅 SKU

模板 ID：`office-chair-single`。规范页：2–3、46、48。[主参考页](../../02_规范资料/AI阅读版/按页文字/第46页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数，标清总长、总宽、总高。
- 蓝标写完整型号＋规格；内容过长可由 45pt 调为 35pt。
- 卖点通常 3 个，特殊情况可 2 个；与产品最低点间距不得小于 60px，可适当加大。
- 注意有、无大标题时，主体与上方水印的留白不同。
- 尺寸线和箭头统一 #545454；卖点文字及边框用 #00586d。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/office-chair-single.tsx](../src/templates/office-chair-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[officeChairSingleLayout](../src/domain/officeChairSingleLayout.ts)。

<a id="template-standing-desk-single"></a>
#### 电动升降桌单品 SKU

模板 ID：`standing-desk-single`。规范页：2–3、43。[主参考页](../../02_规范资料/AI阅读版/按页文字/第43页.md)。

- 顶部保留270px价格公式区，标题与上下内容各留30px；不在本图填价格公式。
- 主标题80号黑字；完整型号与规格45号白字、蓝底圆角8。材质及功能按实际资料填写。
- 尺寸用cm，截断保留1位小数；并列规格用 /，升降范围用 ~，不得省略上下限。
- 尺寸45号中黑，行距40；尺寸线与箭头统一为 #545454。
- 卖点50号中黑、蓝框圆角8；框高固定，可调整框宽，底部保留130px。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭粗黑_GBK`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/standing-desk-single.tsx](../src/templates/standing-desk-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[standingDeskSingleLayout](../src/domain/standingDeskSingleLayout.ts)。

<a id="template-standing-desk-combination"></a>
#### 电动升降桌组合 SKU

模板 ID：`standing-desk-combination`。规范页：2–3、44–45。[主参考页](../../02_规范资料/AI阅读版/按页文字/第44页.md)。

- 两件套为升降桌＋增高架，三件套另配电脑椅；每件单独上传透明PNG、填写完整型号，不依据图片推测参数。
- 顶部270px预留价格区域；标题80pt粗黑，型号35pt准黑白字蓝底、圆角8。
- 仅标升降桌长、宽和升降高度，35pt中黑、行距40；单位cm，支持 / 并列及 ~ 范围，截断保留1位小数。
- 底部三个卖点为50pt中黑蓝字蓝框，框高98px、横向间隔30px；图文间隔两件套100px、三件套60px。
- 底部40pt准黑搭配说明随套装切换；三件套可为增高架补充20pt说明，无资料时留空。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`、`方正兰亭粗黑_GBK`。

规则入口：[src/templates/standing-desk-combination.tsx](../src/templates/standing-desk-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[standingDeskCombinationLayout](../src/domain/standingDeskCombinationLayout.ts)。

<a id="template-study-desk-single"></a>
#### 儿童学习桌单品 SKU

模板 ID：`study-desk-single`。规范页：2–3、46–48。[主参考页](../../02_规范资料/AI阅读版/按页文字/第47页.md)。

- 顶部保留270px价格公式区；本版无大标题，型号与价格区间距80px。
- 蓝标填写完整型号及规格，45号白字；内容过长可调为35号，不省略规格。
- 长、宽、高用cm，截断保留1位小数；并列用 /，升降范围用 ~，高度范围分两行显示。
- 尺寸45号中黑、行距40；尺寸线与箭头为 #545454。
- 卖点通常3个，特殊情况可2个；50号中黑蓝框、圆角8、框高98，底部留130px。
- 卖点距产品最低点不小于60px，可按实际产品适当增加。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/study-desk-single.tsx](../src/templates/study-desk-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[studyDeskSingleLayout](../src/domain/studyDeskSingleLayout.ts)。

<a id="template-study-desk-combination"></a>
#### 儿童学习桌组合 SKU

模板 ID：`study-desk-combination`。规范页：2–3、44、46–48。[主参考页](../../02_规范资料/AI阅读版/按页文字/第47页.md)。

- 学习桌与学习椅分别上传透明PNG；两件都填写完整型号和规格，不依据图片推测参数。
- 无大标题；顶部270px预留价格区域，后留80px。组合型号35pt准黑白字蓝底，圆角8。
- 仅标学习桌长、宽和升降高度，35pt中黑、行距40；高度在~后折行，单位cm，截断保留1位小数。
- 通常三个卖点，特殊情况可两个；50pt中黑蓝字蓝框，框高98px、横向间隔30px。
- 产品最低点距卖点至少60px，可适当增加；底部保留40pt准黑学习椅搭配说明。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/study-desk-combination.tsx](../src/templates/study-desk-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[studyDeskCombinationLayout](../src/domain/studyDeskCombinationLayout.ts)。

<a id="template-lifting-side-table-single"></a>
#### 升降边桌 SKU

模板 ID：`lifting-side-table-single`。规范页：2–3、49。[主参考页](../../02_规范资料/AI阅读版/按页文字/第49页.md)。

- 主图与五张细节图分别上传；标题、规格、承重和功能均依据实际资料填写，不沿用规范示例数值。
- 顶部270px价格区保持空白，下面留30px；主型号45pt中黑白字、蓝底圆角8。
- 右侧三张大卡、两张小卡；卡片间隔10px，文字距离边缘40px，底部留100px。
- 前三卡标题45pt粗黑、行距50；后两卡标题35pt粗黑、行距50；说明26pt中黑、行距35。
- 仅标主图长、宽和高；45pt中黑、行距40，线和箭头#545454；单位cm，截断保留1位小数。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭粗黑_GBK`。

规则入口：[src/templates/lifting-side-table-single.tsx](../src/templates/lifting-side-table-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[liftingSideTableSingleLayout](../src/domain/liftingSideTableSingleLayout.ts)。

<a id="template-computer-chair-single"></a>
#### 电脑椅 SKU

模板 ID：`computer-chair-single`。规范页：2–3、49–50。[主参考页](../../02_规范资料/AI阅读版/按页文字/第50页.md)。

- 按第50页电脑椅图制作：左侧主图，右侧三张大卡、两张小卡，主图和五张细节图分别上传。
- 顶部270px价格区空白，其后留30px；型号45pt中黑白字、蓝底圆角8，填写完整型号及规格。
- 总长、总宽、总高45pt中黑，行距40；总高名称与数值分行。单位cm，截断保留1位小数。
- 前三卡标题45pt粗黑，后两卡35pt粗黑、行距50；说明26pt中黑、行距35，文字距卡边40px。
- 卡片间距10px，底部留100px；第二卡示例白字，其余黑字，可按素材背景选择黑字或白字。
- 材质、功能、角度及尺寸须依据实际资料填写，不预填规范样例卖点或示意箭头。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭粗黑_GBK`。

规则入口：[src/templates/computer-chair-single.tsx](../src/templates/computer-chair-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[computerChairSingleLayout](../src/domain/computerChairSingleLayout.ts)。

<a id="template-ergonomic-chair-single"></a>
#### 工学椅 SKU

模板 ID：`ergonomic-chair-single`。规范页：2–3、49–50。[主参考页](../../02_规范资料/AI阅读版/按页文字/第50页.md)。

- 主图与五张细节图分别上传；功能、调节方式、材质及角度均按实际资料填写，不沿用规范样例。
- 顶部270px价格区保持空白，下面留30px；主型号45pt中黑白字，蓝底圆角8。
- 右侧三张大卡、两张小卡，间隔10px；文字距边缘40px，底部留100px。
- 前三卡标题45pt粗黑、后两卡35pt粗黑，行距50；说明26pt中黑、行距35，可按实际内容分行。
- 主图标总长、总宽和总高；总高范围按三行显示，45pt中黑、行距40，单位cm，截断保留1位小数。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭粗黑_GBK`。

规则入口：[src/templates/ergonomic-chair-single.tsx](../src/templates/ergonomic-chair-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[ergonomicChairSingleLayout](../src/domain/ergonomicChairSingleLayout.ts)。

<a id="template-study-chair-single"></a>
#### 儿童学习椅 SKU

模板 ID：`study-chair-single`。规范页：2–3、49–50。[主参考页](../../02_规范资料/AI阅读版/按页文字/第50页.md)。

- 主图与五张细节图分别上传；功能、调节方式、材质及角度均按实际资料填写，不沿用规范样例。
- 顶部270px价格区保持空白，下面留30px；主型号45pt中黑白字，蓝底圆角8。
- 右侧三张大卡、两张小卡，间隔10px；文字距边缘40px，底部留100px。
- 前三卡标题45pt粗黑、后两卡35pt粗黑，行距50；说明26pt中黑、行距35，可按实际内容分行。
- 主图标总长、总宽和总高；总高范围按三行显示，45pt中黑、行距40，单位cm，截断保留1位小数。

字体：`Montserrat`、`Montserrat Semi Bold`、`方正兰亭中黑_GBK`、`方正兰亭粗黑_GBK`。

规则入口：[src/templates/study-chair-single.tsx](../src/templates/study-chair-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[studyChairSingleLayout](../src/domain/studyChairSingleLayout.ts)。

### 餐桌（5 个）

| 模板 | ID | 规范页 |
|---|---|---|
| [长餐桌单品 SKU](#template-long-dining-table-single) | `long-dining-table-single` | 2–3、35 |
| [圆伸缩餐桌单品 SKU](#template-round-extendable-table-single) | `round-extendable-table-single` | 2–3、38 |
| [长餐桌组合 SKU](#template-long-dining-table-combination) | `long-dining-table-combination` | 2–3、36–37 |
| [圆伸缩餐桌组合 SKU](#template-round-extendable-table-combination) | `round-extendable-table-combination` | 2–3、38–39 |
| [餐椅双视图 SKU](#template-dining-chair-single) | `dining-chair-single` | 2–3、40–41 |

<a id="template-long-dining-table-single"></a>
#### 长餐桌单品 SKU

模板 ID：`long-dining-table-single`。规范页：2–3、35。[主参考页](../../02_规范资料/AI阅读版/按页文字/第35页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数，标清长、宽、高。
- 蓝标写完整型号＋规格，能写全尺寸规格时尽量写全。
- 多尺寸产品省略规格中的尺寸时，下方需备注“图示效果以 xxx 为例”。
- 卖点通常 3 个，特殊情况可 2 个；框高不变，长文案可调框宽或字间距。
- 卖点与产品间距建议 60px，可按实际视觉效果微调。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/long-dining-table-single.tsx](../src/templates/long-dining-table-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[longDiningTableSingleLayout](../src/domain/longDiningTableSingleLayout.ts)。

<a id="template-round-extendable-table-single"></a>
#### 圆伸缩餐桌单品 SKU

模板 ID：`round-extendable-table-single`。规范页：2–3、38。[主参考页](../../02_规范资料/AI阅读版/按页文字/第38页.md)。

- 尺寸用 cm；换算不四舍五入，保留 1 位小数。
- 蓝标写完整型号＋规格；多尺寸产品省略规格中的尺寸时，备注“图示效果以 xxx 为例”。
- 直径标注线必须沿双侧可伸缩方向，另标产品高度。
- 直径数据过长或被桌面软装干扰时，可按规范图示改为桌面外侧标注。
- 卖点通常 3 个，特殊情况可 2 个；框高不变，可调框宽或字间距。
- 卖点与产品间距建议 60px，可按实际视觉效果微调。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/round-extendable-table-single.tsx](../src/templates/round-extendable-table-single.tsx)。编辑器类型：`single`。

领域模块：[roundExtendableTableSingleLayout](../src/domain/roundExtendableTableSingleLayout.ts)。

<a id="template-long-dining-table-combination"></a>
#### 长餐桌组合 SKU

模板 ID：`long-dining-table-combination`。规范页：2–3、36–37。[主参考页](../../02_规范资料/AI阅读版/按页文字/第36页.md)。

- 上传完整餐桌与餐椅/长凳组合图；长、宽、高只标餐桌，尺寸用 cm，换算不四舍五入、保留 1 位小数。
- 一款搭配在右下写型号，不加编号；两款搭配使用圆形 1 / 2 对应各自型号，编号用于型号对应，两行间距 15px。
- 餐桌及搭配型号用 35pt 白字蓝底，尺寸为 35pt 黑字；完整规格过长时折行，不能省略数据。
- 可按真实情况添加高度说明及 38pt 图示备注；没有资料时留空，不套用示例尺寸。
- 卖点通常 3 个，特殊情况可 2 个；50pt 中黑、蓝字蓝框，框高与横向 30px 间距保持不变。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/long-dining-table-combination.tsx](../src/templates/long-dining-table-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[longDiningTableCombinationLayout](../src/domain/longDiningTableCombinationLayout.ts)、[longDiningTableCombinationLayout](../src/domain/longDiningTableCombinationLayout.ts)。

<a id="template-round-extendable-table-combination"></a>
#### 圆伸缩餐桌组合 SKU

模板 ID：`round-extendable-table-combination`。规范页：2–3、38–39。[主参考页](../../02_规范资料/AI阅读版/按页文字/第39页.md)。

- 上传含餐桌及餐椅的完整组合素材；餐桌完整型号置左上，餐椅完整型号另置右下，均为35pt蓝底白字。
- 尺寸用 cm，换算截断1位小数；直径线沿双侧伸缩方向，另标餐桌高度，不根据图片推测参数。
- P39示图使用桌面白字白线，文字统则为黑字、#545454线；提供桌面/外置两种样式，端点位置须人工对照产品调整。
- 多规格型号省略尺寸时，备注图示所用规格；高度说明如“含脚垫”仅在产品资料确认后填写。
- 卖点通常3个，特殊情况可2个；50pt蓝字蓝框、固定30px框间距。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/round-extendable-table-combination.tsx](../src/templates/round-extendable-table-combination.tsx)。编辑器类型：`single`。

领域模块：[roundExtendableTableCombinationLayout](../src/domain/roundExtendableTableCombinationLayout.ts)、[roundExtendableTableCombinationLayout](../src/domain/roundExtendableTableCombinationLayout.ts)。

<a id="template-dining-chair-single"></a>
#### 餐椅双视图 SKU

模板 ID：`dining-chair-single`。规范页：2–3、40–41。[主参考页](../../02_规范资料/AI阅读版/按页文字/第40页.md)。

- 同款餐椅展示两个视图；型号x1、x2各输出一版，数量切换不改变原型号。
- 型号45号白字准黑、蓝底圆角8；总长、总宽、总高45号黑字准黑，线与箭头为 #545454。
- 常规总宽标在主视图两腿之间；特殊情况主图标腿间宽，第二视图另标真实总宽，不混用两个数值。
- 尺寸用cm，换算截断保留1位小数；高度补充说明按实际测量范围填写，不默认包含脚垫。
- 卖点通常三个、特殊情况两个；50号中黑，蓝字蓝框、圆角8、固定框高98px和横向30px间距。
- 按P41新版双视图安排留白，不增加主标题；第二视图须完整展示椅子的最宽部位。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/dining-chair-single.tsx](../src/templates/dining-chair-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[diningChairSingleLayout](../src/domain/diningChairSingleLayout.ts)。

### 板木（22 个）

| 模板 | ID | 规范页 |
|---|---|---|
| [板木餐椅双视图 SKU](#template-wood-dining-chair-single) | `wood-dining-chair-single` | 2–3、21、33 |
| [板木床单品 SKU](#template-wood-bed-single) | `wood-bed-single` | 2–3、21、23 |
| [板木床多组合 SKU](#template-wood-bed-multi-combination) | `wood-bed-multi-combination` | 2–3、6–8、21、23 |
| [板木床组合 SKU](#template-wood-bed-combination) | `wood-bed-combination` | 2–3、6–8、21、23 |
| [板木书桌多组合 SKU](#template-wood-desk-multi-combination) | `wood-desk-multi-combination` | 2–3、21、30 |
| [板木书桌组合 SKU](#template-wood-desk-combination) | `wood-desk-combination` | 2–3、21、30 |
| [板木斗柜组合 SKU](#template-drawer-chest-combination) | `drawer-chest-combination` | 2–3、21、29 |
| [异形妆台组合 SKU](#template-shaped-vanity-combination) | `shaped-vanity-combination` | 2–3、21、28 |
| [斗柜妆台组合 SKU](#template-vanity-dresser-combination) | `vanity-dresser-combination` | 2–3、21、27 |
| [斗柜妆台单品 SKU](#template-vanity-dresser-single) | `vanity-dresser-single` | 2–3、21、27 |
| [板木鞋柜组合 SKU](#template-shoe-cabinet-combination) | `shoe-cabinet-combination` | 2–3、21、26 |
| [板木衣柜组合 SKU](#template-wardrobe-combination) | `wardrobe-combination` | 2–3、21、25 |
| [板木床头柜单品 SKU](#template-wood-bedside-single) | `wood-bedside-single` | 2–3、21、24 |
| [板木斗柜单品 SKU](#template-drawer-chest-single) | `drawer-chest-single` | 2–3、21、29 |
| [板木衣柜单品 SKU](#template-wardrobe-single) | `wardrobe-single` | 2–3、21、25 |
| [板木鞋柜单品 SKU](#template-shoe-cabinet-single) | `shoe-cabinet-single` | 2–3、21、26 |
| [异形妆台单品 SKU](#template-shaped-vanity-single) | `shaped-vanity-single` | 2–3、21、28 |
| [板木书桌单品 SKU](#template-wood-desk-single) | `wood-desk-single` | 2–3、21、30 |
| [板木长餐桌单品 SKU](#template-wood-long-table-single) | `wood-long-table-single` | 2–3、21、31 |
| [板木圆餐桌单品 SKU](#template-wood-round-table-single) | `wood-round-table-single` | 2–3、21、32 |
| [板木长餐桌组合 SKU](#template-wood-long-table-combination) | `wood-long-table-combination` | 2–3、21、31 |
| [板木圆餐桌组合 SKU](#template-wood-round-table-combination) | `wood-round-table-combination` | 2–3、21、32 |

<a id="template-wood-dining-chair-single"></a>
#### 板木餐椅双视图 SKU

模板 ID：`wood-dining-chair-single`。规范页：2–3、21、33。[主参考页](../../02_规范资料/AI阅读版/按页文字/第33页.md)。

- 同款餐椅分别上传侧面45°与背面45°透明PNG；数量×1、×2各输出一版。标总长、总宽、总高，宽度取产品最宽处，不能一律按两腿间距。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-dining-chair-single.tsx](../src/templates/wood-dining-chair-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodDiningChairLayout](../src/domain/woodDiningChairLayout.ts)。

<a id="template-wood-bed-single"></a>
#### 板木床单品 SKU

模板 ID：`wood-bed-single`。规范页：2–3、21、23。[主参考页](../../02_规范资料/AI阅读版/按页文字/第23页.md)。

- 床体型号按新品表保留完整规格，带灯素材展示灯光。正常床头最宽时标总长、总宽、总高；特殊床尾最宽时分别标床头宽、床尾宽。快速尺寸填三项或四项切换。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-bed-single.tsx](../src/templates/wood-bed-single.tsx)。编辑器类型：`single`。

领域模块：[woodBedLayout](../src/domain/woodBedLayout.ts)。

<a id="template-wood-bed-multi-combination"></a>
#### 板木床多组合 SKU

模板 ID：`wood-bed-multi-combination`。规范页：2–3、6–8、21、23。[主参考页](../../02_规范资料/AI阅读版/按页文字/第23页.md)。

- 两至三款床垫、零至两款床头柜独立搭配；款数表示搭配款式，发货数量按实际订单确定，储物床应展示打开效果。
- 顶部370px预留；所有蓝标33pt准黑/Montserrat白字、圆角8，床垫型号33pt黑字。
- 床体尺寸35pt、斜线25pt，cm截断保留1位小数，最多三种并列规格；床体标总长、总宽、总高；搭配床头柜另标长和高。
- 每款床垫独立填写名称、厚度、型号和软硬度；20pt圆标保留面名与档名，不套用示例事实。
- 上下间距建议40px，最小30/15px；床垫左右间隔30px，多组合不附加单床垫卖点卡。
- 底部仅一句固定42pt灰色备注；售后风险放尺寸图或材料解析。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-bed-multi-combination.tsx](../src/templates/wood-bed-multi-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodBedMultiCombinationLayout](../src/domain/woodBedMultiCombinationLayout.ts)。

<a id="template-wood-bed-combination"></a>
#### 板木床组合 SKU

模板 ID：`wood-bed-combination`。规范页：2–3、6–8、21、23。[主参考页](../../02_规范资料/AI阅读版/按页文字/第23页.md)。

- 床＋床垫、床＋床头柜、三件搭配可切换；每件独立上传透明PNG，储物床展示打开效果。
- 沿用P23指定的软床组合标准：型号33pt，长型号可分为两行、底框100px，准黑/Montserrat白字蓝底、圆角8，按真实型号和规格填写。
- 床体标总长、总宽、总高；搭配床头柜另标长和高；尺寸35pt、斜线25pt、黑字，cm截断保留1位小数，最多三种并列规格。
- 单床垫配说明卡：名称与厚度蓝标、型号28pt灰字、三个卖点30pt灰字。
- 床垫软硬度20pt，单/双面按真实资料填写；同档固定位置，同值合并，不同档分别微调。
- 普通床间距建议100/80px，储物床最小30/40px；底部固定一句42pt灰色搭配备注。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-bed-combination.tsx](../src/templates/wood-bed-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodBedCombinationLayout](../src/domain/woodBedCombinationLayout.ts)。

<a id="template-wood-desk-multi-combination"></a>
#### 板木书桌多组合 SKU

模板 ID：`wood-desk-multi-combination`。规范页：2–3、21、30。[主参考页](../../02_规范资料/AI阅读版/按页文字/第30页.md)。

- 上传书桌、副柜、椅子及独立边柜/书柜整组PNG；主长宽高标书桌，副柜长宽高标独立边柜。按P30优先保证产品展示，不绘制卖点框。
- 型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。
- 长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。
- 组合件数较多，不绘制底部卖点框，保留产品及全部尺寸空间。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品及尺寸避让底部备注。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-desk-multi-combination.tsx](../src/templates/wood-desk-multi-combination.tsx)。编辑器类型：`single`。

领域模块：[woodDeskMultiLayout](../src/domain/woodDeskMultiLayout.ts)。

<a id="template-wood-desk-combination"></a>
#### 板木书桌组合 SKU

模板 ID：`wood-desk-combination`。规范页：2–3、21、30。[主参考页](../../02_规范资料/AI阅读版/按页文字/第30页.md)。

- 上传书桌、书桌副柜与电脑椅的整组PNG。完整型号包含实际搭配；标桌体长宽高，产品图饱满时保留两至三个卖点。
- 型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。
- 长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-desk-combination.tsx](../src/templates/wood-desk-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodDeskSetLayout](../src/domain/woodDeskSetLayout.ts)。

<a id="template-drawer-chest-combination"></a>
#### 板木斗柜组合 SKU

模板 ID：`drawer-chest-combination`。规范页：2–3、21、29。[主参考页](../../02_规范资料/AI阅读版/按页文字/第29页.md)。

- 上传高低斗柜整组PNG；完整型号写明组合。标总长、深度、主柜高及副柜高；宽度是否含拉手须按实际产品填写说明。
- 型号35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8，不能省略规格。
- 只标总长、总宽、总高，35pt黑字，线和箭头#545454；cm截断保留1位小数。
- 宽度按实际情况注明是否含拉手，说明与数值同一行，不能套用案例数值。
- 卖点通常三个、特殊情况两个；50pt中黑，框高98px、间隔30px，产品与卖点建议60px。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；型号与卖点位置固定。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/drawer-chest-combination.tsx](../src/templates/drawer-chest-combination.tsx)。编辑器类型：`single`。

领域模块：[drawerChestSetLayout](../src/domain/drawerChestSetLayout.ts)。

<a id="template-shaped-vanity-combination"></a>
#### 异形妆台组合 SKU

模板 ID：`shaped-vanity-combination`。规范页：2–3、21、28。[主参考页](../../02_规范资料/AI阅读版/按页文字/第28页.md)。

- 上传异形妆台（含本款副柜）与妆镜、妆凳或两者的整组PNG。型号写明实际搭配，只标台体实际长、宽、高，不把镜子计入台高。
- 型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。
- 长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/shaped-vanity-combination.tsx](../src/templates/shaped-vanity-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[shapedVanitySetLayout](../src/domain/shapedVanitySetLayout.ts)。

<a id="template-vanity-dresser-combination"></a>
#### 斗柜妆台组合 SKU

模板 ID：`vanity-dresser-combination`。规范页：2–3、21、27。[主参考页](../../02_规范资料/AI阅读版/按页文字/第27页.md)。

- 上传7字板＋斗柜妆台与妆镜、妆凳或两者的整组PNG；完整型号写明实际搭配。分别标台面高、副柜高，长度支持收拢～展开范围。
- 型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。
- 长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/vanity-dresser-combination.tsx](../src/templates/vanity-dresser-combination.tsx)。编辑器类型：`single`。

领域模块：[vanityDresserSetLayout](../src/domain/vanityDresserSetLayout.ts)。

<a id="template-vanity-dresser-single"></a>
#### 斗柜妆台单品 SKU

模板 ID：`vanity-dresser-single`。规范页：2–3、21、27。[主参考页](../../02_规范资料/AI阅读版/按页文字/第27页.md)。

- 上传7字板＋斗柜妆台单品完整PNG，标总长、深度、台面高、副柜高。长度支持收拢～展开范围。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/vanity-dresser-single.tsx](../src/templates/vanity-dresser-single.tsx)。编辑器类型：`single`。

领域模块：[vanityDresserLayout](../src/domain/vanityDresserLayout.ts)。

<a id="template-shoe-cabinet-combination"></a>
#### 板木鞋柜组合 SKU

模板 ID：`shoe-cabinet-combination`。规范页：2–3、21、26。[主参考页](../../02_规范资料/AI阅读版/按页文字/第26页.md)。

- 上传鞋柜整组侧面关门PNG，另传同组正面储物打开PNG。两张图均必需；按P26组合示例标总长、总高，不从图片猜测深度。
- 型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。
- 主图按P26组合示例标长和高，不额外推测深度；35pt黑字，cm截断一位小数，线和箭头#545454。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 两张图展示同一套组合的开关门状态；型号下方预留100px，产品与卖点建议60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/shoe-cabinet-combination.tsx](../src/templates/shoe-cabinet-combination.tsx)。编辑器类型：`single`。

领域模块：[shoeCabinetSetLayout](../src/domain/shoeCabinetSetLayout.ts)。

<a id="template-wardrobe-combination"></a>
#### 板木衣柜组合 SKU

模板 ID：`wardrobe-combination`。规范页：2–3、21、25。[主参考页](../../02_规范资料/AI阅读版/按页文字/第25页.md)。

- 衣柜＋衣柜用正面关门图；衣柜＋边柜用侧面关门图。另传同一组合的正面储物打开图，只标组合长、高。型号完整写出各组成，35pt、底框100px。
- 型号＋完整规格35pt准黑/Montserrat白字蓝底，组合型号框高100px，长型号可分两行、圆角8；不能省略规格。
- 主图按P25正面示例标长和高，不额外推测深度；35pt黑字，cm截断一位小数，线和箭头#545454。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 两张图展示同一套组合的开关门状态；型号下方预留100px，产品与卖点建议60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wardrobe-combination.tsx](../src/templates/wardrobe-combination.tsx)。编辑器类型：`single`。

领域模块：[wardrobeSetLayout](../src/domain/wardrobeSetLayout.ts)。

<a id="template-wood-bedside-single"></a>
#### 板木床头柜单品 SKU

模板 ID：`wood-bedside-single`。规范页：2–3、21、24。[主参考页](../../02_规范资料/AI阅读版/按页文字/第24页.md)。

- 单件床头柜使用完整透明PNG；带灯款须在素材中展示实际灯光效果。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-bedside-single.tsx](../src/templates/wood-bedside-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodBedsideSingleLayout](../src/domain/woodBedsideSingleLayout.ts)。

<a id="template-drawer-chest-single"></a>
#### 板木斗柜单品 SKU

模板 ID：`drawer-chest-single`。规范页：2–3、21、29。[主参考页](../../02_规范资料/AI阅读版/按页文字/第29页.md)。

- 本模板用于单件斗柜，填写完整型号和规格；组合使用另一套版式。
- 型号45pt准黑/Montserrat白字蓝底，框高70px、圆角8，不能省略规格。
- 只标总长、总宽、总高，45pt黑字，线和箭头#545454；cm截断保留1位小数。
- 宽度按实际情况注明是否含拉手，说明与数值同一行，不能套用案例数值。
- 卖点通常三个、特殊情况两个；50pt中黑，框高98px、间隔30px，产品与卖点建议60px。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；型号与卖点位置固定。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/drawer-chest-single.tsx](../src/templates/drawer-chest-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[drawerChestSingleLayout](../src/domain/drawerChestSingleLayout.ts)。

<a id="template-wardrobe-single"></a>
#### 板木衣柜单品 SKU

模板 ID：`wardrobe-single`。规范页：2–3、21、25。[主参考页](../../02_规范资料/AI阅读版/按页文字/第25页.md)。

- 同款衣柜必须展示正面关门＋正面储物打开；两张完整透明PNG各自上传，组合另用版式。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 主图按P25正面示例标长和高，不额外推测深度；45pt黑字，cm截断一位小数，线和箭头#545454。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 两张图展示同一件商品的开关门状态，不表示数量两件；型号下方预留100px，产品与卖点建议60px。
- 高度文字沿尺寸线旋转，尺寸端点和辅助线可独立编辑。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wardrobe-single.tsx](../src/templates/wardrobe-single.tsx)。编辑器类型：`single`。

领域模块：[wardrobeSingleLayout](../src/domain/wardrobeSingleLayout.ts)。

<a id="template-shoe-cabinet-single"></a>
#### 板木鞋柜单品 SKU

模板 ID：`shoe-cabinet-single`。规范页：2–3、21、26。[主参考页](../../02_规范资料/AI阅读版/按页文字/第26页.md)。

- 同款鞋柜必须展示侧面关门＋正面储物打开；适用于高柜、矮柜，组合另用版式。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 主图标长宽高，第二视图不重复标注；45pt黑字，cm截断一位小数，线和箭头#545454。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 两张图展示同一件商品的开关门状态，不表示数量两件；型号下方预留100px，产品与卖点建议60px。
- 高度文字沿尺寸线旋转。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/shoe-cabinet-single.tsx](../src/templates/shoe-cabinet-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[shoeCabinetSingleLayout](../src/domain/shoeCabinetSingleLayout.ts)。

<a id="template-shaped-vanity-single"></a>
#### 异形妆台单品 SKU

模板 ID：`shaped-vanity-single`。规范页：2–3、21、28。[主参考页](../../02_规范资料/AI阅读版/按页文字/第28页.md)。

- 使用妆台本体完整透明PNG，保留本款自带副柜；长宽高按实际结构标注，高度含台体挡板。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/shaped-vanity-single.tsx](../src/templates/shaped-vanity-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[shapedVanitySingleLayout](../src/domain/shapedVanitySingleLayout.ts)。

<a id="template-wood-desk-single"></a>
#### 板木书桌单品 SKU

模板 ID：`wood-desk-single`。规范页：2–3、21、30。[主参考页](../../02_规范资料/AI阅读版/按页文字/第30页.md)。

- 上传书桌单品完整透明PNG；独立副柜与椅子属于组合，不加入单品图。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。
- 高度文字沿尺寸线旋转。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-desk-single.tsx](../src/templates/wood-desk-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodDeskSingleLayout](../src/domain/woodDeskSingleLayout.ts)。

<a id="template-wood-long-table-single"></a>
#### 板木长餐桌单品 SKU

模板 ID：`wood-long-table-single`。规范页：2–3、21、31。[主参考页](../../02_规范资料/AI阅读版/按页文字/第31页.md)。

- 上传长餐桌单品完整透明PNG；多种长度使用 / 并列，长度标注显示“尺寸可选”。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。
- 长度文字沿尺寸线倾斜，高度文字使用模板规定方向。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-long-table-single.tsx](../src/templates/wood-long-table-single.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodLongTableSingleLayout](../src/domain/woodLongTableSingleLayout.ts)。

<a id="template-wood-round-table-single"></a>
#### 板木圆餐桌单品 SKU

模板 ID：`wood-round-table-single`。规范页：2–3、21、32。[主参考页](../../02_规范资料/AI阅读版/按页文字/第32页.md)。

- 上传普通圆餐桌单品完整透明PNG；桌面外侧标直径，另标桌体高度，不标长宽。
- 型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。
- 直径和高度用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-round-table-single.tsx](../src/templates/wood-round-table-single.tsx)。编辑器类型：`single`。

领域模块：[woodRoundTableSingleLayout](../src/domain/woodRoundTableSingleLayout.ts)。

<a id="template-wood-long-table-combination"></a>
#### 板木长餐桌组合 SKU

模板 ID：`wood-long-table-combination`。规范页：2–3、21、31。[主参考页](../../02_规范资料/AI阅读版/按页文字/第31页.md)。

- 上传桌椅/长凳完整组合PNG，长宽高只标桌体；多种长度显示“尺寸可选”，两款搭配加对应编号。
- 餐桌主型号35pt准黑/Montserrat白字蓝底，单行框高50px，长型号自动分为两行、框高100px，圆角8；搭配标签使用35pt单行蓝标并保留完整规格。
- 长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 餐桌蓝标位置固定，搭配标签按素材调整；组合标注可超绿框但不超过蓝框。
- 长度文字沿尺寸线倾斜；搭配型号支持画布点击编辑，产品对应编号可拖动和键盘微调。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-long-table-combination.tsx](../src/templates/wood-long-table-combination.tsx)。编辑器类型：`single`。

领域模块：[dimensions](../src/domain/dimensions.ts)、[woodLongTableSetLayout](../src/domain/woodLongTableSetLayout.ts)、[woodLongTableSetLayout](../src/domain/woodLongTableSetLayout.ts)。

<a id="template-wood-round-table-combination"></a>
#### 板木圆餐桌组合 SKU

模板 ID：`wood-round-table-combination`。规范页：2–3、21、32。[主参考页](../../02_规范资料/AI阅读版/按页文字/第32页.md)。

- 上传桌椅完整组合PNG；默认桌面内白字白线标直径，高度用黑字灰线，不标长宽。
- 餐桌主型号35pt准黑/Montserrat白字蓝底，单行框高50px，长型号自动分为两行、框高100px，圆角8；搭配标签使用35pt单行蓝标并保留完整规格。
- 尺寸用cm、35pt，截断保留1位小数；白色直径标在桌面内，外置时可切黑字灰线并调整端点。
- 通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。
- 多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。
- 餐桌蓝标位置固定，搭配标签按素材调整；组合标注可超绿框但不超过蓝框。
- 可见餐椅型号标签支持画布点击编辑，各款标签独立定位。

字体：`Montserrat`、`方正兰亭准黑_GBK`、`方正兰亭中黑_GBK`。

规则入口：[src/templates/wood-round-table-combination.tsx](../src/templates/wood-round-table-combination.tsx)。编辑器类型：`single`。

领域模块：[woodRoundTableSetLayout](../src/domain/woodRoundTableSetLayout.ts)、[woodRoundTableSetLayout](../src/domain/woodRoundTableSetLayout.ts)。

