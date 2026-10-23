import { formatDrawerChestSetFields, drawDrawerChestSetNote, getDrawerChestSetLayout, normalizeDrawerChestSet, parseDrawerChestSetDimensions, drawerChestSetDimensionLabel, drawerChestSetIssues, drawerChestSetModel, DRAWER_CHEST_SET_FONT, DRAWER_CHEST_SET_SELLING_FONT, type DrawerChestSetDraft, type DrawerChestSetOptions } from '../domain/drawerChestSetLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function DrawerChestSetEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeDrawerChestSet(value.drawerChestSet);
  const update = (change: Partial<DrawerChestSetOptions>) => onChange((current) => ({ ...current, drawerChestSet: { ...normalizeDrawerChestSet(current.drawerChestSet), ...change } }));
  return <section className="quick-section"><h3>板木斗柜组合设置</h3>
    <p className="hint">上传高低斗柜整组PNG；完整型号写明组合。标总长、深度、主柜高及副柜高；宽度是否含拉手须按实际产品填写说明。</p>
    <label>宽度补充说明（可留空）<input aria-label="宽度补充说明" value={options.widthNote} placeholder="如：含拉手（按实际填写）" onChange={(event) => update({ widthNote: event.target.value })}/></label>
    <label>图示备注（可留空）<input aria-label="图示备注" value={options.noteText} placeholder="多尺寸省略型号尺寸时注明图示规格" onChange={(event) => update({ noteText: event.target.value })}/></label>
    <label>卖点数量<select aria-label="卖点数量" value={options.sellingPointCount} onChange={(event) => update({ sellingPointCount: event.target.value === '2' ? 2 : 3 })}><option value={3}>三个卖点</option><option value={2}>两个卖点</option></select></label>
    <label>产品与卖点间距（px）<input aria-label="产品与卖点间距（px）" type="number" min={30} max={120} value={options.dimensionGap} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ dimensionGap: Math.max(30, Math.min(120, event.target.valueAsNumber)) }); }}/></label>
    <p className="hint">建议60px；图片及尺寸共同避让卖点。切换卖点数量会保留第三条文案。</p>
  </section>;
}
export const drawerChestSetRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、21、29', points: [
    '上传高低斗柜整组PNG；完整型号写明组合。标总长、深度、主柜高及副柜高；宽度是否含拉手须按实际产品填写说明。',
    '型号35pt准黑/Montserrat白字蓝底，短型号框高50px，长型号分两行、框高100px、圆角8，不能省略规格。',
    '只标总长、总宽、总高，35pt黑字，线和箭头#545454；cm截断保留1位小数。',
    '宽度按实际情况注明是否含拉手，说明与数值同一行，不能套用案例数值。',
    '卖点通常三个、特殊情况两个；50pt中黑，框高98px、间隔30px，产品与卖点建议60px。',
    '多尺寸省略型号中的尺寸时，底部38pt灰字注明图示规格；型号与卖点位置固定。',
  ] }, filenameName: { includeSpecification: true }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: ['length', 'width', 'height', 'secondaryHeight'], dimensionPrompt: '主柜和副柜尺寸', sizePlaceholder: '总长×深度×主柜高×副柜高', inspectorTitle: '板木板木斗柜组合',
  model: { fontSize: 35, fontFamily: DRAWER_CHEST_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 25, baseline: 'middle', multiline: true },
  sellingPoints: { fontSize: 50, fontFamily: DRAWER_CHEST_SET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000', lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 60, drawerChestSet: normalizeDrawerChestSet(undefined) }),
  restoreOptions: (draft) => ({ ...drawerChestSetRules.createOptions(), drawerChestSet: normalizeDrawerChestSet((draft as DrawerChestSetDraft).drawerChestSet) }),
  saveOptions: (options) => ({ drawerChestSet: normalizeDrawerChestSet(options.drawerChestSet) } as Partial<DrawerChestSetDraft>),
  hasOptions: (options) => JSON.stringify(normalizeDrawerChestSet(options.drawerChestSet)) !== JSON.stringify(normalizeDrawerChestSet(undefined)), OptionsEditor: DrawerChestSetEditor,
  visibleSellingPoints: (points, options) => points.slice(0, normalizeDrawerChestSet(options.drawerChestSet).sellingPointCount), layout: getDrawerChestSetLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: drawerChestSetModel, dimensionLabel: drawerChestSetDimensionLabel, extraIssues: drawerChestSetIssues, drawExtras: drawDrawerChestSetNote,
  parseQuickDimensions: parseDrawerChestSetDimensions, formatFields: formatDrawerChestSetFields, exportFileName: (model) => `${model}-板木斗柜组合-SKU.jpg`,
  exportIssues: (fields, input, _options, issue) => [issue, !parseDrawerChestSetDimensions(formatDrawerChestSetFields(fields)) ? '请填写斗柜有效总长×深度×主柜高×副柜高' : null, input.trim() && !parseDrawerChestSetDimensions(input) ? '快速尺寸无效，最多三种 / 并列规格，不使用范围' : null].filter((value): value is string => Boolean(value)),
};
