import { drawWardrobeNote, formatWardrobeFields, wardrobeAccessories, getWardrobeLayout, normalizeWardrobe, parseWardrobeDimensions, wardrobeDimensionLabel, wardrobeIssues, wardrobeModel, WARDROBE_FONT, WARDROBE_SELLING_FONT, type WardrobeDraft, type WardrobeOptions } from '../domain/wardrobeSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WardrobeEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWardrobe(value.wardrobe);
  const update = (change: Partial<WardrobeOptions>) => onChange((current) => ({ ...current, wardrobe: { ...normalizeWardrobe(current.wardrobe), ...change } }));
  return <section className="quick-section"><h3>板木衣柜单品设置</h3>
    <p className="hint">主产品上传正面关门PNG，另传同款正面储物打开PNG。两张图均必需，分别调整位置和比例；只标主图长和高。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const wardrobeSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、25', points: [
    '同款衣柜必须展示正面关门＋正面储物打开；两张完整透明PNG各自上传，组合另用版式。',
    '型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。',
    '主图按P25正面示例标长和高，不额外推测深度；45pt黑字，cm截断一位小数，线和箭头#545454。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '两张图展示同一件商品的开关门状态，不表示数量两件；型号下方预留100px，产品与卖点建议60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'height'], dimensionPrompt: '板木衣柜单品长或高', sizePlaceholder: '长×高（/ 并列规格）', inspectorTitle: '板木衣柜单品',
  model: { fontSize: 45, fontFamily: WARDROBE_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: WARDROBE_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, wardrobe: normalizeWardrobe(undefined) }),
  restoreOptions: (draft) => ({ ...wardrobeSingleRules.createOptions(), wardrobe: normalizeWardrobe((draft as WardrobeDraft).wardrobe) }),
  saveOptions: (options) => ({ wardrobe: normalizeWardrobe(options.wardrobe) } as Partial<WardrobeDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWardrobe(options.wardrobe)) !== JSON.stringify(normalizeWardrobe(undefined)), OptionsEditor: WardrobeEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWardrobe(options.wardrobe).sellingPointCount), layout: getWardrobeLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  accessories: wardrobeAccessories, modelBadge: wardrobeModel, dimensionLabel: wardrobeDimensionLabel, extraIssues: wardrobeIssues, drawExtras: drawWardrobeNote,
  parseQuickDimensions: parseWardrobeDimensions, formatFields: formatWardrobeFields, exportFileName: (model) => `${model}-板木衣柜单品-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWardrobeDimensions(formatWardrobeFields(fields)) ? '请填写板木衣柜单品有效长×高' : null, input.trim() && !parseWardrobeDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
