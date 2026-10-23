import { standaloneInputSlots, InputCard, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { WOOD_BED_MULTI_FIRMNESS, WOOD_BED_MULTI_FONT, drawWoodBedMulti, getWoodBedMultiLayout, normalizeWoodBedMulti, parseWoodBedMultiDimensions, woodBedMultiAccessories, woodBedMultiDimensionLabel, woodBedMultiIssues, woodBedMultiModel, type MultiBedMattress, type WoodBedMultiDraft, type WoodBedMultiOptions } from '../domain/woodBedMultiCombinationLayout';
import { CompactFirmnessEditor } from './compact-firmness-editor';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function BedMultiEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const set = normalizeWoodBedMulti(value.woodBedMultiCombination);
  const update = (change: Partial<WoodBedMultiOptions>) => onChange((current) => ({ ...current, woodBedMultiCombination: { ...normalizeWoodBedMulti(current.woodBedMultiCombination), ...change } }));
  const mattress = (index: number, change: Partial<MultiBedMattress>) => update({ mattresses: set.mattresses.map((item, i) => i === index ? { ...item, ...change } : item) as WoodBedMultiOptions['mattresses'] });
  return <>
    <InputCard title="组合设置"><label>床垫款数<select aria-label="床垫款数" value={set.mattressCount} onChange={(event) => update({ mattressCount: event.target.value === '2' ? 2 : 3 })}><option value={2}>两款床垫</option><option value={3}>三款床垫</option></select></label><label>床头柜款数<select aria-label="床头柜款数" value={set.cabinetCount} onChange={(event) => update({ cabinetCount: Number(event.target.value) as 0 | 1 | 2 })}><option value={0}>不搭配床头柜</option><option value={1}>一款床头柜</option><option value={2}>两款床头柜</option></select></label><InputDetails title="填写提示"><p className="hint">款数是可选搭配款式，不代表发货数量；分别上传透明PNG。减少款数会保留隐藏素材和资料。</p></InputDetails></InputCard>
    {input.main(<label>床体类型<select aria-label="床体类型" value={set.bedKind} onChange={(event) => update({ bedKind: event.target.value === 'storage' ? 'storage' : 'standard' })}><option value="standard">普通床</option><option value="storage">储物床（展示打开效果）</option></select></label>)}
    {set.mattresses.slice(0, set.mattressCount).map((item, i) => input.accessory(`wood-bed-multi-mattress-${i + 1}`, <><label>床垫{i + 1}名称<input aria-label={`床垫${i + 1}名称`} value={item.title} onChange={(event) => mattress(i, { title: event.target.value })}/></label>
<label>床垫{i + 1}厚度（cm）<input aria-label={`床垫${i + 1}厚度（cm）`} inputMode="decimal" value={item.thickness} onChange={(event) => mattress(i, { thickness: event.target.value })}/></label>
<label>床垫{i + 1}型号<input aria-label={`床垫${i + 1}型号`} value={item.model} onChange={(event) => mattress(i, { model: event.target.value })}/></label><InputDetails title="软硬度资料"><CompactFirmnessEditor name={`床垫${i + 1}`} value={item.firmness} style={WOOD_BED_MULTI_FIRMNESS} onChange={(firmness) => mattress(i, { firmness })}/></InputDetails></>))}
    {set.cabinetModels.slice(0, set.cabinetCount).map((model, i) => input.accessory(`wood-bed-multi-cabinet-${i + 1}`, <><label>床头柜{i + 1}型号及规格<input aria-label={`床头柜${i + 1}型号及规格`} value={model} onChange={(event) => update({ cabinetModels: set.cabinetModels.map((text, index) => i === index ? event.target.value : text) as [string, string] })}/></label><div className="quick-product-row">{(['length', 'height'] as const).map((kind) => <label key={kind}>床头柜{i + 1}{kind === 'length' ? '长' : '高'}（cm）<input aria-label={`床头柜${i + 1}${kind === 'length' ? '长' : '高'}（cm）`} value={set.cabinetDimensions[i][kind]} onChange={(event) => update({ cabinetDimensions: set.cabinetDimensions.map((item, index) => index === i ? { ...item, [kind]: event.target.value } : item) as WoodBedMultiOptions['cabinetDimensions'] })}/></label>)}</div></>))}
    <InputCard title="整体排版"><InputDetails title="间距与说明"><label>床体与床垫间距（px）<input aria-label="床体与床垫间距（px）" type="number" min={30} max={100} value={set.productGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ productGap: Math.max(30, Math.min(100, event.target.valueAsNumber)) }); }}/></label><label>搭配区与备注间距（px）<input aria-label="搭配区与备注间距（px）" type="number" min={15} max={100} value={set.noteGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ noteGap: Math.max(15, Math.min(100, event.target.valueAsNumber)) }); }}/></label><p className="hint">床头柜长、高标注会随图片一起移动缩放。点击尺寸文字或线条可编辑端点、辅助线及数值。</p>
<p className="hint">上下两处间距建议40px，最小分别30px、15px；床垫左右间距固定30px。底部备注固定，其他风险说明放尺寸图或材料解析。</p></InputDetails></InputCard>
  </>;
}
export const woodBedMultiCombinationRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、6–8、21、23', points: [
    '两至三款床垫、零至两款床头柜独立搭配；款数不代表发货数量，储物床应展示打开效果。',
    '顶部370px预留；所有蓝标33pt准黑/Montserrat白字、圆角8，床垫型号33pt黑字。',
    '床体尺寸35pt、斜线25pt，cm截断保留1位小数，最多三种并列规格；床体标总长、总宽、总高；搭配床头柜另标长和高。',
    '每款床垫独立填写名称、厚度、型号和软硬度；20pt圆标保留面名与档名，不套用示例事实。',
    '上下间距建议40px，最小30/15px；床垫左右间隔30px，多组合不附加单床垫卖点卡。',
    '底部仅一句固定42pt灰色备注；售后风险放尺寸图或材料解析。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '床体长、宽或高', sizePlaceholder: '床体长×宽×高（/ 并列规格）', inspectorTitle: '板木床多组合',
  model: { fontSize: 33, fontFamily: WOOD_BED_MULTI_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 35, fontFamily: WOOD_BED_MULTI_FONT, color: '#000000', borderWidth: 0, radius: 8, clipRadius: 8, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, woodBedMultiCombination: normalizeWoodBedMulti(undefined) }),
  restoreOptions: (draft) => ({ ...woodBedMultiCombinationRules.createOptions(), woodBedMultiCombination: normalizeWoodBedMulti((draft as WoodBedMultiDraft).woodBedMultiCombination) }),
  saveOptions: (options) => ({ woodBedMultiCombination: normalizeWoodBedMulti(options.woodBedMultiCombination) } as Partial<WoodBedMultiDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodBedMulti(options.woodBedMultiCombination)) !== JSON.stringify(normalizeWoodBedMulti(undefined)),
  inputLayout: 'products', OptionsEditor: BedMultiEditor, visibleSellingPoints: () => [], layout: getWoodBedMultiLayout, sellingPointIssue: () => null,
  changeAccessoryDimensions(options, id, fields, annotations) {
    const value = normalizeWoodBedMulti(options.woodBedMultiCombination), index = Number(id.split('-').at(-1)) - 1;
    if (!id.startsWith('wood-bed-multi-cabinet-') || ![0, 1].includes(index)) return options;
    return { ...options, woodBedMultiCombination: { ...value, cabinetDimensions: value.cabinetDimensions.map((item, i) => i === index ? { length: fields.length, height: fields.height, annotations } : item) as WoodBedMultiOptions['cabinetDimensions'] } };
  },
  accessories: woodBedMultiAccessories, modelBadge: woodBedMultiModel, dimensionLabel: woodBedMultiDimensionLabel, drawExtras: drawWoodBedMulti, extraIssues: woodBedMultiIssues,
  parseQuickDimensions: parseWoodBedMultiDimensions, formatFields: formatDimensionFields,
  exportFileName: (model, options) => { const set = normalizeWoodBedMulti(options.woodBedMultiCombination); return `${model}-板木床多组合-${set.mattressCount}款床垫-${set.cabinetCount}款床头柜-SKU.jpg`; },
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodBedMultiDimensions(formatDimensionFields(fields)) ? '请填写床体有效长×宽×高' : null, input.trim() && !parseWoodBedMultiDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
