import { formatDimensionFields } from '../domain/dimensions';
import { getOfficeChairSingleLayout, normalizeOfficeChairOptions, OFFICE_CHAIR_DIMENSION_KINDS, OFFICE_CHAIR_MAX_GAP, OFFICE_CHAIR_MIN_GAP, OFFICE_CHAIR_MODEL_FONT, OFFICE_CHAIR_TEXT_FONT, officeChairDimensionIssue, officeChairDimensionLabel, officeChairModelBadge, parseOfficeChairDimensions, type OfficeChairDraft } from '../domain/officeChairSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function OfficeChairOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  return <section className="quick-section"><h3>书椅设置</h3>
    <p className="hint">型号标签请填写完整型号和规格。尺寸使用 cm，总长、总宽、总高截断保留一位小数。</p>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
    <label>产品与卖点最小间距（px）<input type="range" min={OFFICE_CHAIR_MIN_GAP} max={OFFICE_CHAIR_MAX_GAP} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px</span></label>
  </section>;
}

// 无功能书椅的值独立声明，公共编辑器只执行本模板规则。
export const officeChairSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、46、48',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数，标清总长、总宽、总高。',
      '蓝标写完整型号＋规格；内容过长可由 45pt 调为 35pt。',
      '卖点通常 3 个，特殊情况可 2 个；与产品最低点间距不得小于 60px，可适当加大。',
      '注意有、无大标题时，主体与上方水印的留白不同。',
      '尺寸线和箭头统一 #545454；卖点文字及边框用 #00586d。',
    ],
  },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: false,
  dimensionKinds: OFFICE_CHAIR_DIMENSION_KINDS, dimensionPrompt: '总长、总宽或总高', sizePlaceholder: '总长×总宽×总高', inspectorTitle: '无功能书椅',
  model: { fontSize: 45, fontFamily: OFFICE_CHAIR_MODEL_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: OFFICE_CHAIR_TEXT_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => normalizeOfficeChairOptions(undefined),
  restoreOptions: (draft) => normalizeOfficeChairOptions((draft as OfficeChairDraft).officeChair),
  saveOptions(options) {
    const { sellingPointCount, dimensionGap } = normalizeOfficeChairOptions(options);
    return { officeChair: { sellingPointCount, dimensionGap } } as Partial<OfficeChairDraft>;
  },
  hasOptions: (options) => options.sellingPointCount !== 3 || options.dimensionGap !== OFFICE_CHAIR_MIN_GAP,
  OptionsEditor: OfficeChairOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: (widths, options) => getOfficeChairSingleLayout(widths, options.dimensionGap),
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: (context, model) => officeChairModelBadge(context, model),
  dimensionLabel: officeChairDimensionLabel,
  parseQuickDimensions: parseOfficeChairDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, officeChairDimensionIssue(fields), sizeInput.trim() && !parseOfficeChairDimensions(sizeInput) ? '快速尺寸无效，请按总长×总宽×总高填写' : null].filter((issue): issue is string => Boolean(issue)),
};
