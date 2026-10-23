import { formatDimensionFields } from '../domain/dimensions';
import { defaultFunctionalSofaFeature, FUNCTIONAL_SOFA_DIMENSION_KINDS, FUNCTIONAL_SOFA_MODEL_FONT, FUNCTIONAL_SOFA_SELLING_FONT, functionalSofaDimensionIssue, functionalSofaDimensionLabel, functionalSofaFeatureIssues, functionalSofaModelBadge, getFunctionalSofaSingleLayout, normalizeFunctionalSofaOptions, parseFunctionalSofaDimensions, type FunctionalSofaDraft, type FunctionalSofaFeatureKind } from '../domain/functionalSofaSingleLayout';
import { drawFunctionalSofaFeatures } from './functional-sofa-feature';
import type { OptionsEditorProps, SingleTemplateOptions, SingleTemplateRules } from './types';
import { adjustFunctionalCurve, defaultFunctionalCurve, type FunctionalSofaFeature } from '../domain/functionalSofaCurve';
import { FunctionalSofaCanvasEditor } from './functional-sofa-canvas-editor';
import { InputDetails, InputToggle } from '../WorkbenchInputCards';

function FunctionalSofaOptionsEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const normalized = normalizeFunctionalSofaOptions(value);
  const updateFeature = (kind: FunctionalSofaFeatureKind, changes: Partial<FunctionalSofaFeature>) => onChange((current) => ({ ...current, [kind]: { ...normalizeFunctionalSofaOptions(current)[kind], ...changes } }));
  return <section className="quick-section"><h3>功能单人沙发设置</h3>
    <p className="hint">尺寸范围用 ~ 分隔，截断保留一位小数。按当前产品资料开启功能并填写说明，角度不从图片推测。</p>
    <label>卖点数量<select value={value.sellingPointCount} onChange={(event) => onChange((current) => ({ ...current, sellingPointCount: Number(event.target.value) as 2 | 3 }))}><option value={3}>三个卖点</option><option value={2}>两个卖点（特殊情况）</option></select></label>
    {(['rocking', 'rotation'] as const).map((kind) => {
      const name = kind === 'rocking' ? '摇动' : '旋转';
      const feature = normalized[kind], issues = functionalSofaFeatureIssues(kind, feature);
      const hintId = `functional-sofa-${kind}-hint`;
      return <section className="quick-section" key={kind} aria-label={`${name}功能设置`}>
        <InputToggle title={`${name}功能标注`} checked={feature.enabled} onChange={(enabled) => updateFeature(kind, { enabled })}>
          <label>{name}功能说明<input value={feature.text} placeholder="按实际产品资料填写" aria-invalid={Boolean(issues.length)} aria-describedby={hintId} onChange={(event) => updateFeature(kind, { text: event.target.value })}/></label>
          <InputDetails title="位置微调"><div className="quick-product-row"><label>{name}横坐标（px）<input type="number" step={1} value={feature.x} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) updateFeature(kind, { x: event.target.valueAsNumber }); }}/></label><label>{name}纵坐标（px）<input type="number" step={1} value={feature.y} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) updateFeature(kind, { y: event.target.valueAsNumber }); }}/></label></div>
          <button type="button" className="quick-secondary" onClick={() => { const position = defaultFunctionalSofaFeature(kind); updateFeature(kind, { x: position.x, y: position.y }); }}>复位{name}标注位置</button>
          <details className="functional-curve-controls"><summary>{name}曲线精确调整</summary>
            <p className="hint">{kind === 'rocking' ? '规则圆弧' : '规则椭圆弧'}：圆点调端点，菱形自动居中并沿中线调弧度；以下为1440px画布坐标，弧度点坐标会自动约束到中线。</p>
            {(['from', 'to', 'bend'] as const).map((part) => {
              const curve = feature.curve ?? defaultFunctionalCurve(kind), label = part === 'from' ? '起点' : part === 'to' ? '终点' : '弧度点';
              return <div className="quick-product-row" key={part}>{(['x', 'y'] as const).map((axis) => <label key={axis}>{name}{label}{axis === 'x' ? '横' : '纵'}坐标<input type="number" step={1} value={Math.round((feature[axis] + curve[part][axis]) * 100) / 100}
                onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) updateFeature(kind, { curve: adjustFunctionalCurve(curve, part, { ...curve[part], [axis]: event.target.valueAsNumber - feature[axis] }) }); }}/></label>)}</div>;
            })}
            <button type="button" className="quick-secondary" onClick={() => updateFeature(kind, { curve: undefined })}>恢复{name}默认形状</button>
          </details>
          </InputDetails>
          <p className="hint" id={hintId} role={issues.length ? 'alert' : undefined}>{issues.join('；') || '坐标以1440px画布为准，可用方向键微调数值。请避让产品尺寸文字。'}</p>
        </InputToggle>
      </section>;
    })}
  </section>;
}

// 第18页功能单人示例，独立采用第2、3、15、16页的沙发规则。
export const functionalSofaSingleRules: SingleTemplateRules = {
  productionNotes: { sourcePages: '2–3、15–16、18', points: [
    '尺寸用 cm，截断保留 1 位小数；收起与展开范围须按实际产品资料完整填写。',
    '一个颜色一张 SKU，主推规格使用侧面图并保留投影；蓝标只写型号。',
    '型号位置和高度固定，产品、尺寸及功能标注均不得进入禁区。',
    '摇动使用上方曲线箭头，旋转使用底部弧形箭头；按实际功能开启并填写说明。',
    '卖点通常 3 个，特殊情况可 2 个；建议每条不超过 7 字，位置与框高固定。',
  ] },
  filenameName: { includeSpecification: false }, requiredFonts: ['Montserrat', '方正兰亭准黑_GBK', '方正兰亭中黑_GBK'],
  precision: 'truncate', allowCompound: true,
  dimensionKinds: FUNCTIONAL_SOFA_DIMENSION_KINDS, dimensionPrompt: '长、宽或高（支持范围）', sizePlaceholder: '长×宽×高（支持 ~ 范围）', inspectorTitle: '功能单人沙发',
  model: { fontSize: 60, fontFamily: FUNCTIONAL_SOFA_MODEL_FONT, color: '#ffffff', background: '#00586d', radius: 8, paddingX: 28, textY: 62, baseline: 'alphabetic' },
  sellingPoints: { fontSize: 50, fontFamily: FUNCTIONAL_SOFA_SELLING_FONT, color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 40 },
  sellingPointHint: '每条建议不超过7字；长文案需缩短其余卖点，卖点框高度和位置固定。',
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => normalizeFunctionalSofaOptions(undefined),
  restoreOptions: (draft) => normalizeFunctionalSofaOptions((draft as FunctionalSofaDraft).functionalSofa),
  saveOptions(options) {
    const { sellingPointCount, rocking, rotation } = normalizeFunctionalSofaOptions(options);
    return { functionalSofa: { sellingPointCount, rocking, rotation } } as Partial<FunctionalSofaDraft>;
  },
  hasOptions(options) {
    const saved = normalizeFunctionalSofaOptions(options);
    return saved.sellingPointCount !== 3 || (['rocking', 'rotation'] as const).some((kind) => {
      const feature = saved[kind], defaults = defaultFunctionalSofaFeature(kind);
      return feature.enabled || Boolean(feature.text) || feature.x !== defaults.x || feature.y !== defaults.y || Boolean(feature.curve);
    });
  },
  OptionsEditor: FunctionalSofaOptionsEditor,
  CanvasOptionsEditor: FunctionalSofaCanvasEditor,
  visibleSellingPoints: (points, options) => points.slice(0, options.sellingPointCount),
  layout: getFunctionalSofaSingleLayout, sellingPointIssue: (_widths, layout) => layout.issue ?? null,
  modelBadge: functionalSofaModelBadge, dimensionLabel: functionalSofaDimensionLabel,
  parseQuickDimensions: parseFunctionalSofaDimensions, formatFields: formatDimensionFields,
  drawExtras: drawFunctionalSofaFeatures,
  exportIssues(fields, sizeInput, options, modelIssue) {
    const { rocking, rotation } = normalizeFunctionalSofaOptions(options);
    return [modelIssue, functionalSofaDimensionIssue(fields), ...functionalSofaFeatureIssues('rocking', rocking), ...functionalSofaFeatureIssues('rotation', rotation),
      sizeInput.trim() && !parseFunctionalSofaDimensions(sizeInput) ? '快速尺寸无效，请按长×宽×高填写，范围用 ~ 分隔' : null].filter((issue): issue is string => Boolean(issue));
  },
};
