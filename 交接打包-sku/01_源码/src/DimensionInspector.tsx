import { useId, type ReactNode } from 'react';
import type { DimensionKind, DimensionAnnotation } from './domain/dimensionAnnotations';
import { dimensionsFromFields, type DimensionFields } from './domain/dimensions';

export const DIMENSION_LABELS = { length: '长', width: '宽', height: '高', headWidth: '床头宽', footWidth: '床尾宽', diameter: '直径', secondaryLength: '副柜长', secondaryWidth: '副柜宽', secondaryHeight: '副柜高' };
export const DIMENSION_KINDS: DimensionKind[] = ['length', 'width', 'height'];

export function DimensionInspector({ title, fields, annotations, activeKind, hasImage, markingKind, kinds = DIMENSION_KINDS, controls, allowDimensionText, onSelect, onChange, onAnnotate, onCancel, onClear }: {
  title: string;
  fields: DimensionFields;
  annotations: DimensionAnnotation[];
  activeKind: DimensionKind;
  hasImage: boolean;
  markingKind?: DimensionKind;
  kinds?: DimensionKind[];
  controls?: ReactNode;
  allowDimensionText?: boolean;
  onSelect: (kind: DimensionKind) => void;
  onChange: (kind: DimensionKind, value: string) => void;
  onAnnotate: (kind: DimensionKind) => void;
  onCancel: () => void;
  onClear?: (kind: DimensionKind) => void;
}) {
  const inputId = useId();
  const dimensions = dimensionsFromFields(fields, 'round', allowDimensionText);
  return <div className="dimension-inspector">
    <h2>{title} · 尺寸微调</h2>
    <p className="hint">点击{kinds.map((kind) => DIMENSION_LABELS[kind]).join('、')}区块切换编辑；数值和左侧快速尺寸同步。</p>
    {allowDimensionText && <p className="hint">可添加中文说明，如“尺寸可选：140/160”；单位 cm 自动显示。</p>}
    {controls}
    {kinds.map((kind) => {
      const marked = annotations.some((annotation) => annotation.kind === kind);
      return <section key={kind} tabIndex={0} aria-label={`${DIMENSION_LABELS[kind]}尺寸微调`} className={`dimension-card${activeKind === kind ? ' active' : ''}`}
        onClick={() => onSelect(kind)} onFocus={() => onSelect(kind)}>
        <div className="section-title"><h3><label htmlFor={`${inputId}-${kind}`}>{DIMENSION_LABELS[kind]}（cm）</label></h3>{activeKind === kind && <span className="dimension-state" role="img" aria-label="当前编辑" title="当前编辑"/>}</div>
        <input id={`${inputId}-${kind}`} inputMode={allowDimensionText ? 'text' : 'decimal'} value={fields[kind] ?? ''} onChange={(event) => onChange(kind, event.target.value)}/>
        <div className="panel-actions">
          <button type="button" disabled={!hasImage || dimensions[kind] === undefined} onClick={(event) => { event.stopPropagation(); onAnnotate(kind); }}>{marked ? '重新标注' : '开始标注'}</button>
          {markingKind === kind ? <button type="button" className="reset-layout" onClick={(event) => { event.stopPropagation(); onCancel(); }}>取消本次标注</button>
            : onClear && marked && <button type="button" className="reset-layout" onClick={(event) => { event.stopPropagation(); onClear(kind); }}>移除标注</button>}
        </div>
      </section>;
    })}
  </div>;
}
