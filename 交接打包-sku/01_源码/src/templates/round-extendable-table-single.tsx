import { useId } from 'react';
import { createRoundExtendableTableFields, formatRoundExtendableTableFields, getRoundExtendableTableSingleLayout, normalizeRoundExtendableTableOptions, parseRoundExtendableTableDimensions, ROUND_EXTENDABLE_TABLE_DEFAULT_GAP, ROUND_EXTENDABLE_TABLE_DIMENSION_KINDS, ROUND_EXTENDABLE_TABLE_FONT, ROUND_EXTENDABLE_TABLE_MAX_GAP, ROUND_EXTENDABLE_TABLE_MIN_GAP, ROUND_EXTENDABLE_TABLE_SELLING_FONT, roundExtendableTableDimensionIssue, roundExtendableTableDimensionLabel, roundExtendableTableModelBadge, roundExtendableTableNote, roundExtendableTableTextIssues, type RoundExtendableTableDraft } from '../domain/roundExtendableTableSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules, TextMeasure } from './types';

// 使用浏览器的实际字体度量校验；无Canvas的环境以保守字宽检查容量。
function textMeasure(): TextMeasure {
  const context = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1).getContext('2d') : null;
  return context ?? { font: '', measureText(text: string) { return { width: Array.from(text).length * parseFloat(this.font) } as TextMetrics; } };
}

function RoundExtendableTableOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const hintId = useId(), errorId = useId();
  const issues = roundExtendableTableTextIssues(textMeasure(), { ...createRoundExtendableTableFields(), height: '1' }, value);
  return <section className="quick-section"><h3>圆伸缩餐桌设置</h3>
    <p className="hint">型号标签请保留完整型号和规格。直径线沿双侧可伸缩方向标注；数据太长或桌面有软装时，可拖动端点移到桌面外侧。</p>
    <p className="hint" id={hintId}>快速尺寸按直径×高填写，单位 cm；~ 表示伸缩范围，/ 分隔规格。测试参数：81.6~130/91.6~150×75.3。普通圆桌可只填单个直径。备注和高度说明仅填写已确认的产品资料。</p>
    <label>高度说明（选填）<textarea rows={1} value={value.heightNote ?? ''} aria-describedby={`${hintId} ${errorId}`} onChange={(event) => onChange((current) => ({ ...current, heightNote: event.target.value }))}/></label>
    <label>底部备注（选填）<input value={value.noteText ?? ''} aria-describedby={`${hintId} ${errorId}`} onChange={(event) => onChange((current) => ({ ...current, noteText: event.target.value }))}/></label>
    <p className="hint" id={errorId} role="status">{issues.join('；')}</p>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与下方文案间距（px）<input type="range" min={ROUND_EXTENDABLE_TABLE_MIN_GAP} max={ROUND_EXTENDABLE_TABLE_MAX_GAP} step={1} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px（建议60px，可微调）</span></label>
  </section>;
}

export const roundExtendableTableSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、38',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数。',
      '蓝标写完整型号＋规格；多尺寸产品省略规格中的尺寸时，备注“图示效果以 xxx 为例”。',
      '直径标注线必须沿双侧可伸缩方向，另标产品高度。',
      '直径数据过长或被桌面软装干扰时，可按规范图示改为桌面外侧标注。',
      '卖点通常 3 个，特殊情况可 2 个；框高不变，可调框宽或字间距。',
      '卖点与产品间距建议 60px，可按实际视觉效果微调。',
    ],
  },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: ROUND_EXTENDABLE_TABLE_DIMENSION_KINDS,
  dimensionPrompt: '直径或高（直径沿双侧伸缩方向，可拖动端点作外置标注）', sizePlaceholder: '直径×高', inspectorTitle: '圆伸缩餐桌单品',
  model: { fontSize: 45, fontFamily: ROUND_EXTENDABLE_TABLE_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: ROUND_EXTENDABLE_TABLE_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '卖点请按已确认的产品资料填写，可展示两个或三个卖点。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: roundExtendableTableNote,
  createOptions: () => normalizeRoundExtendableTableOptions(undefined),
  restoreOptions: (draft) => normalizeRoundExtendableTableOptions((draft as RoundExtendableTableDraft).roundExtendableTable),
  saveOptions(options) {
    const { sellingPointCount, dimensionGap, noteText, heightNote } = normalizeRoundExtendableTableOptions(options);
    return { roundExtendableTable: { sellingPointCount, dimensionGap, noteText, heightNote } } as Partial<RoundExtendableTableDraft>;
  },
  hasOptions: (options) => options.sellingPointCount !== 3 || options.dimensionGap !== ROUND_EXTENDABLE_TABLE_DEFAULT_GAP || Boolean(options.noteText || options.heightNote),
  OptionsEditor: RoundExtendableTableOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: getRoundExtendableTableSingleLayout,
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: roundExtendableTableModelBadge,
  dimensionLabel: roundExtendableTableDimensionLabel,
  parseQuickDimensions: parseRoundExtendableTableDimensions, formatFields: formatRoundExtendableTableFields,
  exportIssues: (fields, sizeInput, options, modelIssue) => [modelIssue, roundExtendableTableDimensionIssue(fields),
    sizeInput.trim() && !parseRoundExtendableTableDimensions(sizeInput) ? '快速尺寸无效，请按直径×高填写；伸缩范围用 ~，多规格用 /' : null,
    ...roundExtendableTableTextIssues(textMeasure(), fields, options),
  ].filter((issue): issue is string => Boolean(issue)),
};
