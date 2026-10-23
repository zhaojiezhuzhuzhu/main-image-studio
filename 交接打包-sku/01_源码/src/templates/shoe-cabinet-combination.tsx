import { drawShoeCabinetSetNote, formatShoeCabinetSetFields, shoeCabinetSetAccessories, getShoeCabinetSetLayout, normalizeShoeCabinetSet, parseShoeCabinetSetDimensions, shoeCabinetSetDimensionLabel, shoeCabinetSetIssues, shoeCabinetSetModel, SHOE_CABINET_SET_FONT, SHOE_CABINET_SET_SELLING_FONT, type ShoeCabinetSetDraft, type ShoeCabinetSetOptions } from '../domain/shoeCabinetSetLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function ShoeCabinetSetEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeShoeCabinetSet(value.shoeCabinetSet);
  const update = (change: Partial<ShoeCabinetSetOptions>) => onChange((current) => ({ ...current, shoeCabinetSet: { ...normalizeShoeCabinetSet(current.shoeCabinetSet), ...change } }));
  return <section className="quick-section"><h3>板木鞋柜组合设置</h3>
    <p className="hint">上传鞋柜整组侧面关门PNG，另传同组正面储物打开PNG。两张图均必需；按P26组合示例标总长、总高，不从图片猜测深度。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const shoeCabinetSetRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、26', points: [
    '上传鞋柜整组侧面关门PNG，另传同组正面储物打开PNG。两张图均必需；按P26组合示例标总长、总高，不从图片猜测深度。',
    '型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。',
    '主图按P26组合示例标长和高，不额外推测深度；35pt黑字，cm截断一位小数，线和箭头#545454。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '两张图展示同一套组合的开关门状态，不代表两套商品；型号下方预留100px，产品与卖点建议60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'height'], dimensionPrompt: '板木鞋柜组合长或高', sizePlaceholder: '长×高（/ 并列规格）', inspectorTitle: '板木鞋柜组合',
  model: { fontSize: 35, fontFamily: SHOE_CABINET_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: SHOE_CABINET_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, shoeCabinetSet: normalizeShoeCabinetSet(undefined) }),
  restoreOptions: (draft) => ({ ...shoeCabinetSetRules.createOptions(), shoeCabinetSet: normalizeShoeCabinetSet((draft as ShoeCabinetSetDraft).shoeCabinetSet) }),
  saveOptions: (options) => ({ shoeCabinetSet: normalizeShoeCabinetSet(options.shoeCabinetSet) } as Partial<ShoeCabinetSetDraft>),
  hasOptions: (options) => JSON.stringify(normalizeShoeCabinetSet(options.shoeCabinetSet)) !== JSON.stringify(normalizeShoeCabinetSet(undefined)), OptionsEditor: ShoeCabinetSetEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeShoeCabinetSet(options.shoeCabinetSet).sellingPointCount), layout: getShoeCabinetSetLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  accessories: shoeCabinetSetAccessories, modelBadge: shoeCabinetSetModel, dimensionLabel: shoeCabinetSetDimensionLabel, extraIssues: shoeCabinetSetIssues, drawExtras: drawShoeCabinetSetNote,
  parseQuickDimensions: parseShoeCabinetSetDimensions, formatFields: formatShoeCabinetSetFields, exportFileName: (model) => `${model}-板木鞋柜组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseShoeCabinetSetDimensions(formatShoeCabinetSetFields(fields)) ? '请填写板木鞋柜组合有效长×高' : null, input.trim() && !parseShoeCabinetSetDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
