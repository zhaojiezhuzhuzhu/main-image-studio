import { formatDimensionFields } from '../domain/dimensions';
import { drawStandingDeskHeadline, getStandingDeskSingleLayout, normalizeStandingDeskOptions, parseStandingDeskDimensions, STANDING_DESK_DIMENSION_KINDS, STANDING_DESK_MODEL_FONT, STANDING_DESK_TEXT_FONT, standingDeskDimensionIssue, standingDeskDimensionLabel, standingDeskHeadlineIssue, standingDeskModelBadge, type StandingDeskDraft } from '../domain/standingDeskSingleLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function StandingDeskOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const options = normalizeStandingDeskOptions(value);
  const issue = options.headline ? standingDeskHeadlineIssue(options.headline) : null;
  return <section className="quick-section"><h3>电动升降桌单品设置</h3>
    <label>主标题<input value={options.headline} placeholder="按当前产品资料填写款式与特征" aria-invalid={Boolean(issue)} aria-describedby="standing-desk-headline-hint" onChange={(event) => onChange((current) => ({ ...current, headline: event.target.value }))}/></label>
    <p className="hint" id="standing-desk-headline-hint" role={issue ? 'alert' : undefined}>{issue ?? '主标题固定80号字；请按实际资料填写，过长时需调整文案。'}</p>
    <p className="hint">长、宽、高使用 cm，并列规格用 /，升降高度范围用 ~；截断保留一位小数，范围上下限完整显示。</p>
    <label>卖点数量<select value={options.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
  </section>;
}

// P43独立规则；标题和产品资料默认空白，不把规范样例当成所有产品的事实。
export const standingDeskSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、43', points: [
    '顶部保留270px价格公式区，标题与上下内容各留30px；不在本图填价格公式。',
    '主标题80号黑字；完整型号与规格45号白字、蓝底圆角8。材质及功能按实际资料填写。',
    '尺寸用cm，截断保留1位小数；并列规格用 /，升降范围用 ~，不得省略上下限。',
    '尺寸45号中黑，行距40；尺寸线与箭头统一为 #545454。',
    '卖点50号中黑、蓝框圆角8；框高固定，可调整框宽，底部保留130px。',
  ] },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭粗黑_GBK', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: STANDING_DESK_DIMENSION_KINDS,
  dimensionPrompt: '电动升降桌长、宽或高', sizePlaceholder: '长×宽×高（支持 / 并列、~ 升降范围）', inspectorTitle: '电动升降桌单品',
  model: { fontSize: 45, fontFamily: STANDING_DESK_MODEL_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 24, textY: 36, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: STANDING_DESK_TEXT_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '卖点框高98px、横向间距30px固定；依据实际产品资料填写卖点。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => normalizeStandingDeskOptions(undefined),
  restoreOptions: (draft) => normalizeStandingDeskOptions((draft as StandingDeskDraft).standingDesk),
  saveOptions(options) {
    const { headline, sellingPointCount } = normalizeStandingDeskOptions(options);
    return { standingDesk: { headline, sellingPointCount } } as Partial<StandingDeskDraft>;
  },
  hasOptions: (options) => Boolean(normalizeStandingDeskOptions(options).headline || options.sellingPointCount !== 3),
  OptionsEditor: StandingDeskOptionsEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: getStandingDeskSingleLayout,
  sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: standingDeskModelBadge, dimensionLabel: standingDeskDimensionLabel,
  parseQuickDimensions: parseStandingDeskDimensions, formatFields: formatDimensionFields,
  drawExtras: drawStandingDeskHeadline,
  extraIssues: (context, options, _layout, fields) => [standingDeskHeadlineIssue(normalizeStandingDeskOptions(options).headline, context), fields ? standingDeskDimensionIssue(fields, context) : null].filter((issue): issue is string => Boolean(issue)),
  exportIssues: (fields, sizeInput, options, modelIssue) => [modelIssue, standingDeskHeadlineIssue(normalizeStandingDeskOptions(options).headline), standingDeskDimensionIssue(fields), sizeInput.trim() && !parseStandingDeskDimensions(sizeInput) ? '快速尺寸无效，请按长×宽×高填写，并列规格用 /、升降范围用 ~ 分隔' : null].filter((issue): issue is string => Boolean(issue)),
};
