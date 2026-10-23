import { formatDimensionFields } from '../domain/dimensions';
import { drawWoodDiningChairNote, getWoodDiningChairLayout, normalizeWoodDiningChair, parseWoodDiningChairDimensions, woodDiningChairDimensionLabel, woodDiningChairIssues, woodDiningChairModel, WOOD_DINING_CHAIR_FONT, WOOD_DINING_CHAIR_SELLING_FONT, type WoodDiningChairDraft, type WoodDiningChairOptions } from '../domain/woodDiningChairLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function WoodDiningChairEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodDiningChair(value.woodDiningChair);
  const update = (change: Partial<WoodDiningChairOptions>) => onChange((current) => ({ ...current, woodDiningChair: { ...normalizeWoodDiningChair(current.woodDiningChair), ...change } }));
  return <section className="quick-section"><h3>板木餐椅设置</h3>
    <p className="hint">同款餐椅分别上传侧面45°与背面45°透明PNG；数量×1、×2各输出一版。标总长、总宽、总高，宽度取产品最宽处，不能一律按两腿间距。</p>
    <label>输出数量<select aria-label="输出数量" value={options.quantity} onChange={(event) => update({ quantity: event.target.value === '2' ? 2 : 1 })}><option value={1}>单把（×1）</option><option value={2}>两把（×2）</option></select></label>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const woodDiningChairRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、33', points: [
    '同款餐椅分别上传侧面45°与背面45°透明PNG；数量×1、×2各输出一版。标总长、总宽、总高，宽度取产品最宽处，不能一律按两腿间距。',
    '型号＋完整规格45pt准黑/Montserrat白字蓝底，框高70px、圆角8；不能省略规格。',
    '长宽高用cm，45pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '遵循P21安全范围：型号下方预留100px，产品与卖点建议间距60px。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '餐椅长、宽或高', sizePlaceholder: '总长×总宽×总高', inspectorTitle: '板木餐椅',
  model: { fontSize: 45, fontFamily: WOOD_DINING_CHAIR_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_DINING_CHAIR_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodDiningChair: normalizeWoodDiningChair(undefined) }),
  restoreOptions: (draft) => ({ ...woodDiningChairRules.createOptions(), woodDiningChair: normalizeWoodDiningChair((draft as WoodDiningChairDraft).woodDiningChair) }),
  saveOptions: (options) => ({ woodDiningChair: normalizeWoodDiningChair(options.woodDiningChair) } as Partial<WoodDiningChairDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodDiningChair(options.woodDiningChair)) !== JSON.stringify(normalizeWoodDiningChair(undefined)), OptionsEditor: WoodDiningChairEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWoodDiningChair(options.woodDiningChair).sellingPointCount), layout: getWoodDiningChairLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  accessories: (options) => [{ id: 'wood-chair-rear', label: '同款餐椅背面45°视图', area: { x: 800, y: 470, width: 560, height: 1260 - normalizeWoodDiningChair(options.woodDiningChair).dimensionGap - 470 } }],
  modelBadge: woodDiningChairModel, dimensionLabel: woodDiningChairDimensionLabel, extraIssues: woodDiningChairIssues, drawExtras: drawWoodDiningChairNote,
  parseQuickDimensions: parseWoodDiningChairDimensions, formatFields: formatDimensionFields, exportFileName: (model, options) => `${model}-板木餐椅×${normalizeWoodDiningChair(options.woodDiningChair).quantity}-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodDiningChairDimensions(formatDimensionFields(fields)) ? '请填写餐椅有效长×宽×高' : null, input.trim() && !parseWoodDiningChairDimensions(input) ? '快速尺寸无效，每项填写一个正数，不使用范围或并列规格' : null].filter((value): value is string => Boolean(value)),
};
