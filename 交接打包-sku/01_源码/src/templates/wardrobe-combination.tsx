import { drawWardrobeSetNote, formatWardrobeSetFields, wardrobeSetAccessories, getWardrobeSetLayout, normalizeWardrobeSet, parseWardrobeSetDimensions, wardrobeSetDimensionLabel, wardrobeSetIssues, wardrobeSetModel, WARDROBE_SET_FONT, WARDROBE_SET_SELLING_FONT, type WardrobeSetDraft, type WardrobeSetOptions } from '../domain/wardrobeSetLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WardrobeSetEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWardrobeSet(value.wardrobeSet);
  const update = (change: Partial<WardrobeSetOptions>) => onChange((current) => ({ ...current, wardrobeSet: { ...normalizeWardrobeSet(current.wardrobeSet), ...change } }));
  return <section className="quick-section"><h3>板木衣柜组合设置</h3>
    <p className="hint">衣柜＋衣柜用正面关门图；衣柜＋边柜用侧面关门图。另传同一组合的正面储物打开图，只标组合长、高。型号完整写出各组成，35pt、底框100px。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const wardrobeSetRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、25', points: [
    '衣柜＋衣柜用正面关门图；衣柜＋边柜用侧面关门图。另传同一组合的正面储物打开图，只标组合长、高。型号完整写出各组成，35pt、底框100px。',
    '型号＋完整规格35pt准黑/Montserrat白字蓝底，组合型号框高100px，长型号可分两行、圆角8；不能省略规格。',
    '主图按P25正面示例标长和高，不额外推测深度；35pt黑字，cm截断一位小数，线和箭头#545454。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '两张图展示同一套组合的开关门状态，不代表两套商品；型号下方预留100px，产品与卖点建议60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'height'], dimensionPrompt: '板木衣柜组合长或高', sizePlaceholder: '长×高（/ 并列规格）', inspectorTitle: '板木衣柜组合',
  model: { fontSize: 35, fontFamily: WARDROBE_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 50, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: WARDROBE_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, wardrobeSet: normalizeWardrobeSet(undefined) }),
  restoreOptions: (draft) => ({ ...wardrobeSetRules.createOptions(), wardrobeSet: normalizeWardrobeSet((draft as WardrobeSetDraft).wardrobeSet) }),
  saveOptions: (options) => ({ wardrobeSet: normalizeWardrobeSet(options.wardrobeSet) } as Partial<WardrobeSetDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWardrobeSet(options.wardrobeSet)) !== JSON.stringify(normalizeWardrobeSet(undefined)), OptionsEditor: WardrobeSetEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWardrobeSet(options.wardrobeSet).sellingPointCount), layout: getWardrobeSetLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  accessories: wardrobeSetAccessories, modelBadge: wardrobeSetModel, dimensionLabel: wardrobeSetDimensionLabel, extraIssues: wardrobeSetIssues, drawExtras: drawWardrobeSetNote,
  parseQuickDimensions: parseWardrobeSetDimensions, formatFields: formatWardrobeSetFields, exportFileName: (model) => `${model}-板木衣柜组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWardrobeSetDimensions(formatWardrobeSetFields(fields)) ? '请填写板木衣柜组合有效长×高' : null, input.trim() && !parseWardrobeSetDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
