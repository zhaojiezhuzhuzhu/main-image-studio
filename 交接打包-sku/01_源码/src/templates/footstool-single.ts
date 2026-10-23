import { formatDimensionFields, normalizeDimension, parseDimensionText } from '../domain/dimensions';
import { footstoolDimensionIssue, formatFootstoolModel, getFootstoolSingleLayout, parseFootstoolDimensions } from '../domain/footstoolSingleLayout';
import { canvasFontFromPs } from '../domain/typography';
import { measurePlainDimension } from './drawing';
import type { SingleTemplateRules } from './types';

// 脚踏专属规则；即使数值相同，也不继承其他模板规则。
export const footstoolSingleRules: SingleTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、15–16、18',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数，标清长、宽、高。',
      '蓝标写完整型号＋规格，必须包含“脚踏”；标签可加宽，高度不变。',
      '脚踏单独制作 SKU；使用侧面图，保留产品投影。',
      '按脚踏案例不放卖点框，保留底部“*实际尺寸请以下单规格为准”。',
      '型号标与备注位置固定；产品与标注不得进入规范红色禁区。',
    ],
  },
  filenameName: { includeSpecification: true, suffix: '脚踏' },
  requiredFonts: ['Montserrat', '方正兰亭准黑_GBK'],
  precision: 'truncate', allowCompound: false,
  dimensionKinds: ['length', 'width', 'height'], dimensionPrompt: '长、宽或高', sizePlaceholder: '长×宽×高', inspectorTitle: '脚踏',
  model: { fontSize: 60, fontFamily: 'Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#ffffff', background: '#00586d', radius: 8, paddingX: 44, textY: 58, baseline: 'alphabetic' },
  // 单品接口要求此字段；脚踏不生成卖点或卖点框。
  sellingPoints: { fontSize: 50, fontFamily: 'Montserrat, "方正兰亭准黑_GBK", sans-serif', color: '#00586d', borderWidth: 4, radius: 8, clipRadius: 6, maxLength: 14 },
  dimensionColor: '#000000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  note: { text: '*实际尺寸请以下单规格为准', font: canvasFontFromPs(40, '"方正兰亭准黑_GBK", sans-serif'), color: '#545454', x: 70, y: 1376 },
  createOptions: () => ({ sizeLabels: ['', ''], sellingPointCount: 3, dimensionGap: 0 }),
  restoreOptions: () => footstoolSingleRules.createOptions(), saveOptions: () => ({}), hasOptions: () => false,
  visibleSellingPoints: () => [],
  layout: () => getFootstoolSingleLayout(),
  sellingPointIssue: () => null,
  modelBadge(context, model, layout) {
    const style = footstoolSingleRules.model;
    const text = formatFootstoolModel(model);
    context.font = canvasFontFromPs(style.fontSize, style.fontFamily);
    const width = context.measureText(text).width + style.paddingX * 2;
    return { text, fontSize: style.fontSize, box: { ...layout.modelBadge, width }, issue: width > 870 ? '型号及脚踏规格过长，超出顶部安全区，请核对完整规格' : null };
  },
  dimensionLabel(context, annotation, fields) {
    const value = parseDimensionText(fields[annotation.kind] ?? String(annotation.value), 'truncate')?.text ?? String(normalizeDimension(annotation.value, 'truncate'));
    return measurePlainDimension(context, `${value}cm`, canvasFontFromPs(46, 'Montserrat, Arial, sans-serif'), 46);
  },
  parseQuickDimensions: parseFootstoolDimensions,
  formatFields: formatDimensionFields,
  exportIssues: (fields, sizeInput, _options, modelIssue) => [modelIssue, footstoolDimensionIssue(fields), sizeInput.trim() && !parseFootstoolDimensions(sizeInput) ? '快速尺寸无效，请按脚踏长×宽×高填写' : null].filter((issue): issue is string => Boolean(issue)),
};
