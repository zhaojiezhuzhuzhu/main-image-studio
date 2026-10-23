import { DEFAULT_SOFA_BED_FEATURE, getSofaBedCombinationLayout, getSofaBedSellingPointLayout, parseSofaBedQuickDimensions, restoreSofaBedSellingPoints, sofaBedDimensionIssues, sofaBedDimensionText, type SofaBedCombinationDraft } from '../domain/sofaBedCombinationLayout';
import { canvasFontFromPs } from '../domain/typography';
import { validateCombinationWorkbench, validateSingleWorkbench } from '../domain/workbenchValidation';
import type { CombinationTemplateRules, CombinationTemplateOptions, OptionsEditorProps } from './types';
import { sofaBedFeatureRules } from './sofa-bed-feature';
import { InputToggle } from '../WorkbenchInputCards';

function SofaBedOptionsEditor({ value, onChange, count, onBeforeChange }: OptionsEditorProps<CombinationTemplateOptions> & { count: number; onBeforeChange(): void }) {
  return <>
    <p className="hint">{count === 0 ? '单个 SKU：底部展示卖点；添加规格后切换为右侧规格栏。' : '主图在左，其他规格在右；“其他可选尺寸”标签位置固定。'}可导入沙发或展开状态的实际图片。</p>
    <InputToggle title="功能说明与调节箭头" checked={value.feature.enabled} onChange={(enabled) => { onBeforeChange(); onChange((current) => ({ ...current, feature: { ...current.feature, enabled } })); }}>
      <label>功能说明<input value={value.feature.text} maxLength={14} placeholder="按产品实际功能填写" onChange={(event) => onChange((current) => ({ ...current, feature: { ...current.feature, text: event.target.value } }))}/></label>
    </InputToggle>
    {count === 0 && <section className="quick-section">
      <label>卖点数量<select value={value.sellingPoints.length} onChange={(event) => onChange((current) => ({ ...current, sellingPoints: Array.from({ length: Number(event.target.value) }, (_, index) => current.sellingPoints[index] ?? '') }))}><option value="3">三个卖点</option><option value="2">两个卖点</option></select></label>
      {value.sellingPoints.map((point, index) => <label key={index}>卖点 {index + 1}<input value={point} maxLength={sofaBedCombinationRules.sellingPoints!.maxLength} onChange={(event) => onChange((current) => ({ ...current, sellingPoints: current.sellingPoints.map((item, pointIndex) => pointIndex === index ? event.target.value : item) }))}/></label>)}
    </section>}
  </>;
}

export const sofaBedCombinationRules: CombinationTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、15–16、19',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数。',
      '一个颜色一张 SKU；蓝标只写型号，不写规格。',
      '主推规格用侧面图并保留投影；次推规格不带投影，各规格高度一致。',
      '型号标和底部备注位置固定；产品与标注不得进入规范红色禁区。',
      '“其他可选尺寸”标签位置固定，文案不可修改。',
      '单个 SKU 需加卖点，沿用沙发单品标准：每条建议不超过 7 字，位置和框高固定。',
    ],
  },
  filenameName: { includeSpecification: false },
  requiredFonts: ['Montserrat', '方正兰亭中黑_GBK', 'FZLanTingHeiS-DB-GBK', 'FZLanTingHeiS-R-GBK'],
  precision: 'truncate', allowCompound: true,
  model: { fontSize: 60, fontFamily: 'Montserrat, "Microsoft YaHei", sans-serif', color: '#fff', background: '#00586d', radius: 8, paddingX: 28, textY: 62, baseline: 'alphabetic' },
  dimensionColor: '#000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  dimensionFont: canvasFontFromPs(46, 'Montserrat, Arial, sans-serif'), dimensionFontSize: 46, dimensionLineGap: 6,
  optionalLabel: { font: canvasFontFromPs(34, '"FZLanTingHeiS-DB-GBK", "Microsoft YaHei", sans-serif'), color: '#000', borderWidth: 2, radius: 28, text: '其他可选尺寸', movable: false },
  note: { font: canvasFontFromPs(40, '"FZLanTingHeiS-R-GBK", "Microsoft YaHei", sans-serif'), color: '#545454', defaultText: '*实际尺寸请以下单规格为准' },
  maxOptionalCount: 4, objectGap: 50, canvasTitle: '沙发床画布', exportFileName: (model) => `${model}-沙发床组合SKU.jpg`,
  modelWidthIssue: (width) => width > 1300 ? '产品型号过长，超出组合安全区' : null, mainFieldsColumns: 1, markingPassThrough: true,
  createOptions: () => ({ sellingPoints: ['', '', ''], feature: { ...DEFAULT_SOFA_BED_FEATURE } }),
  restoreOptions: (draft) => ({ sellingPoints: restoreSofaBedSellingPoints(draft), feature: { ...((draft as SofaBedCombinationDraft).sofaBedFeature ?? DEFAULT_SOFA_BED_FEATURE) } }),
  saveOptions: (options) => ({ sofaBedSellingPoints: options.sellingPoints, sofaBedFeature: options.feature }),
  hasOptions: (options) => Boolean(options.sellingPoints.some(Boolean) || options.feature.enabled || options.feature.text),
  OptionsEditor: SofaBedOptionsEditor,
  layout: (count) => getSofaBedCombinationLayout(count),
  labelState: (state) => ({ showLabel: state.count > 0, showNote: state.count > 0 && state.noteEnabled, side: 'right', offsetY: 0, showControls: state.count > 0 }),
  constrainLabel: () => 0,
  optionalMovementArea: (group) => group,
  annotations: (values, dimensions) => values.filter((annotation) => dimensions[annotation.kind] !== undefined),
  dimensionText: sofaBedDimensionText, parseQuickDimensions: parseSofaBedQuickDimensions,
  validate(input) {
    const validation = input.optionalSizes.length === 0 ? validateSingleWorkbench({
      model: input.model, hasImage: input.hasMainImage, dimensionFields: input.mainDimensionFields, annotations: input.mainAnnotations,
      annotationInProgress: input.mainAnnotationInProgress, sellingPoints: input.options.sellingPoints,
      sellingPointIssue: [...input.layoutIssues, ...(input.options.sellingPoints.some((point) => !point.trim()) ? ['请填写所选的两项或三项卖点'] : [])].join('；'), fontIssue: input.fontIssue,
    }) : validateCombinationWorkbench(input);
    return { ...validation, blockers: [...validation.blockers, ...sofaBedDimensionIssues(input.mainDimensionFields, input.sizeInput, '主产品'),
      ...input.optionalSizes.flatMap((item, index) => sofaBedDimensionIssues(item.dimensionFields, input.optionalSizeInputs[index], `规格 ${index + 1}`))] };
  },
  sellingPoints: { fontSize: 50, fontFamily: 'Montserrat, "方正兰亭中黑_GBK", sans-serif', color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 14, visible: (count) => count === 0, layout: getSofaBedSellingPointLayout },
  feature: sofaBedFeatureRules,
};
