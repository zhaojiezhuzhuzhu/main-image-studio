import { dimensionFieldsFromDimensions, parseDimensions } from '../domain/dimensions';
import { constrainOptionalLabelOffset, getSofaCombinationLayout } from '../domain/sofaCombinationLayout';
import { canvasFontFromPs } from '../domain/typography';
import { validateCombinationWorkbench } from '../domain/workbenchValidation';
import type { CombinationTemplateRules } from './types';

export const sofaCombinationRules: CombinationTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、15、17',
    points: [
      '尺寸用 cm；规范要求截断到 1 位小数，当前沙发模板沿用四舍五入显示。',
      '一个颜色一张 SKU；蓝标只写型号，不写规格。',
      '主推规格用侧面图并保留投影；次推规格用侧面图、不带投影，各规格高度一致。',
      '型号标和底部备注位置固定；产品与标注不得进入规范红色禁区。',
      '“其他可选尺寸”标签可上下移动，文案不可修改。',
    ],
  },
  filenameName: { includeSpecification: false },
  requiredFonts: ['Montserrat', '方正兰亭中黑_GBK', 'FZLanTingHeiS-DB-GBK', 'FZLanTingHeiS-R-GBK'],
  precision: 'round', allowCompound: false,
  model: { fontSize: 60, fontFamily: 'Montserrat, "Microsoft YaHei", sans-serif', color: '#fff', background: '#00586d', radius: 8, paddingX: 28, textY: 62, baseline: 'alphabetic' },
  dimensionColor: '#000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  dimensionFont: canvasFontFromPs(46, 'Montserrat, Arial, sans-serif'), dimensionFontSize: 46, dimensionLineGap: 6,
  optionalLabel: { font: canvasFontFromPs(34, '"FZLanTingHeiS-DB-GBK", "Microsoft YaHei", sans-serif'), color: '#000', borderWidth: 2, radius: 28, text: '其他可选尺寸', movable: true },
  note: { font: canvasFontFromPs(40, '"FZLanTingHeiS-R-GBK", "Microsoft YaHei", sans-serif'), color: '#545454', defaultText: '*实际尺寸请以下单规格为准' },
  maxOptionalCount: 4, objectGap: 20, canvasTitle: '组合画布', exportFileName: (model) => `${model}-组合SKU.jpg`,
  KindEditor: ({ value, onChange }) => <label>产品类型<select value={value} onChange={(event) => onChange(event.target.value as typeof value)}><option value="standard">普通沙发</option><option value="functional">功能沙发</option></select></label>,
  modelWidthIssue: (width) => width > 1300 ? '产品型号过长，超出组合安全区' : null, mainFieldsColumns: 2, markingPassThrough: false,
  createOptions: () => ({ sellingPoints: ['', '', ''], feature: { enabled: false, text: '', x: 0, y: 0 } }),
  restoreOptions: () => sofaCombinationRules.createOptions(), saveOptions: () => ({}), hasOptions: () => false,
  layout: getSofaCombinationLayout,
  labelState: (state) => ({ showLabel: state.enabled, showNote: state.noteEnabled, side: state.side, offsetY: state.offsetY, showControls: true }),
  constrainLabel: constrainOptionalLabelOffset,
  optionalMovementArea: (group, layout) => ({ ...group, y: layout.mainMovementArea.y, height: group.y + group.height - layout.mainMovementArea.y }),
  annotations: (values) => values,
  dimensionText: (annotation) => `${annotation.value}cm`,
  parseQuickDimensions(value) { const parsed = parseDimensions(value); return parsed ? dimensionFieldsFromDimensions(parsed) : null; },
  validate: validateCombinationWorkbench,
};
