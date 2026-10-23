import { standaloneInputSlots, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { drawLiftingSideTableDetails, getLiftingSideTableSingleLayout, liftingSideTableAccessories, liftingSideTableDimensionIssue, liftingSideTableDimensionLabel, liftingSideTableExtraIssues, liftingSideTableModelBadge, LIFTING_SIDE_TABLE_DIMENSION_KINDS, LIFTING_SIDE_TABLE_TEXT_FONT, normalizeLiftingSideTableOptions, parseLiftingSideTableDimensions, type LiftingSideTableDraft, type SideTableDetail } from '../domain/liftingSideTableSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function LiftingSideTableOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const { sideTableDetails } = normalizeLiftingSideTableOptions(value);
  function update(index: number, update: Partial<SideTableDetail>) {
    onChange((current) => ({ ...current, sideTableDetails: normalizeLiftingSideTableOptions(current).sideTableDetails.map((detail, itemIndex) => itemIndex === index ? { ...detail, ...update } : detail) }));
  }
  return <section className="quick-section"><h3>细节图片与文案</h3>
    <InputDetails title="填写提示"><p className="hint">分别上传五张细节图，再填写对应标题与说明。文字按规定字号自动折行，超出时会提示；请依实际资料填写。</p></InputDetails>
    {sideTableDetails.map((detail, index) => input.accessory(`side-detail-${index + 1}`, <InputDetails title={`细节${index + 1} · 标题与说明`} open={index === 0}><label>细节{index + 1}标题<textarea rows={1} value={detail.title} placeholder="填写真实产品特征" onChange={(event) => update(index, { title: event.target.value })}/></label>
<label>细节{index + 1}说明（可留空）<textarea rows={1} value={detail.description} placeholder="按实际资料补充说明" onChange={(event) => update(index, { description: event.target.value })}/></label></InputDetails>))}
  </section>;
}

export const liftingSideTableSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、49', points: [
    '主图与五张细节图分别上传；标题、规格、承重和功能均依据实际资料填写，不沿用规范示例数值。',
    '顶部270px价格区保持空白，下面留30px；主型号45pt中黑白字、蓝底圆角8。',
    '右侧三张大卡、两张小卡；卡片间隔10px，文字距离边缘40px，底部留100px。',
    '前三卡标题45pt粗黑、行距50；后两卡标题35pt粗黑、行距50；说明26pt中黑、行距35。',
    '仅标主图长、宽和高；45pt中黑、行距40，线和箭头#545454；单位cm，截断保留1位小数。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: LIFTING_SIDE_TABLE_DIMENSION_KINDS,
  dimensionPrompt: '升降边桌长、宽或高', sizePlaceholder: '长×宽×高（支持 / 并列、~ 升降范围）', inspectorTitle: '升降边桌',
  model: { fontSize: 45, fontFamily: LIFTING_SIDE_TABLE_TEXT_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: LIFTING_SIDE_TABLE_TEXT_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  accessories: liftingSideTableAccessories, drawExtras: drawLiftingSideTableDetails, extraIssues: liftingSideTableExtraIssues,
  exportFileName: (model) => `${model}-升降边桌-SKU.jpg`,
  createOptions: () => normalizeLiftingSideTableOptions(undefined),
  restoreOptions: (draft) => normalizeLiftingSideTableOptions({ sideTableDetails: (draft as LiftingSideTableDraft).liftingSideTable?.details }),
  saveOptions(options) { return { liftingSideTable: { details: normalizeLiftingSideTableOptions(options).sideTableDetails } } as Partial<LiftingSideTableDraft>; },
  hasOptions: (options) => normalizeLiftingSideTableOptions(options).sideTableDetails.some((detail) => Boolean(detail.title || detail.description)),
  inputLayout: 'details', OptionsEditor: LiftingSideTableOptionsEditor, visibleSellingPoints: () => [], layout: getLiftingSideTableSingleLayout,
  sellingPointIssue: () => null, modelBadge: liftingSideTableModelBadge,
  dimensionLabel: liftingSideTableDimensionLabel, parseQuickDimensions: parseLiftingSideTableDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, liftingSideTableDimensionIssue(fields), sizeInput.trim() && !parseLiftingSideTableDimensions(sizeInput) ? '快速尺寸无效，请填写长×宽×高，支持 / 并列规格和 ~ 升降范围' : null].filter((issue): issue is string => Boolean(issue)),
};
