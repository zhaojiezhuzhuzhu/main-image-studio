import { standaloneInputSlots, InputCard, InputDetails } from '../WorkbenchInputCards';
import { formatDimensionFields } from '../domain/dimensions';
import { drawStandingDeskCombinationExtras, getStandingDeskCombinationLayout, normalizeStandingDeskCombinationOptions, parseStandingDeskCombinationDimensions, standingDeskCombinationAccessories, standingDeskCombinationDimensionIssue, standingDeskCombinationDimensionLabel, standingDeskCombinationExtraIssues, standingDeskCombinationModelBadge, standingDeskCombinationNote, STANDING_DESK_SET_DIMENSION_FONT, STANDING_DESK_SET_DIMENSION_KINDS, STANDING_DESK_SET_FONT, type StandingDeskCombinationDraft } from '../domain/standingDeskCombinationLayout';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';

function StandingDeskCombinationOptionsEditor({ value, onChange, input = standaloneInputSlots }: OptionsEditorProps<SingleTemplateOptions>) {
  const { headline, standingDeskSet } = normalizeStandingDeskCombinationOptions(value);
  function updateSet(update: Partial<typeof standingDeskSet>) {
    onChange((current) => ({ ...current, standingDeskSet: { ...normalizeStandingDeskCombinationOptions(current).standingDeskSet, ...update } }));
  }
  return <>
    <InputCard title="组合设置"><label>套装选择<select value={standingDeskSet.count} onChange={(event) => updateSet({ count: Number(event.target.value) as 2 | 3 })}><option value={2}>两件套：升降桌＋增高架</option><option value={3}>三件套：升降桌＋增高架＋电脑椅</option></select></label><label>组合标题<input value={headline} placeholder="按实际产品资料填写标题" onChange={(event) => onChange((current) => ({ ...current, headline: event.target.value }))}/></label><InputDetails title="填写提示"><p className="hint">标题保持80号字，型号保持35号字；文字超出画布区域时会提示核对。</p>
<p className="hint">分别上传升降桌与各件配件的透明PNG，只填写升降桌的长、宽和升降高度。切换两件套会保留电脑椅资料。</p></InputDetails></InputCard>
    {input.main()}
    {input.accessory('riser', <><label>增高架型号<input value={standingDeskSet.riserModel} placeholder="填写完整型号和规格" onChange={(event) => updateSet({ riserModel: event.target.value })}/></label>{standingDeskSet.count === 3 && <label>增高架补充说明（可留空）<input value={standingDeskSet.riserNote} placeholder="按实际搭配填写，保持单行" onChange={(event) => updateSet({ riserNote: event.target.value })}/></label>}</>)}
    {standingDeskSet.count === 3 && input.accessory('chair', <label>电脑椅型号<input value={standingDeskSet.chairModel} placeholder="填写完整型号和产品名称" onChange={(event) => updateSet({ chairModel: event.target.value })}/></label>)}
  </>;
}

export const standingDeskCombinationRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、44–45', points: [
    '两件套为升降桌＋增高架，三件套另配电脑椅；每件单独上传透明PNG、填写完整型号，不依据图片推测参数。',
    '顶部270px预留价格区域；标题80pt粗黑，型号35pt准黑白字蓝底、圆角8。',
    '仅标升降桌长、宽和升降高度，35pt中黑、行距40；单位cm，支持 / 并列及 ~ 范围，截断保留1位小数。',
    '底部三个卖点为50pt中黑蓝字蓝框，框高98px、横向间隔30px；图文间隔两件套100px、三件套60px。',
    '底部40pt准黑搭配说明随套装切换；三件套可为增高架补充20pt说明，无资料时留空。',
  ] },
  filenameName: { includeSpecification: true },
  requiredFonts: ['Montserrat', 'Montserrat Semi Bold', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK', '方正兰亭粗黑_GBK'],
  precision: 'truncate', allowCompound: true, dimensionKinds: STANDING_DESK_SET_DIMENSION_KINDS,
  dimensionPrompt: '升降桌长、宽或升降高度', sizePlaceholder: '升降桌长×宽×高（支持 / 并列、~ 升降范围）', inspectorTitle: '电动升降桌组合',
  model: { fontSize: 35, fontFamily: STANDING_DESK_SET_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 20, textY: 26, baseline: 'middle' },
  sellingPoints: { fontSize: 50, fontFamily: STANDING_DESK_SET_DIMENSION_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '三个真实卖点；框高98px和横向30px间距固定。', dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: standingDeskCombinationNote, accessories: standingDeskCombinationAccessories, drawExtras: drawStandingDeskCombinationExtras, extraIssues: standingDeskCombinationExtraIssues,
  exportFileName: (model, options) => `${model}-电动升降桌组合-${normalizeStandingDeskCombinationOptions(options).standingDeskSet.count === 3 ? '三件套' : '两件套'}-SKU.jpg`,
  createOptions: () => normalizeStandingDeskCombinationOptions(undefined),
  restoreOptions: (draft) => normalizeStandingDeskCombinationOptions((draft as StandingDeskCombinationDraft).standingDeskCombination),
  saveOptions(options) { const { headline, standingDeskSet } = normalizeStandingDeskCombinationOptions(options); return { standingDeskCombination: { headline, standingDeskSet } } as Partial<StandingDeskCombinationDraft>; },
  hasOptions(options) { const { headline, standingDeskSet } = normalizeStandingDeskCombinationOptions(options); return Boolean(headline || standingDeskSet.count !== 2 || standingDeskSet.riserModel || standingDeskSet.chairModel || standingDeskSet.riserNote); },
  inputLayout: 'products', OptionsEditor: StandingDeskCombinationOptionsEditor,
  visibleSellingPoints: (points) => points.slice(0, 3), layout: getStandingDeskCombinationLayout,
  sellingPointIssue: (_widths, layout) => layout.issue ?? null, modelBadge: standingDeskCombinationModelBadge,
  dimensionLabel: standingDeskCombinationDimensionLabel, parseQuickDimensions: parseStandingDeskCombinationDimensions, formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, standingDeskCombinationDimensionIssue(fields), sizeInput.trim() && !parseStandingDeskCombinationDimensions(sizeInput) ? '快速尺寸无效，请填写升降桌长×宽×高，支持 / 并列规格和 ~ 升降范围' : null].filter((issue): issue is string => Boolean(issue)),
};
