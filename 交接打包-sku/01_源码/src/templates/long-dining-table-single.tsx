import { formatDimensionFields } from '../domain/dimensions';
import { getLongDiningTableSingleLayout, LONG_DINING_TABLE_DEFAULT_GAP, LONG_DINING_TABLE_DIMENSION_KINDS, LONG_DINING_TABLE_FONT, LONG_DINING_TABLE_MAX_GAP, LONG_DINING_TABLE_MIN_GAP, LONG_DINING_TABLE_NOTE_LIMIT, LONG_DINING_TABLE_SELLING_FONT, longDiningTableDimensionIssue, longDiningTableDimensionLabel, longDiningTableModelBadge, longDiningTableNote, longDiningTableNoteIssue, normalizeLongDiningTableOptions, parseLongDiningTableDimensions, type LongDiningTableDraft } from '../domain/longDiningTableSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function LongDiningTableOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const noteIssue = longDiningTableNoteIssue(value.noteText ?? '');
  return <section className="quick-section"><h3>长餐桌单品设置</h3>
    <p className="hint">填写完整型号和规格；长宽高使用 cm，并列规格用 /，范围用 ~。数值截断保留一位小数，尺寸过长自动折行。</p>
    <label>图示备注（可留空）<input value={value.noteText ?? ''} placeholder="如：图示效果以2.0米餐桌为例" aria-invalid={Boolean(noteIssue)} aria-describedby="long-dining-table-note-hint" onChange={(event) => onChange((current) => ({ ...current, noteText: event.target.value }))}/></label>
    <p className="hint" id="long-dining-table-note-hint" role={noteIssue ? 'alert' : undefined}>{noteIssue ?? `单行最多${LONG_DINING_TABLE_NOTE_LIMIT}个字符，请按当前产品资料填写。`}</p>
    <label>高度补充说明（可留空）<input value={value.heightNote ?? ''} placeholder="如：含脚垫（请按实际情况填写）" onChange={(event) => onChange((current) => ({ ...current, heightNote: event.target.value }))}/></label>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与文字间距（px）<input type="range" min={LONG_DINING_TABLE_MIN_GAP} max={LONG_DINING_TABLE_MAX_GAP} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px（建议60px，可微调）</span></label>
  </section>;
}

// 仅长餐桌单品；型号、字体、坐标和选项均以第35页独立定义。
export const longDiningTableSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、35',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数，标清长、宽、高。',
      '蓝标写完整型号＋规格，能写全尺寸规格时尽量写全。',
      '多尺寸产品省略规格中的尺寸时，下方需备注“图示效果以 xxx 为例”。',
      '卖点通常 3 个，特殊情况可 2 个；框高不变，长文案可调框宽或字间距。',
      '卖点与产品间距建议 60px，可按实际视觉效果微调。',
    ],
  },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: LONG_DINING_TABLE_DIMENSION_KINDS,
  dimensionPrompt: '餐桌长、宽或高', sizePlaceholder: '长×宽×高（支持 / 并列、~ 范围）', inspectorTitle: '长餐桌单品',
  model: { fontSize: 45, fontFamily: LONG_DINING_TABLE_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: LONG_DINING_TABLE_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '卖点框高度98px、横向间距30px固定；本模板仅用于餐桌单品。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: longDiningTableNote,
  createOptions: () => normalizeLongDiningTableOptions(undefined),
  restoreOptions: (draft) => normalizeLongDiningTableOptions((draft as LongDiningTableDraft).longDiningTable),
  saveOptions(options) {
    const { noteText, heightNote, sellingPointCount, dimensionGap } = normalizeLongDiningTableOptions(options);
    return { longDiningTable: { noteText, heightNote, sellingPointCount, dimensionGap } } as Partial<LongDiningTableDraft>;
  },
  hasOptions: (options) => Boolean(options.noteText || options.heightNote || options.sellingPointCount !== 3 || options.dimensionGap !== LONG_DINING_TABLE_DEFAULT_GAP),
  OptionsEditor: LongDiningTableOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: getLongDiningTableSingleLayout,
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: longDiningTableModelBadge,
  dimensionLabel: longDiningTableDimensionLabel,
  parseQuickDimensions: parseLongDiningTableDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, options, modelIssue) => [modelIssue, longDiningTableDimensionIssue(fields, options), longDiningTableNoteIssue(options.noteText ?? ''), sizeInput.trim() && !parseLongDiningTableDimensions(sizeInput) ? '快速尺寸无效，请按长×宽×高填写，支持 / 并列规格和 ~ 范围' : null].filter((issue): issue is string => Boolean(issue)),
};
