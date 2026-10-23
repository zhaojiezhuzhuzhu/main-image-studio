import { InputCard, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { formatWoodRoundTableSetFields, drawWoodRoundTableSetExtras, getWoodRoundTableSetLayout, normalizeWoodRoundTableSet, parseWoodRoundTableSetDimensions, woodRoundTableSetDimensionLabel, woodRoundTableSetIssues, woodRoundTableSetModel, WOOD_ROUND_TABLE_SET_FONT, WOOD_ROUND_TABLE_SET_SELLING_FONT, type WoodRoundTableSetDraft, type WoodRoundTableSetOptions } from '../domain/woodRoundTableSetLayout';
import { CanvasDiningChairEditor, type DiningChairEditing } from '../CanvasDiningChairEditor';
import type { CanvasOptionsEditorProps, OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';
import { woodRoundTableSetBadges } from '../domain/woodRoundTableSetLayout';

const chairEditing: DiningChairEditing = {
  fontFamily: WOOD_ROUND_TABLE_SET_FONT,
  read(context, value) {
    const chairs = normalizeWoodRoundTableSet(value.woodRoundTableSet);
    return { badges: woodRoundTableSetBadges(context, value).map((badge, index) => ({ ...badge, model: chairs.chairs[index].model })) };
  },
  change(value, index, change) {
    const chairs = normalizeWoodRoundTableSet(value.woodRoundTableSet);
    return { ...value, woodRoundTableSet: { ...chairs, chairs: chairs.chairs.map((chair, i) => i === index ? { ...chair, model: change.model ?? chair.model } : chair) } };
  },
};
function WoodRoundTableSetCanvasEditor(props: CanvasOptionsEditorProps) { return <CanvasDiningChairEditor {...props} editing={chairEditing}/>; }

function WoodRoundTableSetEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodRoundTableSet(value.woodRoundTableSet);
  const update = (change: Partial<WoodRoundTableSetOptions>) => onChange((current) => ({ ...current, woodRoundTableSet: { ...normalizeWoodRoundTableSet(current.woodRoundTableSet), ...change } }));
  const updateChair = (index: number, change: Partial<WoodRoundTableSetOptions['chairs'][number]>) => update({ chairs: options.chairs.map((chair, i) => i === index ? { ...chair, ...change } : chair) });
  return <>
    <InputCard title="组合设置"><label>搭配款数<select aria-label="搭配款数" value={options.chairCount} onChange={(event) => update({ chairCount: Number(event.target.value) as 1 | 2 | 3 | 4 })}><option value={1}>1款搭配</option><option value={2}>2款搭配</option><option value={3}>3款搭配</option><option value={4}>4款搭配</option></select></label><InputDetails title="填写提示"><p className="hint">上传圆餐桌与全部餐椅的完整组合PNG，尺寸只填直径×高。最多四款独立型号标签，位置按实际素材调整。</p></InputDetails></InputCard>
    {input.main(<><label>直径标注样式<select aria-label="直径标注样式" value={options.diameterPlacement} onChange={(event) => update({ diameterPlacement: event.target.value === 'outside' ? 'outside' : 'surface' })}><option value="surface">桌面内白字白线</option><option value="outside">桌面外黑字灰线</option></select></label><label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label><InputDetails title="产品排版"><label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label></InputDetails></>)}
    {options.chairs.slice(0, options.chairCount).map((chair, index) => <InputCard key={index} title={`搭配产品 ${index + 1}`} quickFields={<span className="input-card-status">使用组合整图</span>}><label>第{index + 1}款搭配型号<input aria-label={`第${index + 1}款搭配型号`} value={chair.model} placeholder="填写完整型号与规格" onChange={(event) => updateChair(index, { model: event.target.value })}/></label><InputDetails title="型号标签位置">{(['x', 'y'] as const).map((axis) => <label key={axis}>第{index + 1}款标签{axis === 'x' ? '横向' : '纵向'}位置（%）<input aria-label={`第${index + 1}款标签${axis === 'x' ? '横向' : '纵向'}位置（%）`} type="range" min={0} max={100} value={Math.round(chair[axis] * 100)} onChange={(event) => updateChair(index, { [axis]: Number(event.target.value) / 100 })}/><span>{Math.round(chair[axis] * 100)}%</span></label>)}</InputDetails></InputCard>)}
    <InputCard title="公共说明"><label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label><InputDetails title="填写提示"><p className="hint">标签可在安全范围内调整位置，尽量不遮挡商品；减少款数会保留隐藏的型号和位置。款数表示不同款式，不代表椅凳件数。</p>
<p className="hint">切换直径样式只改变颜色，请在画布上将尺寸线端点放到相应位置。</p>
<p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p></InputDetails></InputCard>
  </>;
}
export const woodRoundTableSetRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、32', points: [
    '上传桌椅完整组合PNG；默认桌面内白字白线标直径，高度用黑字灰线，不标长宽。',
    '餐桌主型号35pt准黑/Montserrat白字蓝底，单行框高50px，长型号自动分为两行、框高100px，圆角8；搭配标签使用35pt单行蓝标并保留完整规格。',
    '尺寸用cm、35pt，截断保留1位小数；白色直径标在桌面内，外置时可切黑字灰线并调整端点。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '餐桌蓝标位置固定，搭配标签按素材调整；组合标注可超绿框但不超过蓝框。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['diameter', 'height'], dimensionPrompt: '圆餐桌直径或高', sizePlaceholder: '直径×高（/ 并列规格）', inspectorTitle: '板木圆餐桌组合',
  model: { fontSize: 35, fontFamily: WOOD_ROUND_TABLE_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_ROUND_TABLE_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodRoundTableSet: normalizeWoodRoundTableSet(undefined) }),
  restoreOptions: (draft) => ({ ...woodRoundTableSetRules.createOptions(), woodRoundTableSet: normalizeWoodRoundTableSet((draft as WoodRoundTableSetDraft).woodRoundTableSet) }),
  saveOptions: (options) => ({ woodRoundTableSet: normalizeWoodRoundTableSet(options.woodRoundTableSet) } as Partial<WoodRoundTableSetDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodRoundTableSet(options.woodRoundTableSet)) !== JSON.stringify(normalizeWoodRoundTableSet(undefined)), inputLayout: 'products', OptionsEditor: WoodRoundTableSetEditor, CanvasOptionsEditor: WoodRoundTableSetCanvasEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWoodRoundTableSet(options.woodRoundTableSet).sellingPointCount), layout: getWoodRoundTableSetLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: woodRoundTableSetModel, dimensionLabel: woodRoundTableSetDimensionLabel, extraIssues: woodRoundTableSetIssues, drawExtras: drawWoodRoundTableSetExtras,
  parseQuickDimensions: parseWoodRoundTableSetDimensions, formatFields: formatWoodRoundTableSetFields, exportFileName: (model) => `${model}-板木圆餐桌组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodRoundTableSetDimensions(formatWoodRoundTableSetFields(fields)) ? '请填写有效直径×高；多规格高度须共用一个值或与直径逐项对应' : null, input.trim() && !parseWoodRoundTableSetDimensions(input) ? '快速尺寸无效，按直径×高填写；最多三种并列规格，高度须逐项对应或共用，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
