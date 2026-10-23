import { InputCard, InputDetails, standaloneInputSlots } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { drawWoodLongTableSetExtras, getWoodLongTableSetLayout, normalizeWoodLongTableSet, parseWoodLongTableSetDimensions, woodLongTableSetDimensionLabel, woodLongTableSetIssues, woodLongTableSetModel, WOOD_LONG_TABLE_SET_FONT, WOOD_LONG_TABLE_SET_SELLING_FONT, type WoodLongTableSetDraft, type WoodLongTableSetOptions } from '../domain/woodLongTableSetLayout';
import { CanvasDiningChairEditor, type DiningChairEditing } from '../CanvasDiningChairEditor';
import type { CanvasOptionsEditorProps, OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';
import { woodLongTableSetBadges } from '../domain/woodLongTableSetLayout';

const chairEditing: DiningChairEditing = {
  fontFamily: WOOD_LONG_TABLE_SET_FONT,
  read(context, value) {
    const chairs = normalizeWoodLongTableSet(value.woodLongTableSet);
    return { badges: woodLongTableSetBadges(context, value).map((badge, index) => ({ ...badge, model: chairs.chairs[index].model })), markers: chairs.chairCount === 2 ? chairs.markers : undefined };
  },
  change(value, index, change) {
    const chairs = normalizeWoodLongTableSet(value.woodLongTableSet);
    return { ...value, woodLongTableSet: { ...chairs, chairs: chairs.chairs.map((chair, i) => i === index ? { ...chair, model: change.model ?? chair.model } : chair), markers: chairs.markers.map((marker, i) => i === index && change.marker ? change.marker : marker) } };
  },
};
function WoodLongTableSetCanvasEditor(props: CanvasOptionsEditorProps) { return <CanvasDiningChairEditor {...props} editing={chairEditing}/>; }

function WoodLongTableSetEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeWoodLongTableSet(value.woodLongTableSet);
  const update = (change: Partial<WoodLongTableSetOptions>) => onChange((current) => ({ ...current, woodLongTableSet: { ...normalizeWoodLongTableSet(current.woodLongTableSet), ...change } }));
  const updateChair = (index: number, change: Partial<WoodLongTableSetOptions['chairs'][number]>) => update({ chairs: options.chairs.map((chair, i) => i === index ? { ...chair, ...change } : chair) });
  return <>
    <InputCard title="组合设置"><label>搭配款数<select aria-label="搭配款数" value={options.chairCount} onChange={(event) => update({ chairCount: Number(event.target.value) as 1 | 2 })}><option value={1}>1款搭配</option><option value={2}>2款搭配</option></select></label><InputDetails title="填写提示"><p className="hint">上传餐桌与全部餐椅/长凳的完整组合PNG，长宽高只标餐桌。两款搭配用编号对应型号，编号不是件数。</p></InputDetails></InputCard>
    {input.main(<><label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label><InputDetails title="产品排版"><label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label></InputDetails></>)}
    {options.chairs.slice(0, options.chairCount).map((chair, index) => <InputCard key={index} title={`搭配产品 ${index + 1}`} quickFields={<span className="input-card-status">使用组合整图</span>}><label>第{index + 1}款搭配型号<input aria-label={`第${index + 1}款搭配型号`} value={chair.model} placeholder="填写完整型号与规格" onChange={(event) => updateChair(index, { model: event.target.value })}/></label><InputDetails title="型号标签位置">{(['x', 'y'] as const).map((axis) => <label key={axis}>第{index + 1}款标签{axis === 'x' ? '横向' : '纵向'}位置（%）<input aria-label={`第${index + 1}款标签${axis === 'x' ? '横向' : '纵向'}位置（%）`} type="range" min={0} max={100} value={Math.round(chair[axis] * 100)} onChange={(event) => updateChair(index, { [axis]: Number(event.target.value) / 100 })}/><span>{Math.round(chair[axis] * 100)}%</span></label>)}</InputDetails></InputCard>)}
    <InputCard title="公共说明"><label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="按真实产品填写图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label><InputDetails title="填写提示"><p className="hint">标签可在安全范围内调整位置，尽量不遮挡商品；减少款数会保留隐藏的型号和位置。款数表示不同款式，不代表椅凳件数。</p>
<p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p></InputDetails></InputCard>
  </>;
}
export const woodLongTableSetRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、31', points: [
    '上传桌椅/长凳完整组合PNG，长宽高只标桌体；多种长度显示“尺寸可选”，两款搭配加对应编号。',
    '餐桌主型号35pt准黑/Montserrat白字蓝底，单行框高50px，长型号自动分为两行、框高100px，圆角8；搭配标签使用35pt单行蓝标并保留完整规格。',
    '长宽高用cm，35pt黑字，线和箭头#545454；数值截断保留1位小数。',
    '通常三个卖点，特殊情况两个；50pt中黑，框高98px、框间隔30px，长文案调整框宽。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；按实际资料填写。',
    '餐桌蓝标位置固定，搭配标签按素材调整；组合标注可超绿框但不超过蓝框。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '长餐桌长、宽或高', sizePlaceholder: '长×宽×高（/ 并列规格）', inspectorTitle: '板木长餐桌组合',
  model: { fontSize: 35, fontFamily: WOOD_LONG_TABLE_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: WOOD_LONG_TABLE_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, woodLongTableSet: normalizeWoodLongTableSet(undefined) }),
  restoreOptions: (draft) => ({ ...woodLongTableSetRules.createOptions(), woodLongTableSet: normalizeWoodLongTableSet((draft as WoodLongTableSetDraft).woodLongTableSet) }),
  saveOptions: (options) => ({ woodLongTableSet: normalizeWoodLongTableSet(options.woodLongTableSet) } as Partial<WoodLongTableSetDraft>),
  hasOptions: (options) => JSON.stringify(normalizeWoodLongTableSet(options.woodLongTableSet)) !== JSON.stringify(normalizeWoodLongTableSet(undefined)), inputLayout: 'products', OptionsEditor: WoodLongTableSetEditor, CanvasOptionsEditor: WoodLongTableSetCanvasEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeWoodLongTableSet(options.woodLongTableSet).sellingPointCount), layout: getWoodLongTableSetLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: woodLongTableSetModel, dimensionLabel: woodLongTableSetDimensionLabel, extraIssues: woodLongTableSetIssues, drawExtras: drawWoodLongTableSetExtras,
  parseQuickDimensions: parseWoodLongTableSetDimensions, formatFields: formatDimensionFields, exportFileName: (model) => `${model}-板木长餐桌组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseWoodLongTableSetDimensions(formatDimensionFields(fields)) ? '请填写长餐桌有效长×宽×高' : null, input.trim() && !parseWoodLongTableSetDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
