import { InputChoice, standaloneInputSlots, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { COMPUTER_CHAIR_DIMENSION_KINDS, COMPUTER_CHAIR_TEXT_FONT, computerChairAccessories, computerChairDefaultTextColor, computerChairDimensionIssue, computerChairDimensionLabel, computerChairExtraIssues, computerChairModelBadge, drawComputerChairDetails, getComputerChairSingleLayout, normalizeComputerChairOptions, parseComputerChairDimensions, type ComputerChairDetail, type ComputerChairDraft } from '../domain/computerChairSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function ComputerChairOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const { computerChairDetails } = normalizeComputerChairOptions(value);
  function update(index: number, update: Partial<ComputerChairDetail>) {
    onChange((current) => ({ ...current, computerChairDetails: normalizeComputerChairOptions(current).computerChairDetails.map((detail, itemIndex) => itemIndex === index ? { ...detail, ...update } : detail) }));
  }
  return <section className="quick-section"><h3>细节图片与文案</h3>
    <InputDetails title="填写提示"><p className="hint">主图标总长、总宽、总高；五张细节图分别上传。标题和说明按真实产品资料填写，文字颜色选择与图片背景有清晰对比的一种。</p></InputDetails>
    {computerChairDetails.map((detail, index) => input.accessory(`computer-detail-${index + 1}`, <InputDetails title={`细节${index + 1} · 标题与说明`} open={index === 0}><label>细节{index + 1}标题<textarea rows={1} value={detail.title} placeholder="填写真实产品特征" onChange={(event) => update(index, { title: event.target.value })}/></label>
<label>细节{index + 1}说明（可留空）<textarea rows={1} value={detail.description} placeholder="按实际资料补充说明" onChange={(event) => update(index, { description: event.target.value })}/></label>
<InputChoice label={`细节${index + 1}文字颜色`} value={detail.textColor} choices={[{value: 'black', label: '黑字'}, {value: 'white', label: '白字'}]} onChange={(textColor) => update(index, { textColor })}/></InputDetails>))}
  </section>;
}

export const computerChairSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、49–50', points: [
    '按第50页电脑椅图制作：左侧主图，右侧三张大卡、两张小卡，主图和五张细节图分别上传。',
    '顶部270px价格区空白，其后留30px；型号45pt中黑白字、蓝底圆角8，填写完整型号及规格。',
    '总长、总宽、总高45pt中黑，行距40；总高名称与数值分行。单位cm，截断保留1位小数。',
    '前三卡标题45pt粗黑，后两卡35pt粗黑、行距50；说明26pt中黑、行距35，文字距卡边40px。',
    '卡片间距10px，底部留100px；第二卡示例白字，其余黑字，可按素材背景选择黑字或白字。',
    '材质、功能、角度及尺寸须依据实际资料填写，不预填规范样例卖点或示意箭头。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: COMPUTER_CHAIR_DIMENSION_KINDS,
  dimensionPrompt: '电脑椅总长、总宽或总高', sizePlaceholder: '总长×总宽×总高（支持 / 并列、~ 升降范围）', inspectorTitle: '电脑椅',
  model: { fontSize: 45, fontFamily: COMPUTER_CHAIR_TEXT_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: COMPUTER_CHAIR_TEXT_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  accessories: computerChairAccessories, drawExtras: drawComputerChairDetails, extraIssues: computerChairExtraIssues,
  exportFileName: (model) => `${model}-电脑椅-SKU.jpg`,
  createOptions: () => normalizeComputerChairOptions(undefined),
  restoreOptions: (draft) => normalizeComputerChairOptions({ computerChairDetails: (draft as ComputerChairDraft).computerChair?.details }),
  saveOptions(options) { return { computerChair: { details: normalizeComputerChairOptions(options).computerChairDetails } } as Partial<ComputerChairDraft>; },
  hasOptions: (options) => normalizeComputerChairOptions(options).computerChairDetails.some((detail, index) => Boolean(detail.title || detail.description) || detail.textColor !== computerChairDefaultTextColor(index)),
  inputLayout: 'details', OptionsEditor: ComputerChairOptionsEditor, visibleSellingPoints: () => [], layout: getComputerChairSingleLayout,
  sellingPointIssue: () => null, modelBadge: computerChairModelBadge,
  dimensionLabel: computerChairDimensionLabel, parseQuickDimensions: parseComputerChairDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, computerChairDimensionIssue(fields), sizeInput.trim() && !parseComputerChairDimensions(sizeInput) ? '快速尺寸无效，请填写总长×总宽×总高，支持 / 并列规格和 ~ 升降范围' : null].filter((issue): issue is string => Boolean(issue)),
};
