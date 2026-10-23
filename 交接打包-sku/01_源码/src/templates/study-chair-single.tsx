import { standaloneInputSlots, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { drawStudyChairDetails, getStudyChairSingleLayout, studyChairAccessories, studyChairDimensionIssue, studyChairDimensionLabel, studyChairExtraIssues, studyChairModelBadge, STUDY_CHAIR_DIMENSION_KINDS, STUDY_CHAIR_TEXT_FONT, normalizeStudyChairOptions, parseStudyChairDimensions, type StudyChairDraft, type StudyChairDetail } from '../domain/studyChairSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function StudyChairOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const { studyChairDetails } = normalizeStudyChairOptions(value);
  function update(index: number, update: Partial<StudyChairDetail>) {
    onChange((current) => ({ ...current, studyChairDetails: normalizeStudyChairOptions(current).studyChairDetails.map((detail, itemIndex) => itemIndex === index ? { ...detail, ...update } : detail) }));
  }
  return <section className="quick-section"><h3>细节图片与文案</h3>
    <InputDetails title="填写提示"><p className="hint">分别上传五张细节图，并依据实际资料填写标题及说明。支持手动换行，超出规定字号容量时会提示。</p></InputDetails>
    {studyChairDetails.map((detail, index) => input.accessory(`study-chair-detail-${index + 1}`, <InputDetails title={`细节${index + 1} · 标题与说明`} open={index === 0}><label>细节{index + 1}标题<textarea rows={1} value={detail.title} placeholder="填写真实产品特征" onChange={(event) => update(index, { title: event.target.value })}/></label>
<label>细节{index + 1}说明（可留空）<textarea rows={1} value={detail.description} placeholder="按实际资料填写，可分行说明" onChange={(event) => update(index, { description: event.target.value })}/></label></InputDetails>))}
  </section>;
}

export const studyChairSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、49–50', points: [
    '主图与五张细节图分别上传；功能、调节方式、材质及角度均按实际资料填写，不沿用规范样例。',
    '顶部270px价格区保持空白，下面留30px；主型号45pt中黑白字，蓝底圆角8。',
    '右侧三张大卡、两张小卡，间隔10px；文字距边缘40px，底部留100px。',
    '前三卡标题45pt粗黑、后两卡35pt粗黑，行距50；说明26pt中黑、行距35，可按实际内容分行。',
    '主图标总长、总宽和总高；总高范围按三行显示，45pt中黑、行距40，单位cm，截断保留1位小数。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: STUDY_CHAIR_DIMENSION_KINDS,
  dimensionPrompt: '儿童学习椅总长、总宽或总高', sizePlaceholder: '总长×总宽×总高（支持 / 并列、~ 升降范围）', inspectorTitle: '儿童学习椅',
  model: { fontSize: 45, fontFamily: STUDY_CHAIR_TEXT_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: STUDY_CHAIR_TEXT_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  accessories: studyChairAccessories, drawExtras: drawStudyChairDetails, extraIssues: studyChairExtraIssues,
  exportFileName: (model) => `${model}-儿童学习椅-SKU.jpg`,
  createOptions: () => normalizeStudyChairOptions(undefined),
  restoreOptions: (draft) => normalizeStudyChairOptions({ studyChairDetails: (draft as StudyChairDraft).studyChair?.details }),
  saveOptions(options) { return { studyChair: { details: normalizeStudyChairOptions(options).studyChairDetails } } as Partial<StudyChairDraft>; },
  hasOptions: (options) => normalizeStudyChairOptions(options).studyChairDetails.some((detail) => Boolean(detail.title || detail.description)),
  inputLayout: 'details', OptionsEditor: StudyChairOptionsEditor, visibleSellingPoints: () => [], layout: getStudyChairSingleLayout,
  sellingPointIssue: () => null, modelBadge: studyChairModelBadge,
  dimensionLabel: studyChairDimensionLabel, parseQuickDimensions: parseStudyChairDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, studyChairDimensionIssue(fields), sizeInput.trim() && !parseStudyChairDimensions(sizeInput) ? '快速尺寸无效，请填写总长×总宽×总高，支持 / 并列规格和 ~ 升降范围' : null].filter((issue): issue is string => Boolean(issue)),
};
