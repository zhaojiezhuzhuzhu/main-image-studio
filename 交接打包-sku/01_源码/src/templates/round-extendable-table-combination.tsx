import { InputCard, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { useId } from 'react';
import { drawRoundTableCombinationChair, formatRoundTableCombinationFields, getRoundExtendableTableCombinationLayout, normalizeRoundTableCombinationOptions, parseRoundTableCombinationDimensions, ROUND_TABLE_COMBINATION_DIMENSION_KINDS, ROUND_TABLE_COMBINATION_FONT, ROUND_TABLE_COMBINATION_SELLING_FONT, roundTableCombinationDimensionIssue, roundTableCombinationDimensionLabel, roundTableCombinationModelBadge, roundTableCombinationNote, roundTableCombinationTextIssues, type RoundExtendableTableCombinationDraft } from '../domain/roundExtendableTableCombinationLayout';
import { CanvasDiningChairEditor, type DiningChairEditing } from '../CanvasDiningChairEditor';
import type { CanvasOptionsEditorProps, OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';
import { roundTableCombinationChairBadge } from '../domain/roundExtendableTableCombinationLayout';

const chairEditing: DiningChairEditing = {
  fontFamily: ROUND_TABLE_COMBINATION_FONT,
  read(context, value) {
    const chairs = normalizeRoundTableCombinationOptions(value).diningChairs;
    return { badges: [{ ...roundTableCombinationChairBadge(context, value), model: chairs.models[0] }] };
  },
  change(value, index, change) {
    const chairs = normalizeRoundTableCombinationOptions(value).diningChairs;
    return { ...value, diningChairs: { ...chairs, models: [change.model ?? chairs.models[0], ''] } };
  },
};
function RoundDiningChairsCanvasEditor(props: CanvasOptionsEditorProps) { return <CanvasDiningChairEditor {...props} editing={chairEditing}/>; }

function RoundTableCombinationOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const hintId = useId();
  return <>
    {input.main(<><label>直径标注方式<select value={value.diameterPlacement ?? 'surface'} onChange={(event) => onChange((current) => ({ ...current, diameterPlacement: event.target.value as 'surface' | 'outside' }))}><option value="surface">桌面标注（白字白线）</option><option value="outside">外置标注（黑字深色线）</option></select></label><label>高度说明（选填）<textarea rows={1} value={value.heightNote ?? ''} onChange={(event) => onChange((current) => ({ ...current, heightNote: event.target.value }))}/></label><label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label><InputDetails title="填写提示"><p className="hint" id={hintId}>请上传已包含餐桌和餐椅的整组 PNG；工作台不自动生成餐椅。此版展示一款餐椅的完整型号，不按示例推断数量。</p>
<p className="hint">餐桌型号填写在上方型号栏，餐椅型号以独立蓝标显示于右下角。多规格省略尺寸时，请补充“图示效果以……为例”的实际说明。</p>
<p className="hint">直径线沿双侧伸缩方向；切换样式后仍需拖动端点到实际位置。桌面软装遮挡或数据过长时使用外置标注，不自动识别产品方向。</p>
<p className="hint">快速尺寸按直径×高填写，单位 cm；~ 表示伸缩范围，/ 分隔规格。型号、尺寸和备注只填写已确认的资料。</p></InputDetails></>)}
    <InputCard title="餐椅" quickFields={<span className="input-card-status">使用组合整图</span>}><label>餐椅完整型号<input value={value.diningChairs?.models[0] ?? ''} aria-describedby={hintId} onChange={(event) => onChange((current) => ({ ...current, diningChairs: { ...normalizeRoundTableCombinationOptions(current).diningChairs, models: [event.target.value, ''] } }))}/></label></InputCard>
    <InputCard title="公共说明"><label>图示备注（选填）<input value={value.noteText ?? ''} onChange={(event) => onChange((current) => ({ ...current, noteText: event.target.value }))}/></label></InputCard>
  </>;
}

export const roundExtendableTableCombinationRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、38–39',
    points: [
      '上传含餐桌及餐椅的完整组合素材；餐桌完整型号置左上，餐椅完整型号另置右下，均为35pt蓝底白字。',
      '尺寸用 cm，换算截断1位小数；直径线沿双侧伸缩方向，另标餐桌高度，不根据图片推测参数。',
      'P39示图使用桌面白字白线，文字统则为黑字、#545454线；提供桌面/外置两种样式，端点位置须人工对照产品调整。',
      '多规格型号省略尺寸时，备注图示所用规格；高度说明如“含脚垫”仅在产品资料确认后填写。',
      '卖点通常3个，特殊情况可2个；50pt蓝字蓝框、固定30px框间距。',
    ],
  },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: ROUND_TABLE_COMBINATION_DIMENSION_KINDS,
  dimensionPrompt: '直径或高（直径沿双侧伸缩方向）', sizePlaceholder: '直径×高', inspectorTitle: '圆伸缩餐桌组合',
  model: { fontSize: 35, fontFamily: ROUND_TABLE_COMBINATION_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 26, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: ROUND_TABLE_COMBINATION_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '填写已确认的产品卖点，可展示两个或三个。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: roundTableCombinationNote,
  drawExtras: drawRoundTableCombinationChair,
  extraIssues: (context, options, _layout, fields) => roundTableCombinationTextIssues(context, options, fields),
  exportFileName: (model) => `${model}-圆伸缩餐桌组合-SKU.jpg`,
  createOptions: () => normalizeRoundTableCombinationOptions(undefined),
  restoreOptions: (draft) => normalizeRoundTableCombinationOptions((draft as RoundExtendableTableCombinationDraft).roundExtendableTableCombination),
  saveOptions(options) {
    const { sellingPointCount, noteText, heightNote, diameterPlacement, diningChairs } = normalizeRoundTableCombinationOptions(options);
    return { roundExtendableTableCombination: { sellingPointCount, noteText, heightNote, diameterPlacement, diningChairs } } as Partial<RoundExtendableTableCombinationDraft>;
  },
  hasOptions: (options) => options.sellingPointCount !== 3 || options.diameterPlacement === 'outside' || Boolean(options.diningChairs?.models[0] || options.noteText || options.heightNote),
  inputLayout: 'products', OptionsEditor: RoundTableCombinationOptionsEditor, CanvasOptionsEditor: RoundDiningChairsCanvasEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: (widths) => getRoundExtendableTableCombinationLayout(widths),
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: roundTableCombinationModelBadge,
  dimensionLabel: roundTableCombinationDimensionLabel,
  parseQuickDimensions: parseRoundTableCombinationDimensions, formatFields: formatRoundTableCombinationFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, roundTableCombinationDimensionIssue(fields),
    sizeInput.trim() && !parseRoundTableCombinationDimensions(sizeInput) ? '快速尺寸无效，请按直径×高填写；伸缩范围用 ~，多规格用 /' : null,
  ].filter((issue): issue is string => Boolean(issue)),
};
