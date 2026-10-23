import { parseDimensionText } from '../domain/dimensions';
import { constrainFunctionalSofaLabel, getFunctionalSofaCombinationLayout, parseFunctionalSofaCombinationDimensions, functionalSofaCombinationText } from '../domain/functionalSofaCombinationLayout';
import { canvasFontFromPs } from '../domain/typography';
import { validateCombinationWorkbench } from '../domain/workbenchValidation';
import type { CombinationTemplateRules } from './types';

export const functionalSofaCombinationRules: CombinationTemplateRules = {
  productionNotes: {
    sourcePages: '2–3、15、17–18',
    points: [
      '尺寸用 cm；换算不四舍五入，保留 1 位小数。',
      '一个颜色一张 SKU；蓝标只写型号，不写规格。',
      '主推规格用侧面图保留投影；上传实际左单电动、右单电动或双电动状态，不镜像素材推断功能。',
      '收起到展开的宽度、高度范围完整填写；高度范围分两行，数值截断1位小数。',
      '型号标和底部备注位置固定；产品与标注不得进入规范红色禁区。',
      '“其他可选尺寸”标签可上下移动，文案不可修改。',
    ],
  },
  filenameName: { includeSpecification: false },
  requiredFonts: ['Montserrat', '方正兰亭中黑_GBK', 'FZLanTingHeiS-DB-GBK', 'FZLanTingHeiS-R-GBK'],
  precision: 'truncate', allowCompound: true,
  model: { fontSize: 60, fontFamily: 'Montserrat, "Microsoft YaHei", sans-serif', color: '#fff', background: '#00586d', radius: 8, paddingX: 28, textY: 62, baseline: 'alphabetic' },
  dimensionColor: '#000',
  lineStyle: { color: '#545454', lineWidth: 2, arrowLength: 15, arrowHeight: 9, tipGap: 1, extensionDashLength: 6, extensionGapLength: 3, extensionDashCount: 5 },
  dimensionFont: canvasFontFromPs(46, 'Montserrat, Arial, sans-serif'), dimensionFontSize: 46, dimensionLineGap: 6,
  optionalLabel: { font: canvasFontFromPs(34, '"FZLanTingHeiS-DB-GBK", "Microsoft YaHei", sans-serif'), color: '#000', borderWidth: 2, radius: 28, text: '其他可选尺寸', movable: true },
  note: { font: canvasFontFromPs(40, '"FZLanTingHeiS-R-GBK", "Microsoft YaHei", sans-serif'), color: '#545454', defaultText: '*实际尺寸请以下单规格为准' },
  maxOptionalCount: 4, objectGap: 20, canvasTitle: '功能沙发组合画布', exportFileName: (model) => `${model}-功能沙发组合-SKU.jpg`,
  modelWidthIssue: (width) => width > 1300 ? '产品型号过长，超出组合安全区' : null, mainFieldsColumns: 2, markingPassThrough: false,
  createOptions: () => ({ sellingPoints: ['', '', ''], feature: { enabled: false, text: '', x: 0, y: 0 } }),
  restoreOptions: () => functionalSofaCombinationRules.createOptions(), saveOptions: () => ({}), hasOptions: () => false,
  layout: getFunctionalSofaCombinationLayout,
  labelState: (state) => ({ showLabel: state.enabled, showNote: state.noteEnabled, side: state.side, offsetY: state.offsetY, showControls: true }),
  constrainLabel: constrainFunctionalSofaLabel,
  optionalMovementArea: (group, layout) => ({ ...group, y: layout.mainMovementArea.y, height: group.y + group.height - layout.mainMovementArea.y }),
  annotations: (values) => values,
  dimensionText: functionalSofaCombinationText,
  parseQuickDimensions: parseFunctionalSofaCombinationDimensions,
  validate(input) {
    const result = validateCombinationWorkbench(input);
    const extra: string[] = [];
    if (!parseFunctionalSofaCombinationDimensions(input.sizeInput)) extra.push('主产品快速尺寸无效，请按长×宽×高填写，范围用 ~ 分隔');
    for (const kind of ['length', 'width', 'height'] as const) if (!parseDimensionText(input.mainDimensionFields[kind], 'truncate')) extra.push(`请填写主产品${{ length: '长', width: '宽', height: '高' }[kind]}的完整尺寸`);
    input.optionalSizeInputs.forEach((text, i) => { if (!parseFunctionalSofaCombinationDimensions(text)) extra.push(`规格${i + 1}快速尺寸无效`); });
    [input.mainDimensionFields, ...input.optionalSizes.map((item) => item.dimensionFields)].forEach((fields, i) => {
      for (const kind of ['length', 'width', 'height'] as const) if (fields[kind].trim() && !parseFunctionalSofaCombinationDimensions(`${fields[kind]}××`)) extra.push(`${i ? `规格${i}` : '主产品'}尺寸格式无效`);
    });
    return { ...result, blockers: [...result.blockers, ...extra] };
  },
};
