import { formatDimensionFields } from '../domain/dimensions';
import { drawWoodLongTableNote, getWoodLongTableLayout, normalizeWoodLongTable, parseWoodLongTableDimensions, woodLongTableDimensionLabel, woodLongTableIssues, woodLongTableModel, WOOD_LONG_TABLE_FONT, WOOD_LONG_TABLE_SELLING_FONT, type WoodLongTableDraft, type WoodLongTableOptions } from '../domain/woodLongTableSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WoodLongTableEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodLongTable(value.woodLongTable);
  const update = (change: Partial<WoodLongTableOptions>) => onChange((current) => ({ ...current, woodLongTable: { ...normalizeWoodLongTable(current.woodLongTable), ...change } }));
  return <section className="quick-section"><h3>板木长餐桌设置</h3>
    <p className="hint">上传长餐桌单品的完整透明PNG。多种长度用 / 分隔，长度标注自动显示“尺寸可选”；多规格省略型号中的尺寸时填写图示备注。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const woodLongTableSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、31', points: [
    '上传长餐桌单品完整透明PNG；多种长度使用 / 并列，长度标注显示“尺寸可选”。',
    '型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。',
    '长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '长餐桌长、宽或高', sizePlaceholder: '长×宽×高（/ 并列规格）', inspectorTitle: '板木长餐桌',
  model: { fontSize: 45, fontFamily: WOOD_LONG_TABLE_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_LONG_TABLE_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodLongTable: normalizeWoodLongTable(undefined) }),
  restoreOptions: (draft) => ({ ...woodLongTableSingleRules.createOptions(), woodLongTable: normalizeWoodLongTable((draft as WoodLongTableDraft).woodLongTable) }),
  saveOptions: (options) => ({ woodLongTable: normalizeWoodLongTable(options.woodLongTable) } as Partial<WoodLongTableDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodLongTable(options.woodLongTable)) !== JSON.stringify(normalizeWoodLongTable(undefined)), OptionsEditor: WoodLongTableEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWoodLongTable(options.woodLongTable).sellingPointCount), layout: getWoodLongTableLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: woodLongTableModel, dimensionLabel: woodLongTableDimensionLabel, extraIssues: woodLongTableIssues, drawExtras: drawWoodLongTableNote,
  parseQuickDimensions: parseWoodLongTableDimensions, formatFields: formatDimensionFields, exportFileName: (model) => `${model}-板木长餐桌单品-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodLongTableDimensions(formatDimensionFields(fields)) ? '请填写长餐桌有效长×宽×高' : null, input.trim() && !parseWoodLongTableDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
