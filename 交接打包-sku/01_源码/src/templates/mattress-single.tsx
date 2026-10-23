import { InputChoice, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { drawMattressExtras, getMattressSingleLayout, mattressAccessories, mattressExtraIssues, mattressFirmnessBand, mattressModelBadge, mattressThicknessLabel, MATTRESS_FIRMNESS_NAMES, MATTRESS_TEXT_FONT, normalizeMattressSingle, parseMattressThickness, type MattressSingleDraft, type MattressSingleOptions } from '../domain/mattressSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function MattressOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const mattress = normalizeMattressSingle(value.mattressSingle), band = mattressFirmnessBand(mattress.firmnessValue);
  const update = (change: Partial<MattressSingleOptions>) => onChange((current) => ({ ...current, mattressSingle: { ...normalizeMattressSingle(current.mattressSingle), ...change } }));
  return <section className="quick-section"><h3>床垫单面睡设置</h3>
    <label>床垫标题<input value={mattress.headline} placeholder="按真实产品资料填写" onChange={(event) => update({ headline: event.target.value })}/></label>
    <label>床垫说明（可留空）<input value={mattress.subtitle} onChange={(event) => update({ subtitle: event.target.value })}/></label>
    <p className="hint">快速尺寸只填写床垫厚度（cm），以床垫信息表为准。</p>
    <label>床垫软硬度数值<input inputMode="decimal" value={mattress.firmnessValue} placeholder="大于0且不超过10，最多1位小数" onChange={(event) => update({ firmnessValue: event.target.value })}/></label>
    <p className="hint">硬：0–2；偏硬：大于2至4；适中：大于4至6；偏软：大于6至8；软：大于8至10。数值越小越硬，0不作为有效值。</p>
    <InputDetails title="指示位置微调"><label>床垫指示位置（%）<input type="range" min={0} max={100} step={.1} value={mattress.firmnessPosition} onChange={(event) => update({ firmnessPosition: Number(event.target.value) })}/></label>
    <label>床垫指示位置数值（%）<input type="number" min={0} max={100} step={.1} value={mattress.firmnessPosition} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ firmnessPosition: Math.max(0, Math.min(100, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">{band === null ? '填写数值后显示对应档位范围。' : `当前为${MATTRESS_FIRMNESS_NAMES[band]}，指示位置请在${band * 20}%–${(band + 1) * 20}%内微调。数值改变不会自动移动指示器。`}</p></InputDetails>
    <h4>三个材质卖点</h4><p className="hint">优先选用详情中的材质图，保持视觉统一；每张图下方叠暗，文案固定单行。</p>
    {mattress.materials.map((material, index) => input.accessory(`mattress-material-${index + 1}`, <>
      <label>材质卖点{index + 1}文案<input value={material.text} onChange={(event) => update({ materials: mattress.materials.map((item, i) => i === index ? { ...item, text: event.target.value } : item) })}/></label>
      <InputChoice label={`材质卖点${index + 1}文字颜色`} value={material.textColor} choices={[{value: 'black', label: '黑字'}, {value: 'white', label: '白字'}]} onChange={(textColor) => update({ materials: mattress.materials.map((item, i) => i === index ? { ...item, textColor } : item) })}/>
    </>))}
  </section>;
}
export const mattressSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、10', points: [
    '本模板仅用于单面睡床垫；主图与三张材质卖点图分别上传，产品事实按真实资料填写。',
    '顶部327px价格区留白；标题100pt中黑，英文/数字Semi Bold；说明33pt兰亭黑、灰色。',
    '右上型号45pt白字蓝底，字距−25、圆角8；不缩小或省略完整型号。',
    '只标床垫厚度，按信息表填写，52pt Semi Bold；cm单位截断保留1位小数。',
    '单面睡仅显示一个硬度，按规范五档区间微调位置；圆内46pt、档名35pt，不根据素材推断数值。',
    '底部固定三张材质卖点图，文字35pt单行、底部叠暗；深色图白字、浅色图黑字。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭黑_GBK', '方正兰亭准黑_GBK'],
  precision: 'truncate', allowCompound: false, dimensionKinds: ['height'], dimensionPrompt: '床垫厚度', sizePlaceholder: '床垫厚度（cm，例如27）', inspectorTitle: '床垫厚度',
  model: { fontSize: 45, fontFamily: 'Montserrat, sans-serif', color: '#ffffff', background: '#00586d', radius: 8, paddingX: 25, letterSpacing: -1.125, textY: 30, baseline: 'middle' },
  sellingPoints: { fontSize: 35, fontFamily: MATTRESS_TEXT_FONT, color: '#ffffff', borderWidth: 0, radius: 8, clipRadius: 8, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, mattressSingle: normalizeMattressSingle(undefined) }),
  restoreOptions: (draft) => ({ ...mattressSingleRules.createOptions(), mattressSingle: normalizeMattressSingle((draft as MattressSingleDraft).mattressSingle) }),
  saveOptions: (options) => ({ mattressSingle: normalizeMattressSingle(options.mattressSingle) } as Partial<MattressSingleDraft>),
  hasOptions: (options) => { const m = normalizeMattressSingle(options.mattressSingle); return Boolean(m.headline || m.subtitle || m.firmnessValue || m.firmnessPosition !== 50 || m.materials.some((item) => item.text || item.textColor !== 'white')); },
  inputLayout: 'details', OptionsEditor: MattressOptionsEditor, visibleSellingPoints: () => [], layout: getMattressSingleLayout, sellingPointIssue: () => null,
  accessories: mattressAccessories, modelBadge: mattressModelBadge, dimensionLabel: mattressThicknessLabel, drawExtras: drawMattressExtras, extraIssues: mattressExtraIssues,
  parseQuickDimensions: parseMattressThickness, formatFields: (fields) => fields.height,
  exportFileName: (model) => `${model}-床垫单面睡-SKU.jpg`,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, !parseMattressThickness(fields.height) ? '请填写有效的床垫厚度' : null, sizeInput.trim() && !parseMattressThickness(sizeInput) ? '快速尺寸仅填写单个床垫厚度（cm）' : null].filter((issue): issue is string => Boolean(issue)),
};
