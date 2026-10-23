import { formatWoodDeskMultiFields, drawWoodDeskMultiNote, getWoodDeskMultiLayout, normalizeWoodDeskMulti, parseWoodDeskMultiDimensions, woodDeskMultiDimensionLabel, woodDeskMultiIssues, woodDeskMultiModel, WOOD_DESK_MULTI_FONT, WOOD_DESK_MULTI_SELLING_FONT, type WoodDeskMultiDraft, type WoodDeskMultiOptions } from '../domain/woodDeskMultiLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WoodDeskMultiEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodDeskMulti(value.woodDeskMulti);
  const update = (change: Partial<WoodDeskMultiOptions>) => onChange((current) => ({ ...current, woodDeskMulti: { ...normalizeWoodDeskMulti(current.woodDeskMulti), ...change } }));
  return <section className="quick-section"><h3>板木书桌多组合设置</h3>
    <p className="hint">上传书桌、副柜、椅子及独立边柜/书柜整组PNG；主长宽高标书桌，副柜长宽高标独立边柜。按P30优先保证产品展示，不绘制卖点框。</p>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <p className="hint">组合件数较多时优先展示产品，底部仍保留图示备注。</p>
  </section>;
}
export const woodDeskMultiRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、30', points: [
    '上传书桌、副柜、椅子及独立边柜/书柜整组PNG；主长宽高标书桌，副柜长宽高标独立边柜。按P30优先保证产品展示，不绘制卖点框。',
    '型号＋完整规格35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8；不能省略规格。',
    '长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '组合件数较多，不绘制底部卖点框，保留产品及全部尺寸空间。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品及尺寸避让底部备注。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height', 'secondaryLength', 'secondaryWidth', 'secondaryHeight'], dimensionPrompt: '主图和副柜尺寸', sizePlaceholder: '桌长×桌宽×桌高×副柜长×副柜宽×副柜高', inspectorTitle: '板木书桌多组合',
  model: { fontSize: 35, fontFamily: WOOD_DESK_MULTI_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_DESK_MULTI_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodDeskMulti: normalizeWoodDeskMulti(undefined) }),
  restoreOptions: (draft) => ({ ...woodDeskMultiRules.createOptions(), woodDeskMulti: normalizeWoodDeskMulti((draft as WoodDeskMultiDraft).woodDeskMulti) }),
  saveOptions: (options) => ({ woodDeskMulti: normalizeWoodDeskMulti(options.woodDeskMulti) } as Partial<WoodDeskMultiDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodDeskMulti(options.woodDeskMulti)) !== JSON.stringify(normalizeWoodDeskMulti(undefined)), OptionsEditor: WoodDeskMultiEditor,
  visibleSellingPoints: () => [], layout: getWoodDeskMultiLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: woodDeskMultiModel, dimensionLabel: woodDeskMultiDimensionLabel, extraIssues: woodDeskMultiIssues, drawExtras: drawWoodDeskMultiNote,
  parseQuickDimensions: parseWoodDeskMultiDimensions, formatFields: formatWoodDeskMultiFields, exportFileName: (model) => `${model}-板木书桌多组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodDeskMultiDimensions(formatWoodDeskMultiFields(fields)) ? '请填写书桌有效桌长×桌宽×桌高×副柜长×副柜宽×副柜高' : null, input.trim() && !parseWoodDeskMultiDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
