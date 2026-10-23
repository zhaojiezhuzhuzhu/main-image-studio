export type TemplateId = 'functional-sofa-combination' | 'wood-dining-chair-single' | 'wood-bed-single' | 'wood-bed-multi-combination' | 'wood-bed-combination' | 'wood-desk-multi-combination' | 'wood-desk-combination' | 'drawer-chest-combination' | 'shaped-vanity-combination' | 'vanity-dresser-combination' | 'vanity-dresser-single' | 'shoe-cabinet-combination' | 'wardrobe-combination' | 'sofa-single' | 'sofa-combination' | 'sofa-bed-combination' | 'soft-bed-single' | 'footstool-single' | 'office-chair-single' | 'long-dining-table-single' | 'round-extendable-table-single' | 'functional-sofa-single' | 'bedside-cabinet-single' | 'long-dining-table-combination' | 'round-extendable-table-combination' | 'standing-desk-single' | 'standing-desk-combination' | 'study-desk-single' | 'study-desk-combination' | 'dining-chair-single' | 'lifting-side-table-single' | 'computer-chair-single' | 'ergonomic-chair-single' | 'study-chair-single' | 'mattress-single' | 'mattress-double' | 'pillow-single' | 'soft-bed-combination' | 'soft-bed-multi-combination' | 'wood-bedside-single' | 'drawer-chest-single' | 'wardrobe-single' | 'shoe-cabinet-single' | 'shaped-vanity-single' | 'wood-desk-single' | 'wood-long-table-single' | 'wood-round-table-single' | 'wood-long-table-combination' | 'wood-round-table-combination';
export type TemplateProjectKind = 'single' | 'combination';

export const TEMPLATES = {
  'functional-sofa-combination': { title: '功能沙发多规格 SKU', category: '沙发', kind: 'combination', description: '左/右单电动与双电动 · 收起展开范围 · 多规格对照', page: 18, available: true },
  'wood-dining-chair-single': { title: '板木餐椅双视图 SKU', category: '板木', kind: 'single', description: '侧面45°与背面45° · 真实总宽 · 单把与两把', page: 33, available: true },
  'wood-bed-single': { title: '板木床单品 SKU', category: '板木', kind: 'single', description: '完整床规格 · 常规三尺寸或床头床尾四尺寸', page: 23, available: true },
  'wood-bed-multi-combination': { title: '板木床多组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '床体完整规格 · 床头柜长高 · 独立床垫与软硬度', page: 23, available: true },
  'wood-bed-combination': { title: '板木床组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '床体完整规格 · 床头柜长高 · 独立床垫与软硬度', page: 23, available: true },
  'wood-desk-multi-combination': { title: '板木书桌多组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '上传书桌、副柜、椅子及独立边柜/书柜整组PNG；主长宽高标书桌，副柜长宽高标独立边柜', page: 30, available: true },
  'wood-desk-combination': { title: '板木书桌组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '上传书桌、书桌副柜与电脑椅的整组PNG', page: 30, available: true },
  'drawer-chest-combination': { title: '板木斗柜组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '上传高低斗柜整组PNG；完整型号写明组合', page: 29, available: true },
  'shaped-vanity-combination': { title: '异形妆台组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '上传异形妆台（含本款副柜）与妆镜、妆凳或两者的整组PNG', page: 28, available: true },
  'vanity-dresser-combination': { title: '斗柜妆台组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '上传7字板＋斗柜妆台与妆镜、妆凳或两者的整组PNG；完整型号写明实际搭配', page: 27, available: true },
  'vanity-dresser-single': { title: '斗柜妆台单品 SKU', category: '板木', kind: 'single', description: '上传7字板＋斗柜妆台单品完整PNG，标总长、深度、台面高、副柜高', page: 27, available: true },
  'shoe-cabinet-combination': { title: '板木鞋柜组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '上传鞋柜整组侧面关门PNG，另传同组正面储物打开PNG', page: 26, available: true },
  'wardrobe-combination': { title: '板木衣柜组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '衣柜＋衣柜用正面关门图；衣柜＋边柜用侧面关门图', page: 25, available: true },
  'sofa-single': { title: '沙发单品 SKU', category: '沙发', kind: 'single', description: '主产品 · 长宽高 · 三卖点 · 可选坐感软硬度', page: 16, available: true },
  'sofa-combination': { title: '沙发组合 SKU', category: '沙发', kind: 'combination', description: '主产品 · 最多四规格 · 规格标注 · 备注', page: 17, available: true },
  'sofa-bed-combination': { title: '沙发床组合 SKU', category: '沙发', kind: 'combination', description: '主产品 · 右侧可选规格 · 单款卖点', page: 19, available: true },
  'soft-bed-single': { title: '软床单品 SKU', category: '睡眠', kind: 'single', description: '床体 · 床头床尾尺寸 · 双规格 · 两至三卖点', page: 5, available: true },
  'footstool-single': { title: '脚踏 SKU', category: '沙发', kind: 'single', description: '完整型号规格 · 长宽高 · 固定备注', page: 18, available: true },
  'office-chair-single': { title: '无功能书椅 SKU', category: '办公', kind: 'single', description: '完整型号规格 · 总长总宽总高 · 两至三卖点', page: 46, available: true },
  'long-dining-table-single': { title: '长餐桌单品 SKU', category: '餐桌', kind: 'single', description: '长宽高 · 多规格 · 高度说明与备注 · 两至三卖点', page: 35, available: true },
  'round-extendable-table-single': { title: '圆伸缩餐桌单品 SKU', category: '餐桌', kind: 'single', description: '直径与高 · 伸缩范围 · 多规格 · 两至三卖点', page: 38, available: true },
  'functional-sofa-single': { title: '功能单人沙发 SKU', category: '沙发', kind: 'single', description: '范围尺寸 · 摇动与旋转标注 · 两至三卖点', page: 18, available: true },
  'bedside-cabinet-single': { title: '软体床头柜单品 SKU', category: '睡眠', kind: 'single', description: '长宽高 · 单件与双件 · 数量标识 · 三卖点', page: 9, available: true },
  'long-dining-table-combination': { title: '长餐桌组合 SKU', category: '餐桌', kind: 'single', displayKind: '组合', description: '桌椅整组图 · 一至两款椅凳 · 对应编号 · 两至三卖点', page: 36, available: true },
  'round-extendable-table-combination': { title: '圆伸缩餐桌组合 SKU', category: '餐桌', kind: 'single', displayKind: '组合', description: '桌椅整组图 · 直径与高度 · 餐椅型号 · 两至三卖点', page: 39, available: true },
  'standing-desk-single': { title: '电动升降桌单品 SKU', category: '办公', kind: 'single', description: '大标题 · 升降高度范围 · 三卖点', page: 43, available: true },
  'standing-desk-combination': { title: '电动升降桌组合 SKU', category: '办公', kind: 'single', displayKind: '组合', description: '两件套与三件套 · 独立搭配素材 · 升降范围', page: 44, available: true },
  'study-desk-single': { title: '儿童学习桌单品 SKU', category: '办公', kind: 'single', description: '完整型号 · 升降尺寸 · 两至三卖点', page: 47, available: true },
  'study-desk-combination': { title: '儿童学习桌组合 SKU', category: '办公', kind: 'single', displayKind: '组合', description: '学习桌与学习椅 · 独立素材 · 升降尺寸', page: 47, available: true },
  'dining-chair-single': { title: '餐椅双视图 SKU', category: '餐桌', kind: 'single', description: '正侧双视图 · 单件与双件 · 两种总宽标法', page: 40, available: true },
  'lifting-side-table-single': { title: '升降边桌 SKU', category: '办公', kind: 'single', description: '升降尺寸 · 五张细节卡片 · 独立取景与文案', page: 49, available: true },
  'computer-chair-single': { title: '电脑椅 SKU', category: '办公', kind: 'single', description: '主图尺寸 · 五张细节卡片 · 独立取景与文案', page: 50, available: true },
  'ergonomic-chair-single': { title: '工学椅 SKU', category: '办公', kind: 'single', description: '升降尺寸 · 五张细节卡片 · 独立取景与文案', page: 50, available: true },
  'study-chair-single': { title: '儿童学习椅 SKU', category: '办公', kind: 'single', description: '升降尺寸 · 五张细节卡片 · 独立取景与文案', page: 50, available: true },
  'mattress-single': { title: '床垫单品（单面睡）SKU', category: '睡眠', kind: 'single', description: '床垫厚度 · 五档软硬度 · 三张材质卖点图', page: 10, available: true },
  'mattress-double': { title: '床垫单品（双面睡）SKU', category: '睡眠', kind: 'single', description: '正反面硬度 · 同档与不同档 · 三张材质图', page: 11, available: true },
  'pillow-single': { title: '枕头单品 SKU', category: '睡眠', kind: 'single', description: '单件与双件 · 长宽高与局部说明 · 三张材质图', page: 12, available: true },
  'soft-bed-combination': { title: '软床组合 SKU', category: '睡眠', kind: 'single', displayKind: '组合', description: '床与搭配品 · 床垫卖点卡 · 小尺寸软硬度', page: 6, available: true },
  'soft-bed-multi-combination': { title: '软床多组合 SKU', category: '睡眠', kind: 'single', displayKind: '组合', description: '两至三款床垫 · 可选床头柜 · 独立素材与硬度', page: 7, available: true },
  'wood-bedside-single': { title: '板木床头柜单品 SKU', category: '板木', kind: 'single', description: '完整型号规格 · 长宽高 · 两至三卖点 · 图示备注', page: 24, available: true },
  'drawer-chest-single': { title: '板木斗柜单品 SKU', category: '板木', kind: 'single', description: '完整型号规格 · 宽度说明 · 两至三卖点 · 图示备注', page: 29, available: true },
  'wardrobe-single': { title: '板木衣柜单品 SKU', category: '板木', kind: 'single', description: '正面关门与开门双视图 · 长高 · 两至三卖点', page: 25, available: true },
  'shoe-cabinet-single': { title: '板木鞋柜单品 SKU', category: '板木', kind: 'single', description: '侧面关门与正面开门 · 长宽高 · 两至三卖点', page: 26, available: true },
  'shaped-vanity-single': { title: '异形妆台单品 SKU', category: '板木', kind: 'single', description: '台体与自带副柜 · 长宽高 · 两至三卖点 · 图示备注', page: 28, available: true },
  'wood-desk-single': { title: '板木书桌单品 SKU', category: '板木', kind: 'single', description: '完整型号规格 · 桌体长宽高 · 两至三卖点 · 图示备注', page: 30, available: true },
  'wood-long-table-single': { title: '板木长餐桌单品 SKU', category: '板木', kind: 'single', description: '长宽高 · 可选长度规格 · 两至三卖点 · 图示备注', page: 31, available: true },
  'wood-round-table-single': { title: '板木圆餐桌单品 SKU', category: '板木', kind: 'single', description: '外置直径与高度 · 两至三卖点 · 图示备注', page: 32, available: true },
  'wood-long-table-combination': { title: '板木长餐桌组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '桌椅整组图 · 一至两款椅凳 · 对应编号 · 可调型号标签', page: 31, available: true },
  'wood-round-table-combination': { title: '板木圆餐桌组合 SKU', category: '板木', kind: 'single', displayKind: '组合', description: '桌椅整组图 · 最多四款餐椅 · 独立型号标签 · 桌面直径', page: 32, available: true },
} as const;

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export function templateKindLabel(templateId: TemplateId): string {
  const template = TEMPLATES[templateId];
  return 'displayKind' in template ? template.displayKind : template.kind === 'single' ? '单品' : '组合';
}

export function resolveTemplateId(kind: TemplateProjectKind, value?: unknown): TemplateId {
  if (value === undefined) return kind === 'single' ? 'sofa-single' : 'sofa-combination';
  if (typeof value !== 'string' || !Object.prototype.hasOwnProperty.call(TEMPLATES, value)) {
    throw new Error('无法识别项目模板，请使用支持该模板的工作台打开');
  }
  const templateId = value as TemplateId;
  if (TEMPLATES[templateId].kind !== kind) throw new Error('项目模板与内容类型不匹配');
  return templateId;
}

export function templateDraftSlot(templateId: TemplateId): string {
  if (templateId === 'sofa-single') return 'single';
  if (templateId === 'sofa-combination') return 'combination';
  return `template:${templateId}`;
}
