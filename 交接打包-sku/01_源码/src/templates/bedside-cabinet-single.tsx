import { formatDimensionFields, normalizeDimension, parseDimensionText } from '../domain/dimensions';
import { BEDSIDE_CABINET_FONT, BEDSIDE_CABINET_SELLING_FONT, bedsideCabinetDimensionIssue, bedsideCabinetModelBadge, drawBedsideCabinetQuantity, getBedsideCabinetSingleLayout, normalizeBedsideCabinetOptions, parseBedsideCabinetDimensions, type BedsideCabinetDraft } from '../domain/bedsideCabinetSingleLayout';
import { canvasFontFromPs } from '../domain/typography';
import { measurePlainDimension } from './drawing';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function BedsideCabinetOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  return <section className="quick-section"><h3>床头柜设置</h3>
    <label>输出数量<select value={value.quantity ?? 1} onChange={(event) => onChange((current) => ({ ...current, quantity: Number(event.target.value) as 1 | 2 }))}><option value={1}>单件床头柜</option><option value={2}>双件床头柜（x2）</option></select></label>
    <p className="hint">单件与双件各导出一版。双件在产品旁显示 x2 圆标，数量切换保留型号和尺寸。</p>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
    <p className="hint">带灯款请上传已展示灯光效果的产品图，并填写真实产品卖点。</p>
  </section>;
}

// 第9页软体床头柜规则独立声明，不继承床或其他柜类模板。
export const bedsideCabinetSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–4、9',
    points: [
      '单件床头柜与双件床头柜各输出一版；双件使用产品旁独立 x2 圆标，单件不显示。',
      '型号与规格蓝标居中，字号 45pt；x2 字号 60pt、白字蓝底、圆角值 100。',
      '尺寸用 cm，换算不四舍五入、保留 1 位小数，长宽高用 45pt 标清。',
      '卖点通常 3 个，特殊情况可 2 个；中文中黑、50pt、蓝字蓝框。',
      '带灯款必须使用已展示灯光效果的产品图；线和箭头统一 #545454。',
    ],
  },
  filenameName: { includeSpecification: true, suffix: '床头柜' },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: false,
  dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '长、宽或高', sizePlaceholder: '长×宽×高', inspectorTitle: '软体床头柜',
  model: { fontSize: 45, fontFamily: BEDSIDE_CABINET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: BEDSIDE_CABINET_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => normalizeBedsideCabinetOptions(undefined),
  restoreOptions: (draft) => normalizeBedsideCabinetOptions((draft as BedsideCabinetDraft).bedsideCabinet),
  saveOptions(options) {
    const { quantity, sellingPointCount } = normalizeBedsideCabinetOptions(options);
    return { bedsideCabinet: { quantity, sellingPointCount } } as Partial<BedsideCabinetDraft>;
  },
  hasOptions: (options) => options.quantity === 2 || options.sellingPointCount !== 3,
  OptionsEditor: BedsideCabinetOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: (widths) => getBedsideCabinetSingleLayout(widths),
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: bedsideCabinetModelBadge,
  dimensionLabel(context, annotation, fields) {
    const value = parseDimensionText(fields[annotation.kind] ?? String(annotation.value), 'truncate')?.text ?? String(normalizeDimension(annotation.value, 'truncate'));
    return measurePlainDimension(context, `${value}cm`, canvasFontFromPs(45, BEDSIDE_CABINET_FONT), 45);
  },
  drawExtras: drawBedsideCabinetQuantity,
  exportFileName: (model, options) => `${model}-${options.quantity === 2 ? '双件x2' : '单件'}-SKU.jpg`,
  parseQuickDimensions: parseBedsideCabinetDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, bedsideCabinetDimensionIssue(fields), sizeInput.trim() && !parseBedsideCabinetDimensions(sizeInput) ? '快速尺寸无效，请按床头柜长×宽×高填写' : null].filter((issue): issue is string => Boolean(issue)),
};
