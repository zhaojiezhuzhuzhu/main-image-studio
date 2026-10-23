import { formatDimensionFields } from '../domain/dimensions';
import { drawShapedVanityNote, getShapedVanityLayout, normalizeShapedVanity, parseShapedVanityDimensions, shapedVanityDimensionLabel, shapedVanityIssues, shapedVanityModel, SHAPED_VANITY_FONT, SHAPED_VANITY_SELLING_FONT, type ShapedVanityDraft, type ShapedVanityOptions } from '../domain/shapedVanitySingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function ShapedVanityEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeShapedVanity(value.shapedVanity);
  const update = (change: Partial<ShapedVanityOptions>) => onChange((current) => ({ ...current, shapedVanity: { ...normalizeShapedVanity(current.shapedVanity), ...change } }));
  return <section className="quick-section"><h3>异形妆台设置</h3>
    <p className="hint">上传妆台本体的完整透明PNG，含本款自带副柜；独立妆镜、妆凳搭配属于组合。高度标至台体最高处，按真实结构确定端点。多尺寸省略型号中的尺寸时须填写图示备注。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const shapedVanitySingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、28', points: [
    '使用妆台本体完整透明PNG，保留本款自带副柜；长宽高按实际结构标注，高度含台体挡板。',
    '型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。',
    '长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '妆台长、宽或高', sizePlaceholder: '长×宽×高（/ 并列规格）', inspectorTitle: '异形妆台',
  model: { fontSize: 45, fontFamily: SHAPED_VANITY_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: SHAPED_VANITY_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, shapedVanity: normalizeShapedVanity(undefined) }),
  restoreOptions: (draft) => ({ ...shapedVanitySingleRules.createOptions(), shapedVanity: normalizeShapedVanity((draft as ShapedVanityDraft).shapedVanity) }),
  saveOptions: (options) => ({ shapedVanity: normalizeShapedVanity(options.shapedVanity) } as Partial<ShapedVanityDraft>),
  hasOptions: (options) => JSON.stringify(normalizeShapedVanity(options.shapedVanity)) !== JSON.stringify(normalizeShapedVanity(undefined)), OptionsEditor: ShapedVanityEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeShapedVanity(options.shapedVanity).sellingPointCount), layout: getShapedVanityLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: shapedVanityModel, dimensionLabel: shapedVanityDimensionLabel, extraIssues: shapedVanityIssues, drawExtras: drawShapedVanityNote,
  parseQuickDimensions: parseShapedVanityDimensions, formatFields: formatDimensionFields, exportFileName: (model) => `${model}-异形妆台单品-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseShapedVanityDimensions(formatDimensionFields(fields)) ? '请填写妆台有效长×宽×高' : null, input.trim() && !parseShapedVanityDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
