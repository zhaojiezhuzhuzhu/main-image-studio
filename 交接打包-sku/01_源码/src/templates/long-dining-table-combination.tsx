import { InputCard, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { LONG_DINING_SET_DEFAULT_GAP, LONG_DINING_SET_DIMENSION_KINDS, LONG_DINING_SET_FONT, LONG_DINING_SET_NOTE_INLINE_LIMIT, LONG_DINING_SET_SELLING_FONT, drawLongDiningTableCombinationExtras, getLongDiningTableCombinationLayout, longDiningTableCombinationDimensionIssue, longDiningTableCombinationDimensionLabel, longDiningTableCombinationExtraIssues, longDiningTableCombinationModelBadge, longDiningTableCombinationNote, longDiningTableCombinationNoteIssue, normalizeLongDiningTableCombinationOptions, parseLongDiningTableCombinationDimensions, type LongDiningTableCombinationDraft } from '../domain/longDiningTableCombinationLayout';
import { CanvasDiningChairEditor, type DiningChairEditing } from '../CanvasDiningChairEditor';
import type { CanvasOptionsEditorProps, OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';
import { longDiningTableCombinationChairBadges } from '../domain/longDiningTableCombinationLayout';

const chairEditing: DiningChairEditing = {
  fontFamily: LONG_DINING_SET_FONT,
  read(context, value) {
    const chairs = normalizeLongDiningTableCombinationOptions(value).diningChairs;
    return { badges: longDiningTableCombinationChairBadges(context, value).map((badge, index) => ({ ...badge, model: chairs.models[index] })), markers: chairs.count === 2 ? chairs.markers : undefined };
  },
  change(value, index, change) {
    const chairs = normalizeLongDiningTableCombinationOptions(value).diningChairs;
    const models: [string, string] = [...chairs.models], markers: typeof chairs.markers = [...chairs.markers];
    if (change.model !== undefined) models[index] = change.model;
    if (change.marker) markers[index] = change.marker;
    return { ...value, diningChairs: { ...chairs, models, markers } };
  },
};
function LongDiningChairsCanvasEditor(props: CanvasOptionsEditorProps) { return <CanvasDiningChairEditor {...props} editing={chairEditing}/>; }

function LongDiningTableCombinationOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const { diningChairs } = normalizeLongDiningTableCombinationOptions(value);
  const noteIssue = longDiningTableCombinationNoteIssue(value.noteText ?? '');
  function updateChairs(update: (current: typeof diningChairs) => typeof diningChairs) {
    onChange((current) => ({ ...current, diningChairs: update(normalizeLongDiningTableCombinationOptions(current).diningChairs) }));
  }
  return <>
    <InputCard title="组合设置"><label>搭配款数<select value={diningChairs.count} onChange={(event) => updateChairs((current) => ({ ...current, count: Number(event.target.value) as 1 | 2 }))}><option value={1}>一款餐椅或长凳</option><option value={2}>两款餐椅或长凳</option></select></label><InputDetails title="填写提示"><p className="hint">请上传完整的餐桌与全部餐椅/长凳组合 PNG。这里编辑型号和编号，不生成或复制椅子；长宽高只填写餐桌真实尺寸。</p></InputDetails></InputCard>
    {input.main(<><label>高度补充说明（可留空）<input value={value.heightNote ?? ''} placeholder="如：含脚垫（请按实际情况填写）" onChange={(event) => onChange((current) => ({ ...current, heightNote: event.target.value }))}/></label><label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label><InputDetails title="产品排版"><label>产品与卖点区域间距（px）<input type="range" min={30} max={100} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px（默认60px，可微调）</span></label></InputDetails></>)}
    {diningChairs.models.slice(0, diningChairs.count).map((model, index) => <InputCard key={index} title={`餐椅／长凳 ${index + 1}`} quickFields={<span className="input-card-status">使用组合整图</span>}><label>第{index + 1}款餐椅/长凳型号<input value={model} placeholder="填写完整型号和产品名称" onChange={(event) => updateChairs((current) => { const models: [string, string] = [...current.models]; models[index] = event.target.value; return { ...current, models }; })}/></label></InputCard>)}
    <InputCard title="公共说明"><label>图示备注（可留空）<input value={value.noteText ?? ''} placeholder="如：图示效果以2.0米餐桌为例" aria-invalid={Boolean(noteIssue)} aria-describedby="long-dining-set-note-hint" onChange={(event) => onChange((current) => ({ ...current, noteText: event.target.value }))}/></label><p className="hint" id="long-dining-set-note-hint" role={noteIssue ? 'alert' : undefined}>{noteIssue ?? `${LONG_DINING_SET_NOTE_INLINE_LIMIT}字以内显示在卖点上方；超过后移至卖点下方居中，过宽自动换行。`}</p></InputCard>
  </>;
}

// 第36–37页整图组合；不用沙发组合分组框，也不继承餐桌单品规则。
export const longDiningTableCombinationRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、36–37', points: [
    '上传完整餐桌与餐椅/长凳组合图；长、宽、高只标餐桌，尺寸用 cm，换算不四舍五入、保留 1 位小数。',
    '一款搭配在右下写型号，不加编号；两款搭配使用圆形 1 / 2 对应各自型号，编号不是件数，两行间距 15px。',
    '餐桌及搭配型号用 35pt 白字蓝底，尺寸为 35pt 黑字；完整规格过长时折行，不能省略数据。',
    '可按真实情况添加高度说明及 38pt 图示备注；没有资料时留空，不套用示例尺寸。',
    '卖点通常 3 个，特殊情况可 2 个；50pt 中黑、蓝字蓝框，框高与横向 30px 间距保持不变。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, allowDimensionText: true, dimensionKinds: LONG_DINING_SET_DIMENSION_KINDS,
  dimensionPrompt: '餐桌长、宽或高', sizePlaceholder: '餐桌长×宽×高（支持 / 并列、~ 范围）', inspectorTitle: '长餐桌组合',
  model: { fontSize: 35, fontFamily: LONG_DINING_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 26, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: LONG_DINING_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '组合图卖点框高98px、横向间距30px固定；填写真实卖点。', dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: longDiningTableCombinationNote, drawExtras: drawLongDiningTableCombinationExtras, extraIssues: longDiningTableCombinationExtraIssues,
  exportFileName: (model, options) => `${model}-长餐桌组合-${options.diningChairs?.count === 2 ? '两款搭配' : '一款搭配'}-SKU.jpg`,
  createOptions: () => normalizeLongDiningTableCombinationOptions(undefined),
  restoreOptions: (draft) => normalizeLongDiningTableCombinationOptions((draft as LongDiningTableCombinationDraft).longDiningTableCombination),
  saveOptions(options) { const { noteText, heightNote, sellingPointCount, dimensionGap, diningChairs } = normalizeLongDiningTableCombinationOptions(options); return { longDiningTableCombination: { noteText, heightNote, sellingPointCount, dimensionGap, diningChairs } } as Partial<LongDiningTableCombinationDraft>; },
  hasOptions(options) { const normalized = normalizeLongDiningTableCombinationOptions(options), defaults = normalizeLongDiningTableCombinationOptions(undefined); return Boolean(normalized.noteText || normalized.heightNote || normalized.sellingPointCount !== 3 || normalized.dimensionGap !== LONG_DINING_SET_DEFAULT_GAP || JSON.stringify(normalized.diningChairs) !== JSON.stringify(defaults.diningChairs)); },
  inputLayout: 'products', OptionsEditor: LongDiningTableCombinationOptionsEditor, CanvasOptionsEditor: LongDiningChairsCanvasEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount), layout: getLongDiningTableCombinationLayout,
  sellingPointIssue: (_widths, layout) => layout.issue ?? null, modelBadge: longDiningTableCombinationModelBadge,
  dimensionLabel: longDiningTableCombinationDimensionLabel, parseQuickDimensions: parseLongDiningTableCombinationDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, options, modelIssue) => [modelIssue, longDiningTableCombinationDimensionIssue(fields, options), longDiningTableCombinationNoteIssue(options.noteText ?? ''), sizeInput.trim() && !parseLongDiningTableCombinationDimensions(sizeInput) ? '快速尺寸无效，请填写餐桌长×宽×高，支持 / 并列规格和 ~ 范围' : null].filter((issue): issue is string => Boolean(issue)),
};
