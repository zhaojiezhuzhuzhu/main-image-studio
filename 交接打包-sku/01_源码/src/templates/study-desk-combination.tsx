import { standaloneInputSlots, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { drawStudyDeskCombinationExtras, getStudyDeskCombinationLayout, normalizeStudyDeskCombinationOptions, parseStudyDeskCombinationDimensions, studyDeskCombinationAccessories, studyDeskCombinationDimensionIssue, studyDeskCombinationDimensionLabel, studyDeskCombinationExtraIssues, studyDeskCombinationModelBadge, studyDeskCombinationNote, STUDY_DESK_SET_DEFAULT_GAP, STUDY_DESK_SET_DIMENSION_FONT, STUDY_DESK_SET_DIMENSION_KINDS, STUDY_DESK_SET_FONT, STUDY_DESK_SET_MAX_GAP, STUDY_DESK_SET_MIN_GAP, type StudyDeskCombinationDraft } from '../domain/studyDeskCombinationLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function StudyDeskCombinationOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeStudyDeskCombinationOptions(value);
  return <>
    {input.main(<><label>卖点数量<select value={options.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label><InputDetails title="排版与提示"><label>产品与卖点最小间距（px）<input type="range" min={STUDY_DESK_SET_MIN_GAP} max={STUDY_DESK_SET_MAX_GAP} value={options.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{options.dimensionGap}px</span></label><p className="hint">学习桌与学习椅分别上传透明PNG。只标学习桌的长、宽和升降高度，学习椅不标尺寸。</p></InputDetails></>)}
    {input.accessory('study-chair', <label>学习椅型号<input value={options.studyChairModel} placeholder="填写完整型号和规格" onChange={(event) => onChange((current) => ({ ...current, studyChairModel: event.target.value }))}/></label>)}
  </>;
}

export const studyDeskCombinationRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、44、46–48', points: [
    '学习桌与学习椅分别上传透明PNG；两件都填写完整型号和规格，不依据图片推测参数。',
    '无大标题；顶部270px预留价格区域，后留80px。组合型号35pt准黑白字蓝底，圆角8。',
    '仅标学习桌长、宽和升降高度，35pt中黑、行距40；高度在~后折行，单位cm，截断保留1位小数。',
    '通常三个卖点，特殊情况可两个；50pt中黑蓝字蓝框，框高98px、横向间隔30px。',
    '产品最低点距卖点至少60px，可适当增加；底部保留40pt准黑学习椅搭配说明。',
  ] },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: STUDY_DESK_SET_DIMENSION_KINDS,
  dimensionPrompt: '学习桌长、宽或升降高度', sizePlaceholder: '学习桌长×宽×高（支持 / 并列、~ 升降范围）', inspectorTitle: '儿童学习桌组合',
  model: { fontSize: 35, fontFamily: STUDY_DESK_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 26, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: STUDY_DESK_SET_DIMENSION_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '通常三个真实卖点，特殊情况可两个；框高98px和横向30px间距固定。', dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: studyDeskCombinationNote, accessories: studyDeskCombinationAccessories, drawExtras: drawStudyDeskCombinationExtras, extraIssues: studyDeskCombinationExtraIssues,
  exportFileName: (model) => `${model}-儿童学习桌组合-SKU.jpg`,
  createOptions: () => normalizeStudyDeskCombinationOptions(undefined),
  restoreOptions: (draft) => normalizeStudyDeskCombinationOptions((draft as StudyDeskCombinationDraft).studyDeskCombination),
  saveOptions(options) { const { studyChairModel, sellingPointCount, dimensionGap } = normalizeStudyDeskCombinationOptions(options); return { studyDeskCombination: { studyChairModel, sellingPointCount, dimensionGap } } as Partial<StudyDeskCombinationDraft>; },
  hasOptions(options) { const value = normalizeStudyDeskCombinationOptions(options); return Boolean(value.studyChairModel || value.sellingPointCount !== 3 || value.dimensionGap !== STUDY_DESK_SET_DEFAULT_GAP); },
  inputLayout: 'products', OptionsEditor: StudyDeskCombinationOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeStudyDeskCombinationOptions(options).sellingPointCount), layout: getStudyDeskCombinationLayout,
  sellingPointIssue: (_widths, layout) => layout.issue ?? null, modelBadge: studyDeskCombinationModelBadge,
  dimensionLabel: studyDeskCombinationDimensionLabel, parseQuickDimensions: parseStudyDeskCombinationDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, studyDeskCombinationDimensionIssue(fields), sizeInput.trim() && !parseStudyDeskCombinationDimensions(sizeInput) ? '快速尺寸无效，请填写学习桌长×宽×高，支持 / 并列规格和 ~ 升降范围' : null].filter((issue): issue is string => Boolean(issue)),
};
