import { InputChoice, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { drawPillowExtras, getPillowSingleLayout, normalizePillowSingle, parsePillowDimensions, pillowAccessories, pillowDimensionLabel, pillowExtraIssues, pillowModelBadge, PILLOW_TEXT_FONT, type PillowSingleDraft, type PillowSingleOptions } from '../domain/pillowSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function PillowEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const pillow = normalizePillowSingle(value.pillowSingle);
  const update = (change: Partial<PillowSingleOptions>) => onChange((current) => ({ ...current, pillowSingle: { ...normalizePillowSingle(current.pillowSingle), ...change } }));
  return <section className="quick-section"><h3>枕头设置</h3>
    <label>枕头标题<input value={pillow.headline} placeholder="按真实产品资料填写" onChange={(event) => update({ headline: event.target.value })}/></label>
    <label>枕头说明（可留空）<input value={pillow.subtitle} onChange={(event) => update({ subtitle: event.target.value })}/></label>
    <label>枕头输出数量<select value={pillow.quantity} onChange={(event) => update({ quantity: event.target.value === '2' ? 2 : 1 })}><option value={1}>单件枕头</option><option value={2}>双件枕头（x2）</option></select></label>
    <p className="hint">单件与双件各导出一版。双件使用同一产品图并增加 x2 圆标；型号、尺寸、图片取景保持一致。</p>
    <label>局部尺寸说明（可留空）<input value={pillow.zoneText} placeholder="如脑窝区尺寸，按实际资料填写" onChange={(event) => update({ zoneText: event.target.value })}/></label>
    {pillow.zoneText && <InputDetails title="局部说明位置"><label>局部说明水平位置（%）<input type="range" min={0} max={100} value={pillow.zoneX} onChange={(event) => update({ zoneX: Number(event.target.value) })}/></label>
      <label>局部说明垂直位置（%）<input type="range" min={0} max={100} value={pillow.zoneY} onChange={(event) => update({ zoneY: Number(event.target.value) })}/></label>
      <p className="hint">位置相对产品图，移动产品时跟随；请避开长宽高标注。</p></InputDetails>}
    <h4>三个材质卖点</h4>
    {pillow.materials.map((material, index) => input.accessory(`pillow-material-${index + 1}`, <>
      <label>材质卖点{index + 1}文案<input value={material.text} onChange={(event) => update({ materials: pillow.materials.map((item, i) => i === index ? { ...item, text: event.target.value } : item) })}/></label>
      <InputChoice label={`材质卖点${index + 1}文字颜色`} value={material.textColor} choices={[{value: 'black', label: '黑字'}, {value: 'white', label: '白字'}]} onChange={(textColor) => update({ materials: pillow.materials.map((item, i) => i === index ? { ...item, textColor } : item) })}/>
    </>))}
  </section>;
}
export const pillowSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、12–13', points: [
    '枕头和枕头x2各输出一版；主产品图保持单个枕头，双件增加60pt白字蓝底数量圆标。',
    '顶部327px留白；标题100pt中黑，英文/数字Semi Bold；说明33pt兰亭黑、灰色。',
    '右上型号45pt Montserrat白字蓝底，字距−25、圆角8，保留完整内容。',
    '尺寸50pt黑字、线和箭头#545454，cm截断保留1位小数；局部尺寸按产品真实资料选填。',
    '产品距说明至少40px、距底部卡片至少25px；三张材质图独立上传与取景。',
    '材质卖点35pt单行，深色素材白字、浅色素材黑字，不将示例卖点作为默认事实。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭黑_GBK', '方正兰亭准黑_GBK'],
  precision: 'truncate', allowCompound: false, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '长、宽或高', sizePlaceholder: '长×宽×高（cm）', inspectorTitle: '枕头尺寸',
  model: { fontSize: 45, fontFamily: 'Montserrat, sans-serif', color: '#ffffff', background: '#00586d', radius: 8, paddingX: 25, letterSpacing: -1.125, textY: 30, baseline: 'middle' },
  sellingPoints: { fontSize: 35, fontFamily: PILLOW_TEXT_FONT, color: '#000000', borderWidth: 0, radius: 8, clipRadius: 8, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, pillowSingle: normalizePillowSingle(undefined) }),
  restoreOptions: (draft) => ({ ...pillowSingleRules.createOptions(), pillowSingle: normalizePillowSingle((draft as PillowSingleDraft).pillowSingle) }),
  saveOptions: (options) => ({ pillowSingle: normalizePillowSingle(options.pillowSingle) } as Partial<PillowSingleDraft>),
  hasOptions: (options) => JSON.stringify(normalizePillowSingle(options.pillowSingle)) !== JSON.stringify(normalizePillowSingle(undefined)),
  inputLayout: 'details', OptionsEditor: PillowEditor, visibleSellingPoints: () => [], layout: getPillowSingleLayout, sellingPointIssue: () => null,
  accessories: pillowAccessories, modelBadge: pillowModelBadge, dimensionLabel: pillowDimensionLabel, drawExtras: drawPillowExtras, extraIssues: pillowExtraIssues,
  parseQuickDimensions: parsePillowDimensions, formatFields: formatDimensionFields,
  exportFileName: (model, options) => `${model}-枕头${normalizePillowSingle(options.pillowSingle).quantity === 2 ? '双件x2' : '单件'}-SKU.jpg`,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, !parsePillowDimensions(formatDimensionFields(fields)) ? '请填写有效的枕头长×宽×高' : null, sizeInput.trim() && !parsePillowDimensions(sizeInput) ? '快速尺寸无效，请按枕头长×宽×高填写' : null].filter((issue): issue is string => Boolean(issue)),
};
