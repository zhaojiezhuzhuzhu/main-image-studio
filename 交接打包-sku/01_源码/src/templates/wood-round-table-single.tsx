import { formatWoodRoundTableFields, drawWoodRoundTableNote, getWoodRoundTableLayout, normalizeWoodRoundTable, parseWoodRoundTableDimensions, woodRoundTableDimensionLabel, woodRoundTableIssues, woodRoundTableModel, WOOD_ROUND_TABLE_FONT, WOOD_ROUND_TABLE_SELLING_FONT, type WoodRoundTableDraft, type WoodRoundTableOptions } from '../domain/woodRoundTableSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WoodRoundTableEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodRoundTable(value.woodRoundTable);
  const update = (change: Partial<WoodRoundTableOptions>) => onChange((current) => ({ ...current, woodRoundTable: { ...normalizeWoodRoundTable(current.woodRoundTable), ...change } }));
  return <section className="quick-section"><h3>板木圆餐桌设置</h3>
    <p className="hint">上传普通圆餐桌单品的完整透明PNG。按直径×高填写，直径线放在桌面外侧；并列规格用 /，不填写伸缩范围。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const woodRoundTableSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、32', points: [
    '上传普通圆餐桌单品完整透明PNG；桌面外侧标直径，另标桌体高度，不标长宽。',
    '型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。',
    '直径和高度用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['diameter', 'height'], dimensionPrompt: '圆餐桌直径或高', sizePlaceholder: '直径×高（/ 并列规格）', inspectorTitle: '板木圆餐桌',
  model: { fontSize: 45, fontFamily: WOOD_ROUND_TABLE_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_ROUND_TABLE_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodRoundTable: normalizeWoodRoundTable(undefined) }),
  restoreOptions: (draft) => ({ ...woodRoundTableSingleRules.createOptions(), woodRoundTable: normalizeWoodRoundTable((draft as WoodRoundTableDraft).woodRoundTable) }),
  saveOptions: (options) => ({ woodRoundTable: normalizeWoodRoundTable(options.woodRoundTable) } as Partial<WoodRoundTableDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodRoundTable(options.woodRoundTable)) !== JSON.stringify(normalizeWoodRoundTable(undefined)), OptionsEditor: WoodRoundTableEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWoodRoundTable(options.woodRoundTable).sellingPointCount), layout: getWoodRoundTableLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: woodRoundTableModel, dimensionLabel: woodRoundTableDimensionLabel, extraIssues: woodRoundTableIssues, drawExtras: drawWoodRoundTableNote,
  parseQuickDimensions: parseWoodRoundTableDimensions, formatFields: formatWoodRoundTableFields, exportFileName: (model) => `${model}-板木圆餐桌单品-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodRoundTableDimensions(formatWoodRoundTableFields(fields)) ? '请填写有效直径×高；多规格高度须共用一个值或与直径逐项对应' : null, input.trim() && !parseWoodRoundTableDimensions(input) ? '快速尺寸无效，按直径×高填写；最多三种并列规格，高度须逐项对应或共用，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
