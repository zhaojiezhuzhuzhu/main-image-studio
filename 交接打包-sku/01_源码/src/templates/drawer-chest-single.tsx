import { formatDimensionFields } from '../domain/dimensions';
import { drawDrawerChestNote, getDrawerChestLayout, normalizeDrawerChest, parseDrawerChestDimensions, drawerChestDimensionLabel, drawerChestIssues, drawerChestModel, DRAWER_CHEST_FONT, DRAWER_CHEST_SELLING_FONT, type DrawerChestDraft, type DrawerChestOptions } from '../domain/drawerChestSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function DrawerChestEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeDrawerChest(value.drawerChest);
  const update = (change: Partial<DrawerChestOptions>) => onChange((current) => ({ ...current, drawerChest: { ...normalizeDrawerChest(current.drawerChest), ...change } }));
  return <section className="quick-section"><h3>板木斗柜单品设置</h3>
    <p className="hint">上传单件斗柜透明PNG，填写完整型号及规格。尺寸按真实资料填写，宽度是否包含拉手需核对。</p>
    <label>宽度补充说明（可留空）<input aria-label="宽度补充说明" value={options.widthNote} placeholder="如：含拉手（按实际填写）" onChange={(event) => update({ widthNote: event.target.value })}/></label>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="多尺寸省略型号尺寸时注明图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const drawerChestSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、29', points: [
    '本模板用于单件斗柜，填写完整型号和规格；组合使用另一套版式。',
    '型号45pt准黑/Montserrat白字蓝底，框高70px、圆角8，不能省略规格。',
    '只标总长、总宽、总高，45pt黑字，线和箭头#545454；cm截断保留1位小数。',
    '宽度按实际情况注明是否含拉手，说明与数值同一行，不能套用案例数值。',
    '卖点通常三个、特殊情况两个；50pt中黑，框高98px、间隔30px，产品与卖点建议60px。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；型号与卖点位置固定。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '斗柜长、宽或高', sizePlaceholder: '长×宽×高（/ 并列规格）', inspectorTitle: '板木斗柜单品',
  model: { fontSize: 45, fontFamily: DRAWER_CHEST_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 35, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: DRAWER_CHEST_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, drawerChest: normalizeDrawerChest(undefined) }),
  restoreOptions: (draft) => ({ ...drawerChestSingleRules.createOptions(), drawerChest: normalizeDrawerChest((draft as DrawerChestDraft).drawerChest) }),
  saveOptions: (options) => ({ drawerChest: normalizeDrawerChest(options.drawerChest) } as Partial<DrawerChestDraft>),
  hasOptions: (options) => JSON.stringify(normalizeDrawerChest(options.drawerChest)) !== JSON.stringify(normalizeDrawerChest(undefined)), OptionsEditor: DrawerChestEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeDrawerChest(options.drawerChest).sellingPointCount), layout: getDrawerChestLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: drawerChestModel, dimensionLabel: drawerChestDimensionLabel, extraIssues: drawerChestIssues, drawExtras: drawDrawerChestNote,
  parseQuickDimensions: parseDrawerChestDimensions, formatFields: formatDimensionFields, exportFileName: (model) => `${model}-板木斗柜单品-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseDrawerChestDimensions(formatDimensionFields(fields)) ? '请填写斗柜有效长×宽×高' : null, input.trim() && !parseDrawerChestDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
