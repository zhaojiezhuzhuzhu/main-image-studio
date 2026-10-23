import { standaloneInputSlots, InputCard, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { WOOD_BED_COMBINATION_FIRMNESS, WOOD_BED_COMBINATION_FONT, drawWoodBedCombination, getWoodBedCombinationLayout, normalizeWoodBedCombination, parseWoodBedCombinationDimensions, woodBedCombinationAccessories, woodBedCombinationDimensionLabel, woodBedCombinationIssues, woodBedCombinationModel, type WoodBedCombinationDraft, type WoodBedCombinationOptions } from '../domain/woodBedCombinationLayout';
import { CompactFirmnessEditor } from './compact-firmness-editor';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function BedCombinationEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const set = normalizeWoodBedCombination(value.woodBedCombination);
  const update = (change: Partial<WoodBedCombinationOptions>) => onChange((current) => ({ ...current, woodBedCombination: { ...normalizeWoodBedCombination(current.woodBedCombination), ...change } }));
  const mattress = (change: Partial<WoodBedCombinationOptions['mattress']>) => update({ mattress: { ...set.mattress, ...change } });
  return <>
    <InputCard title="组合设置"><label>搭配形式<select aria-label="搭配形式" value={set.set} onChange={(event) => update({ set: event.target.value as WoodBedCombinationOptions['set'] })}><option value="both">床＋床垫＋床头柜</option><option value="mattress">床＋床垫</option><option value="cabinet">床＋床头柜</option></select></label><InputDetails title="填写提示"><p className="hint">板木床型号必须保留完整规格，不能简写为“床”；带灯光的床与床头柜展示亮灯效果。床体和搭配品分别上传透明PNG。切换搭配会保留隐藏的图片、型号及设置；储物床请提供打开效果图。</p></InputDetails></InputCard>
    {input.main(<label>床体类型<select aria-label="床体类型" value={set.bedKind} onChange={(event) => update({ bedKind: event.target.value === 'storage' ? 'storage' : 'standard', productGap: event.target.value === 'storage' ? 30 : 100, noteGap: event.target.value === 'storage' ? 40 : 80 })}><option value="standard">普通床</option><option value="storage">储物床（展示打开效果）</option></select></label>)}
    {set.set !== 'cabinet' && input.accessory('wood-bed-set-mattress', <><label>床垫名称<input aria-label="床垫名称" value={set.mattress.title} onChange={(event) => mattress({ title: event.target.value })}/></label>
<label>床垫厚度（cm）<input aria-label="床垫厚度（cm）" inputMode="decimal" value={set.mattress.thickness} onChange={(event) => mattress({ thickness: event.target.value })}/></label>
<label>床垫型号<input aria-label="床垫型号" value={set.mattress.model} onChange={(event) => mattress({ model: event.target.value })}/></label><InputDetails title="卖点与软硬度">{set.mattress.points.map((point, i) => <label key={i}>床垫卖点{i + 1}<input aria-label={`床垫卖点${i + 1}`} value={point} onChange={(event) => mattress({ points: set.mattress.points.map((text, index) => i === index ? event.target.value : text) as [string, string, string] })}/></label>)}
<CompactFirmnessEditor name="搭配床垫" value={set.mattress.firmness} style={WOOD_BED_COMBINATION_FIRMNESS} onChange={(firmness) => mattress({ firmness })}/></InputDetails></>)}
    {set.set !== 'mattress' && input.accessory('wood-bed-set-cabinet', <><label>床头柜型号及规格<input aria-label="床头柜型号及规格" value={set.cabinetModel} onChange={(event) => update({ cabinetModel: event.target.value })}/></label><div className="quick-product-row">{(['length', 'height'] as const).map((kind) => <label key={kind}>床头柜{kind === 'length' ? '长' : '高'}（cm）<input aria-label={`床头柜${kind === 'length' ? '长' : '高'}（cm）`} value={set.cabinetDimensions[kind]} onChange={(event) => update({ cabinetDimensions: { ...set.cabinetDimensions, [kind]: event.target.value } })}/></label>)}</div></>)}
    <InputCard title="整体排版"><InputDetails title="间距与说明">{set.set !== 'cabinet' && <label>床体与床垫间距（px）<input aria-label="床体与床垫间距（px）" type="number" min={30} max={160} value={set.productGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ productGap: Math.max(30, Math.min(160, event.target.valueAsNumber)) }); }}/></label>}<label>搭配区与备注间距（px）<input aria-label="搭配区与备注间距（px）" type="number" min={40} max={160} value={set.noteGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ noteGap: Math.max(40, Math.min(160, event.target.valueAsNumber)) }); }}/></label><p className="hint">床头柜长、高标注会随图片一起移动缩放。点击尺寸文字或线条可编辑端点、辅助线及数值。</p>
<p className="hint">普通床建议100px/80px；储物床最小30px/40px。切换床体类型时采用相应建议值，之后可微调。</p></InputDetails></InputCard>
  </>;
}
export const woodBedCombinationRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、6–8、21、23', points: [
    '床＋床垫、床＋床头柜、三件搭配可切换；每件独立上传透明PNG，储物床展示打开效果。',
    '沿用P23指定的软床组合标准：型号33pt，长型号可分为两行、底框100px，准黑/Montserrat白字蓝底、圆角8，按真实型号和规格填写。',
    '床体标总长、总宽、总高；搭配床头柜另标长和高；尺寸35pt、斜线25pt、黑字，cm截断保留1位小数，最多三种并列规格。',
    '单床垫配说明卡：名称与厚度蓝标、型号28pt灰字、三个卖点30pt灰字。',
    '床垫软硬度20pt，单/双面按真实资料填写；同档固定位置，同值合并，不同档分别微调。',
    '普通床间距建议100/80px，储物床最小30/40px；底部固定一句42pt灰色搭配备注。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '床体长、宽或高', sizePlaceholder: '床体长×宽×高（/ 并列规格）', inspectorTitle: '板木床组合',
  model: { fontSize: 33, fontFamily: WOOD_BED_COMBINATION_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 30, fontFamily: WOOD_BED_COMBINATION_FONT, color: '#525054', borderWidth: 0, radius: 8, clipRadius: 8, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0, woodBedCombination: normalizeWoodBedCombination(undefined) }),
  restoreOptions: (draft) => ({ ...woodBedCombinationRules.createOptions(), woodBedCombination: normalizeWoodBedCombination((draft as WoodBedCombinationDraft).woodBedCombination) }),
  saveOptions: (options) => ({ woodBedCombination: normalizeWoodBedCombination(options.woodBedCombination) } as Partial<WoodBedCombinationDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodBedCombination(options.woodBedCombination)) !== JSON.stringify(normalizeWoodBedCombination(undefined)),
  inputLayout: 'products', OptionsEditor: BedCombinationEditor, visibleSellingPoints: () => [], layout: getWoodBedCombinationLayout, sellingPointIssue: () => null,
  changeAccessoryDimensions(options, id, fields, annotations) {
    if (id !== 'wood-bed-set-cabinet') return options;
    return { ...options, woodBedCombination: { ...normalizeWoodBedCombination(options.woodBedCombination), cabinetDimensions: { length: fields.length, height: fields.height, annotations } } };
  },
  accessories: woodBedCombinationAccessories, modelBadge: woodBedCombinationModel, dimensionLabel: woodBedCombinationDimensionLabel, drawExtras: drawWoodBedCombination, extraIssues: woodBedCombinationIssues,
  parseQuickDimensions: parseWoodBedCombinationDimensions, formatFields: formatDimensionFields,
  exportFileName: (model, options) => `${model}-板木床组合-${{ both: '床垫床头柜', mattress: '床垫', cabinet: '床头柜' }[normalizeWoodBedCombination(options.woodBedCombination).set]}-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodBedCombinationDimensions(formatDimensionFields(fields)) ? '请填写床体有效长×宽×高' : null, input.trim() && !parseWoodBedCombinationDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
