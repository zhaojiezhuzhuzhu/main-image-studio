import { dimensionFieldsFromDimensions, formatDimensionFields, parseDimensions } from '../domain/dimensions';
import { getSofaSingleLayout } from '../domain/sofaSingleLayout';
import { sellingPointCapacityIssue } from '../domain/sellingPointCapacity';
import { canvasFontFromPs } from '../domain/typography';
import { measurePlainDimension } from './drawing';
import { drawSofaFirmness, hasSofaFirmness, normalizeSofaFirmness, sofaFirmnessIssues, type SofaFirmnessDraft } from '../domain/sofaFirmness';
import { SofaFirmnessEditor } from './sofa-firmness-editor';
import type { SingleTemplateRules } from './types';

// 沙发单品专属规则；不继承其他模板的数值或默认状态。
export const sofaSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、15–16',
    points: [
      '尺寸用 cm；规范要求截断到 1 位小数，当前沙发模板沿用四舍五入显示。',
      '一个颜色一张 SKU；脚踏、贵妃位等特殊规格单独制作。',
      '选主推规格侧面图，保留投影；蓝标只写型号，不写规格。',
      '型号标位置、高度固定；产品与标注不得进入规范红色禁区。',
      '卖点通常 3 个，特殊情况可 2 个；每条建议不超过 7 字，较长时缩短其余卖点。',
      '卖点位置和框高固定；长文案可调框宽或字间距。',
      '坐感标识可选开启；数值、说明和指示位置按实际资料填写，位置不按分数自动换算（另据BS672分层样例）。',
    ],
  },
  filenameName: { includeSpecification: false },
  requiredFonts: ['Montserrat', '方正兰亭中黑_GBK'],
  precision: 'round', allowCompound: false,
  dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '长、宽或高', sizePlaceholder: '长×宽×高', inspectorTitle: '单品',
  model: { fontSize: 60, fontFamily: 'Montserrat, "Microsoft YaHei", sans-serif', color: '#ffffff', background: '#00586d', radius: 8, paddingX: 28, textY: 62, baseline: 'alphabetic' },
  sellingPoints: { fontSize: 50, fontFamily: 'Montserrat, "方正兰亭中黑_GBK", sans-serif', color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 14 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0 }),
  restoreOptions: (draft) => ({ ...sofaSingleRules.createOptions(), sofaFirmness: normalizeSofaFirmness((draft as SofaFirmnessDraft).sofaFirmness) }),
  saveOptions: (options) => {
    const sofaFirmness = normalizeSofaFirmness(options.sofaFirmness);
    return hasSofaFirmness(sofaFirmness) ? { sofaFirmness } as Partial<SofaFirmnessDraft> : {};
  },
  hasOptions: (options) => hasSofaFirmness(normalizeSofaFirmness(options.sofaFirmness)),
  OptionsEditor: SofaFirmnessEditor,
  drawExtras: (context, options) => drawSofaFirmness(context, normalizeSofaFirmness(options.sofaFirmness)),
  extraIssues: (context, options) => sofaFirmnessIssues(context, normalizeSofaFirmness(options.sofaFirmness)),
  visibleSellingPoints: (points) => points.slice(0, 3),
  layout: (widths, options) => {
    const layout = getSofaSingleLayout(widths);
    if (!options.sofaFirmness?.enabled) return layout;
    // 为圆弧和说明保留底部独立区域，尺寸文字也随主图共同适配。
    return { ...layout, productArea: { ...layout.productArea, height: 550 }, subjectSafeArea: { ...layout.subjectSafeArea, height: 557 } };
  },
  sellingPointIssue: (widths) => sellingPointCapacityIssue(widths),
  modelBadge(context, model, layout) {
    const style = sofaSingleRules.model;
    context.font = canvasFontFromPs(style.fontSize, style.fontFamily);
    const text = model || '产品型号';
    return { text, fontSize: style.fontSize, box: { ...layout.modelBadge, width: context.measureText(text).width + style.paddingX * 2 }, issue: null };
  },
  dimensionLabel: (context, annotation) => measurePlainDimension(context, `${annotation.value}cm`, canvasFontFromPs(46, 'Montserrat, Arial, sans-serif'), 46),
  parseQuickDimensions(value) { const parsed = parseDimensions(value); return parsed ? dimensionFieldsFromDimensions(parsed) : null; },
  formatFields: formatDimensionFields, exportIssues: () => [],
};
