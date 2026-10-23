import { DEFAULT_SOFT_BED_OPTIONS, SOFT_BED_DIMENSION_KINDS, SOFT_BED_FONT_FAMILY, formatSoftBedDimensions, getSoftBedSingleLayout, parseSoftBedDimensions, softBedDimensionIssue, softBedDimensionLabel, softBedModelBadge } from '../domain/softBedSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function SoftBedOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  return <section className="quick-section"><h3>规格设置</h3>
    <p className="hint">床头、床尾宽可用 / 填写两种规格；尺寸以 cm 为单位，截断保留一位小数。</p>
    {value.sizeLabels.map((label, index) => <label key={index}>规格说明 {index + 1}<input value={label} placeholder={index ? '如 1.8m床' : '如 1.5m床'} onChange={(event) => onChange((current) => ({ ...current, sizeLabels: current.sizeLabels.map((item, i) => i === index ? event.target.value : item) as [string, string] }))}/></label>)}
    <label>卖点数量<select aria-label="卖点数量" value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
    <label>产品与卖点间距（px）<input type="range" min={25} max={60} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px</span></label>
  </section>;
}

export const softBedSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、5、9',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数。',
      '蓝标写型号＋规格，规格简写为“床”；文案过长可由 45pt 调为 35pt。',
      '床单品需分别标床头宽、床尾宽，并标清总长和总高。',
      '卖点通常 3 个，特殊情况可 2 个；排骨架名称必须完整、准确。',
      '卖点框高度不变，可调框宽或字间距；与产品间距建议 60px，最小 25px。',
      '带灯光效果的床，素材需展示灯光效果。',
    ],
  },
  filenameName: { includeSpecification: false, suffix: '床' },
  requiredFonts: ['Montserrat', '方正兰亭中黑_GBK', '方正兰亭准黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: SOFT_BED_DIMENSION_KINDS, dimensionPrompt: '长、床头宽、床尾宽或高', sizePlaceholder: '长×床头宽×床尾宽×高', inspectorTitle: '软床单品',
  model: { fontSize: 45, fontFamily: SOFT_BED_FONT_FAMILY, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, editorPaddingX: 28, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: 'Montserrat, "方正兰亭中黑_GBK", sans-serif', color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '排骨架名称请按产品资料完整填写，不能缩写。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ ...DEFAULT_SOFT_BED_OPTIONS, sizeLabels: [...DEFAULT_SOFT_BED_OPTIONS.sizeLabels] }),
  restoreOptions: (draft) => draft.softBed ? { ...draft.softBed, sizeLabels: [...draft.softBed.sizeLabels] } : softBedSingleRules.createOptions(),
  saveOptions: (options) => ({ softBed: options }),
  hasOptions: (options) => JSON.stringify(options) !== JSON.stringify(DEFAULT_SOFT_BED_OPTIONS),
  OptionsEditor: SoftBedOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: (widths, options) => getSoftBedSingleLayout(widths, options.dimensionGap),
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: (context, model) => softBedModelBadge(context, model),
  dimensionLabel: softBedDimensionLabel,
  parseQuickDimensions: parseSoftBedDimensions, formatFields: formatSoftBedDimensions,
  exportIssues: (fields, sizeInput, options, modelIssue) => [modelIssue, softBedDimensionIssue(fields, options), sizeInput.trim() && !parseSoftBedDimensions(sizeInput) ? '快速尺寸无效，请按长×床头宽×床尾宽×高填写' : null].filter((issue): issue is string => Boolean(issue)),
};
