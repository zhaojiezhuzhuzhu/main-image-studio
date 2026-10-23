import { InputChoice, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { doubleMattressAccessories, doubleMattressBand, doubleMattressIssues, doubleMattressMode, doubleMattressModel, doubleMattressThicknessLabel, DOUBLE_MATTRESS_BANDS, DOUBLE_MATTRESS_TEXT_FONT, drawDoubleMattress, getMattressDoubleLayout, MATTRESS_FACE_NAMES, normalizeMattressDouble, parseDoubleMattressThickness, type MattressDoubleDraft, type MattressDoubleOptions, type MattressFace } from '../domain/mattressDoubleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function MattressDoubleEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const mattress = normalizeMattressDouble(value.mattressDouble), mode = doubleMattressMode(mattress);
  const update = (change: Partial<MattressDoubleOptions>) => onChange((current) => ({ ...current, mattressDouble: { ...normalizeMattressDouble(current.mattressDouble), ...change } }));
  const updateFace = (index: number, change: Partial<MattressFace>) => update({ faces: mattress.faces.map((face, i) => i === index ? { ...face, ...change } : face) as MattressDoubleOptions['faces'] });
  return <section className="quick-section"><h3>床垫双面睡设置</h3>
    <label>床垫标题<input value={mattress.headline} placeholder="按真实产品资料填写" onChange={(event) => update({ headline: event.target.value })}/></label>
    <p className="hint">快速尺寸只填床垫厚度（cm）。正反面数值分别按产品资料填写，大于0且不超过10，最多1位小数。</p>
    {mattress.faces.map((face, i) => {
      const name = MATTRESS_FACE_NAMES[i], band = doubleMattressBand(face.value);
      return <div key={name}><h4>{name}</h4>
        <label>{name}说明（可留空）<input value={face.description} onChange={(event) => updateFace(i, { description: event.target.value })}/></label>
        <label>{name}软硬度数值<input inputMode="decimal" value={face.value} onChange={(event) => updateFace(i, { value: event.target.value })}/></label>
        {mode === 'different-bands' && <InputDetails title={`${name}指示位置微调`}><label>{name}指示位置（%）<input type="range" min={0} max={100} step={.1} value={face.position} onChange={(event) => updateFace(i, { position: Number(event.target.value) })}/></label>
          <label>{name}指示位置数值（%）<input type="number" min={0} max={100} step={.1} value={face.position} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) updateFace(i, { position: Math.max(0, Math.min(100, event.target.valueAsNumber)) }); }}/></label>
          <p className="hint">{band === null ? '填写数值后显示对应档位。' : `${DOUBLE_MATTRESS_BANDS[band]}：在${band * 20}%–${(band + 1) * 20}%内微调。`}</p></InputDetails>}
      </div>;
    })}
    <p className="hint">{mode === 'same-value' ? '正反面数值相同：合并为一个“正反面”圆标，使用该档固定位置。' : mode === 'same-band' ? '正反面处于同一区间：使用成对固定圆标，较小数值在左，面名跟随数值。' : '正反面处于不同区间：分别微调位置；改数值不会自动移动圆标。'}</p>
    <h4>三个材质卖点</h4>
    {mattress.materials.map((material, index) => input.accessory(`double-mattress-material-${index + 1}`, <>
      <label>材质卖点{index + 1}文案<input value={material.text} onChange={(event) => update({ materials: mattress.materials.map((item, i) => i === index ? { ...item, text: event.target.value } : item) })}/></label>
      <InputChoice label={`材质卖点${index + 1}文字颜色`} value={material.textColor} choices={[{value: 'black', label: '黑字'}, {value: 'white', label: '白字'}]} onChange={(textColor) => update({ materials: mattress.materials.map((item, i) => i === index ? { ...item, textColor } : item) })}/>
    </>))}
  </section>;
}
export const mattressDoubleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、10–11、13', points: [
    '双面睡须分别确认正反面硬度；主图与三张材质卖点图独立上传，厚度以信息表为准。',
    '顶部327px留白；标题100pt，说明33pt灰字，正面/反面说明前缀使用中粗黑。',
    '右上型号45pt白字蓝底、字距−25、圆角8；厚度52pt Semi Bold，cm截断保留1位小数。',
    '硬0–2（不含0）、偏硬大于2至4、适中大于4至6、偏软大于6至8、软大于8至10。',
    '同区间用成对固定位置；不同区间分别微调且圆标不重叠；数值相同合并标为“正反面”。',
    '材质文案35pt单行；底部叠暗，深色素材白字、浅色素材黑字。',
  ] },
  filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭中黑_GBK', '方正兰亭黑_GBK', '方正兰亭中粗黑_GBK', '方正兰亭准黑_GBK'],
  precision: 'truncate', allowCompound: false, dimensionKinds: ['height'], dimensionPrompt: '床垫厚度', sizePlaceholder: '床垫厚度（cm，例如27）', inspectorTitle: '床垫厚度',
  model: { fontSize: 45, fontFamily: 'Montserrat, sans-serif', color: '#ffffff', background: '#00586d', radius: 8, paddingX: 25, letterSpacing: -1.125, textY: 30, baseline: 'middle' },
  sellingPoints: { fontSize: 35, fontFamily: DOUBLE_MATTRESS_TEXT_FONT, color: '#ffffff', borderWidth: 0, radius: 8, clipRadius: 8, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, mattressDouble: normalizeMattressDouble(undefined) }),
  restoreOptions: (draft) => ({ ...mattressDoubleRules.createOptions(), mattressDouble: normalizeMattressDouble((draft as MattressDoubleDraft).mattressDouble) }),
  saveOptions: (options) => ({ mattressDouble: normalizeMattressDouble(options.mattressDouble) } as Partial<MattressDoubleDraft>),
  hasOptions: (options) => JSON.stringify(normalizeMattressDouble(options.mattressDouble)) !== JSON.stringify(normalizeMattressDouble(undefined)),
  inputLayout: 'details', OptionsEditor: MattressDoubleEditor, visibleSellingPoints: () => [], layout: getMattressDoubleLayout, sellingPointIssue: () => null,
  accessories: doubleMattressAccessories, modelBadge: doubleMattressModel, dimensionLabel: doubleMattressThicknessLabel, drawExtras: drawDoubleMattress, extraIssues: doubleMattressIssues,
  parseQuickDimensions: parseDoubleMattressThickness, formatFields: (fields) => fields.height,
  exportFileName: (model) => `${model}-床垫双面睡-SKU.jpg`,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, !parseDoubleMattressThickness(fields.height) ? '请填写有效的床垫厚度' : null, sizeInput.trim() && !parseDoubleMattressThickness(sizeInput) ? '快速尺寸仅填写单个床垫厚度（cm）' : null].filter((issue): issue is string => Boolean(issue)),
};
