import { formatVanityDresserFields, drawVanityDresserNote, getVanityDresserLayout, normalizeVanityDresser, parseVanityDresserDimensions, vanityDresserDimensionLabel, vanityDresserIssues, vanityDresserModel, VANITY_DRESSER_FONT, VANITY_DRESSER_SELLING_FONT, type VanityDresserDraft, type VanityDresserOptions } from '../domain/vanityDresserLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function VanityDresserEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeVanityDresser(value.vanityDresser);
  const update = (change: Partial<VanityDresserOptions>) => onChange((current) => ({ ...current, vanityDresser: { ...normalizeVanityDresser(current.vanityDresser), ...change } }));
  return <section className="quick-section"><h3>斗柜妆台单品设置</h3>
    <p className="hint">上传7字板＋斗柜妆台单品完整PNG，标总长、深度、台面高、副柜高。长度支持收拢～展开范围；这不是独立妆镜或妆凳组合。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const vanityDresserRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、27', points: [
    '上传7字板＋斗柜妆台单品完整PNG，标总长、深度、台面高、副柜高。长度支持收拢～展开范围；这不是独立妆镜或妆凳组合。',
    '型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。',
    '长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height', 'secondaryHeight'], dimensionPrompt: '主图和副柜尺寸', sizePlaceholder: '长×宽×台高×副柜高（长度可用 ~ 范围）', inspectorTitle: '斗柜妆台单品',
  model: { fontSize: 45, fontFamily: VANITY_DRESSER_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: VANITY_DRESSER_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, vanityDresser: normalizeVanityDresser(undefined) }),
  restoreOptions: (draft) => ({ ...vanityDresserRules.createOptions(), vanityDresser: normalizeVanityDresser((draft as VanityDresserDraft).vanityDresser) }),
  saveOptions: (options) => ({ vanityDresser: normalizeVanityDresser(options.vanityDresser) } as Partial<VanityDresserDraft>),
  hasOptions: (options) => JSON.stringify(normalizeVanityDresser(options.vanityDresser)) !== JSON.stringify(normalizeVanityDresser(undefined)), OptionsEditor: VanityDresserEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeVanityDresser(options.vanityDresser).sellingPointCount), layout: getVanityDresserLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: vanityDresserModel, dimensionLabel: vanityDresserDimensionLabel, extraIssues: vanityDresserIssues, drawExtras: drawVanityDresserNote,
  parseQuickDimensions: parseVanityDresserDimensions, formatFields: formatVanityDresserFields, exportFileName: (model) => `${model}-斗柜妆台单品-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseVanityDresserDimensions(formatVanityDresserFields(fields)) ? '请填写妆台有效长×宽×台高×副柜高' : null, input.trim() && !parseVanityDresserDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，仅长度可用由小到大的 ~ 范围' : null].filter((value): value is string => Boolean(value)),
};
