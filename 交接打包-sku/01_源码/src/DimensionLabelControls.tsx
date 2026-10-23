import type { DimensionAnnotation, DimensionLabelAdjustment } from './domain/dimensionAnnotations';
import type { DimensionHitTarget } from './domain/dimensionHitTest';
import { DIMENSION_LABELS } from './DimensionInspector';
import type { useDimensionEditing } from './useDimensionEditing';

export function DimensionLabelControls({ editor, annotation, onChange }: {
  editor: ReturnType<typeof useDimensionEditing>;
  annotation?: DimensionAnnotation;
  onChange: (target: DimensionHitTarget, changes: DimensionLabelAdjustment) => void;
}) {
  const selected = editor.labelTarget;
  const target = selected && editor.targets.find((item) => item.ownerId === selected.ownerId && item.kind === selected.kind);
  if (!target || !annotation) return null;
  const color = annotation.labelColor ?? (/^#(?:fff|ffffff)$/i.test(target.labelColor ?? '') ? 'white' : 'dark');
  return <section className="dimension-label-controls" aria-label={`${DIMENSION_LABELS[target.kind]}尺寸文字微调`}>
    <h3>{DIMENSION_LABELS[target.kind]} · 文字位置与颜色</h3>
    <button type="button" className="dimension-label-move-toggle" aria-pressed={editor.labelMoving} onClick={editor.toggleLabelMoving}>移动标注位置</button>
    <p className="hint">{editor.labelMoving ? '拖动画布上的高亮文字；点空白或再点按钮结束。' : '开启后可直接拖动尺寸文字。'}</p>
    <div className="dimension-label-colors" role="group" aria-label="尺寸文字颜色">
      <button type="button" aria-pressed={color === 'dark'} onClick={() => onChange(target, { labelColor: 'dark' })}>深色</button>
      <button type="button" aria-pressed={color === 'white'} onClick={() => onChange(target, { labelColor: 'white' })}>白色</button>
    </div>
  </section>;
}
