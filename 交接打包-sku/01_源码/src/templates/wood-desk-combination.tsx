import { formatDimensionFields } from '../domain/dimensions';
import { drawWoodDeskSetNote, getWoodDeskSetLayout, normalizeWoodDeskSet, parseWoodDeskSetDimensions, woodDeskSetDimensionLabel, woodDeskSetIssues, woodDeskSetModel, WOOD_DESK_SET_FONT, WOOD_DESK_SET_SELLING_FONT, type WoodDeskSetDraft, type WoodDeskSetOptions } from '../domain/woodDeskSetLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WoodDeskSetEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodDeskSet(value.woodDeskSet);
  const update = (change: Partial<WoodDeskSetOptions>) => onChange((current) => ({ ...current, woodDeskSet: { ...normalizeWoodDeskSet(current.woodDeskSet), ...change } }));
  return <section className="quick-section"><h3>板木书桌组合设置</h3>
    <p className="hint">上传书桌、书桌副柜与电脑椅的整组PNG。完整型号包含实际搭配；标桌体长宽高，产品图饱满时保留两至三个卖点。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const woodDeskSetRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、30', points: [
    '上传书桌、书桌副柜与电脑椅的整组PNG。完整型号包含实际搭配；标桌体长宽高，产品图饱满时保留两至三个卖点。',
    '型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。',
    '长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '书桌长、宽或高', sizePlaceholder: '长×宽×高（/ 并列规格）', inspectorTitle: '板木书桌组合',
  model: { fontSize: 35, fontFamily: WOOD_DESK_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_DESK_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodDeskSet: normalizeWoodDeskSet(undefined) }),
  restoreOptions: (draft) => ({ ...woodDeskSetRules.createOptions(), woodDeskSet: normalizeWoodDeskSet((draft as WoodDeskSetDraft).woodDeskSet) }),
  saveOptions: (options) => ({ woodDeskSet: normalizeWoodDeskSet(options.woodDeskSet) } as Partial<WoodDeskSetDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodDeskSet(options.woodDeskSet)) !== JSON.stringify(normalizeWoodDeskSet(undefined)), OptionsEditor: WoodDeskSetEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWoodDeskSet(options.woodDeskSet).sellingPointCount), layout: getWoodDeskSetLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: woodDeskSetModel, dimensionLabel: woodDeskSetDimensionLabel, extraIssues: woodDeskSetIssues, drawExtras: drawWoodDeskSetNote,
  parseQuickDimensions: parseWoodDeskSetDimensions, formatFields: formatDimensionFields, exportFileName: (model) => `${model}-板木书桌组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodDeskSetDimensions(formatDimensionFields(fields)) ? '请填写书桌有效长×宽×高' : null, input.trim() && !parseWoodDeskSetDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
