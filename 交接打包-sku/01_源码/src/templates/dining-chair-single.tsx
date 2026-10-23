import { standaloneInputSlots, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { DINING_CHAIR_DIMENSION_KINDS, DINING_CHAIR_FONT, DINING_CHAIR_LINE_STYLE, DINING_CHAIR_MAX_GAP, DINING_CHAIR_MIN_GAP, DINING_CHAIR_SELLING_FONT, diningChairAccessories, diningChairDimensionIssue, diningChairDimensionLabel, diningChairExtraIssues, diningChairModelBadge, drawDiningChairExtras, getDiningChairSingleLayout, normalizeDiningChairOptions, parseDiningChairDimensions, type DiningChairDraft, type DiningChairSettings } from '../domain/diningChairSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function DiningChairOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const { diningChair } = normalizeDiningChairOptions(value);
  function update(update: Partial<DiningChairSettings>) {
    onChange((current) => ({ ...current, diningChair: { ...normalizeDiningChairOptions(current).diningChair, ...update } }));
  }
  return <section className="quick-section"><h3>餐椅设置</h3>
    <label>输出数量<select value={diningChair.quantity} onChange={(event) => update({ quantity: Number(event.target.value) as 1 | 2 })}><option value={1}>单把（x1）</option><option value={2}>两把（x2）</option></select></label>
    <p className="hint">型号末尾自动显示数量；请切换数量，各导出一版。型号填写原始内容，数量切换不改写原型号。</p>
    <label>总宽标法<select value={diningChair.widthMode} onChange={(event) => update({ widthMode: event.target.value as DiningChairSettings['widthMode'] })}><option value="standard">常规：总宽在两腿之间</option><option value="outside">特殊：总宽在两腿之外</option></select></label>
    {diningChair.widthMode === 'outside' ? <>
      <p className="hint">快速尺寸中的“宽”填写主视图腿间宽；另填第二视图的真实总宽。第二视图应完整展示最宽部位，总宽线随图片移动缩放。</p>

    </> : <p className="hint">快速尺寸按总长×总宽×总高填写，总宽标在主视图两腿之间。第二视图展示另一角度，不重复标注。</p>}
    <label>高度补充说明（可留空）<input value={diningChair.heightNote} placeholder="按实际测量范围填写" onChange={(event) => update({ heightNote: event.target.value })}/></label>
    <p className="hint">分别上传主视图和第二视图透明PNG；两张图展示同一款餐椅的不同角度，不代表购买数量。</p>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
    <InputDetails title="排版间距"><label>产品与卖点最小间距（px）<input type="range" min={DINING_CHAIR_MIN_GAP} max={DINING_CHAIR_MAX_GAP} value={value.dimensionGap} onChange={(event) => onChange((current) => ({ ...current, dimensionGap: Number(event.target.value) }))}/><span>{value.dimensionGap}px</span></label></InputDetails>
    {input.accessory('chair-rear', diningChair.widthMode === 'outside' ? <label>第二视图总宽（cm）<input value={diningChair.outerWidth} inputMode="decimal" placeholder="按实际资料填写总宽" onChange={(event) => update({ outerWidth: event.target.value })}/></label> : <p className="hint">展示同款餐椅的另一角度。</p>)}
  </section>;
}

export const diningChairSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、40–41', points: [
    '同款餐椅展示两个视图；型号x1、x2各输出一版，数量切换不改变原型号。',
    '型号45号白字准黑、蓝底圆角8；总长、总宽、总高45号黑字准黑，线与箭头为 #545454。',
    '常规总宽标在主视图两腿之间；特殊情况主图标腿间宽，第二视图另标真实总宽，不混用两个数值。',
    '尺寸用cm，换算截断保留1位小数；高度补充说明按实际测量范围填写，不默认包含脚垫。',
    '卖点通常三个、特殊情况两个；50号中黑，蓝字蓝框、圆角8、固定框高98px和横向30px间距。',
    '按P41新版双视图安排留白，不增加主标题；第二视图须完整展示椅子的最宽部位。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: false, dimensionKinds: DINING_CHAIR_DIMENSION_KINDS,
  dimensionPrompt: '餐椅总长、宽或总高', sizePlaceholder: '长×宽×高（宽的含义见总宽标法）', inspectorTitle: '餐椅双视图',
  model: { fontSize: 45, fontFamily: DINING_CHAIR_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: DINING_CHAIR_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '50号卖点框高98px、横向间距30px固定；请依据实际产品资料填写。', dimensionColor: '#000000', lineStyle: DINING_CHAIR_LINE_STYLE,
  createOptions: () => normalizeDiningChairOptions(undefined),
  restoreOptions(draft) { const saved = (draft as DiningChairDraft).diningChair; return normalizeDiningChairOptions({ ...saved, diningChair: saved }); },
  saveOptions(options) { const { diningChair, sellingPointCount, dimensionGap } = normalizeDiningChairOptions(options); return { diningChair: { ...diningChair, sellingPointCount, dimensionGap } } as Partial<DiningChairDraft>; },
  hasOptions(options) { const { diningChair, sellingPointCount, dimensionGap } = normalizeDiningChairOptions(options); return diningChair.quantity !== 1 || diningChair.widthMode !== 'standard' || Boolean(diningChair.heightNote || diningChair.outerWidth) || sellingPointCount !== 3 || dimensionGap !== 60; },
  inputLayout: 'details', OptionsEditor: DiningChairOptionsEditor, visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: getDiningChairSingleLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  accessories: diningChairAccessories, modelBadge: diningChairModelBadge, dimensionLabel: diningChairDimensionLabel, drawExtras: drawDiningChairExtras,
  extraIssues: diningChairExtraIssues, exportFileName: (model, options) => `${model}-餐椅x${normalizeDiningChairOptions(options).diningChair.quantity}-SKU.jpg`,
  parseQuickDimensions: parseDiningChairDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, options, modelIssue) => [modelIssue, diningChairDimensionIssue(fields, options), sizeInput.trim() && !parseDiningChairDimensions(sizeInput) ? '快速尺寸无效，请按餐椅长×宽×高填写三个正数（cm）' : null].filter((issue): issue is string => Boolean(issue)),
};
