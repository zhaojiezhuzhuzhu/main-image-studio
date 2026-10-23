import { formatDimensionFields } from '../domain/dimensions';
import { getStudyDeskSingleLayout, normalizeStudyDeskSingleOptions, parseStudyDeskSingleDimensions, STUDY_DESK_SINGLE_DIMENSION_KINDS, STUDY_DESK_SINGLE_MAX_GAP, STUDY_DESK_SINGLE_MIN_GAP, STUDY_DESK_SINGLE_MODEL_FONT, STUDY_DESK_SINGLE_TEXT_FONT, studyDeskSingleDimensionIssue, studyDeskSingleDimensionLabel, studyDeskSingleModelBadge, type StudyDeskSingleDraft } from '../domain/studyDeskSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function StudyDeskSingleOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  return <section className="quick-section"><h3>儿童学习桌单品设置</h3>
    <p className="hint">型号标签填写完整型号和规格。尺寸使用 cm，并列规格用 /，升降范围用 ~，截断保留一位小数。</p>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
    <label>产品与卖点最小间距（px）<input type="range" min={STUDY_DESK_SINGLE_MIN_GAP} max={STUDY_DESK_SINGLE_MAX_GAP} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px</span></label>
  </section>;
}

// P47单品规则独立声明；不把样例型号、尺寸或卖点当作默认产品事实。
export const studyDeskSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、46–48', points: [
    '顶部保留270px价格公式区；本版无大标题，型号与价格区间距80px。',
    '蓝标填写完整型号及规格，45号白字；内容过长可调为35号，不省略规格。',
    '长、宽、高用cm，截断保留1位小数；并列用 /，升降范围用 ~，高度范围分两行显示。',
    '尺寸45号中黑、行距40；尺寸线与箭头为 #545454。',
    '卖点通常3个，特殊情况可2个；50号中黑蓝框、圆角8、框高98，底部留130px。',
    '卖点距产品最低点不小于60px，可按实际产品适当增加。',
  ] },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: STUDY_DESK_SINGLE_DIMENSION_KINDS,
  dimensionPrompt: '儿童学习桌长、宽或高', sizePlaceholder: '长×宽×高（支持 / 并列、~ 升降范围）', inspectorTitle: '儿童学习桌单品',
  model: { fontSize: 45, fontFamily: STUDY_DESK_SINGLE_MODEL_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: STUDY_DESK_SINGLE_TEXT_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '卖点框高98px、横向间距30px固定；请依据当前产品资料填写卖点。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => normalizeStudyDeskSingleOptions(undefined),
  restoreOptions: (draft) => normalizeStudyDeskSingleOptions((draft as StudyDeskSingleDraft).studyDeskSingle),
  saveOptions(options) {
    const { sellingPointCount, dimensionGap } = normalizeStudyDeskSingleOptions(options);
    return { studyDeskSingle: { sellingPointCount, dimensionGap } } as Partial<StudyDeskSingleDraft>;
  },
  hasOptions: (options) => options.sellingPointCount !== 3 || options.dimensionGap !== STUDY_DESK_SINGLE_MIN_GAP,
  OptionsEditor: StudyDeskSingleOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: (widths, options) => getStudyDeskSingleLayout(widths, options.dimensionGap),
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: studyDeskSingleModelBadge, dimensionLabel: studyDeskSingleDimensionLabel,
  parseQuickDimensions: parseStudyDeskSingleDimensions, formatFields: formatDimensionFields,
  extraIssues: (context, _options, _layout, fields) => [fields ? studyDeskSingleDimensionIssue(fields, context) : null].filter((issue): issue is string => Boolean(issue)),
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, studyDeskSingleDimensionIssue(fields), sizeInput.trim() && !parseStudyDeskSingleDimensions(sizeInput) ? '快速尺寸无效，请按长×宽×高填写，并列规格用 /、升降范围用 ~ 分隔' : null].filter((issue): issue is string => Boolean(issue)),
};
