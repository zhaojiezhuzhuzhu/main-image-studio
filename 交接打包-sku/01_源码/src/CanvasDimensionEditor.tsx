import { useEffect, useId, useRef, useState } from 'react';
import { DIMENSION_LABELS } from './DimensionInspector';
import type { DimensionHitTarget } from './domain/dimensionHitTest';
import { parseDimensionEdit } from './domain/dimensionEditing';
import type { DimensionPrecision } from './domain/dimensions';
import type { useDimensionEditing } from './useDimensionEditing';

function DimensionValueInput({ target, value, precision, allowCompound, allowDimensionText, onCommit, onCancel }: {
  target: DimensionHitTarget;
  value: string;
  precision?: DimensionPrecision;
  allowCompound?: boolean;
  allowDimensionText?: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  const errorId = useId();
  function commit() {
    if (done.current) return true;
    const next = parseDimensionEdit(draft, precision, allowCompound, allowDimensionText);
    if (next === undefined) { setError(true); input.current?.focus(); return false; }
    done.current = true;
    onCommit(next);
    return true;
  }
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (box.current?.contains(event.target as Node)) return;
      if (!commit()) { event.preventDefault(); event.stopPropagation(); }
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });
  const { label } = target;
  return <div ref={box} className={`canvas-dimension-input${error ? ' invalid' : ''}`}
    style={{ left: `${(label.x + label.width / 2) / 1440 * 100}%`, top: `${(label.y + label.height / 2) / 1440 * 100}%`, minWidth: `${(label.width + 20) / 1440 * 100}%` }}
    onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <input ref={input} aria-label={`画布${DIMENSION_LABELS[target.kind]}尺寸（cm）`} inputMode={allowDimensionText ? 'text' : 'decimal'}
      aria-invalid={error} aria-describedby={error ? errorId : undefined} value={draft}
      style={{ width: `${Math.max(draft.length, 2)}ch` }}
      onChange={(event) => { setDraft(event.target.value); setError(false); }} onBlur={commit}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) event.stopPropagation();
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); done.current = true; onCancel(); }
      }}/>
    <span>cm</span>
    {error && <span id={errorId} role="alert" className="dimension-input-error">{allowDimensionText ? '请保留有效尺寸数值，可在前后添加中文说明' : '请输入大于 0 的数值（最小 0.1）'}{allowCompound ? '，并列规格用 /，范围用 ~ 分隔' : ''}</span>}
  </div>;
}

export function CanvasDimensionEditor({ editor, selected, value, precision, allowCompound, allowDimensionText, onChange }: {
  editor: ReturnType<typeof useDimensionEditing>;
  selected?: { ownerId: string; kind: DimensionHitTarget['kind'] };
  value: string | undefined;
  precision?: DimensionPrecision;
  allowCompound?: boolean;
  allowDimensionText?: boolean;
  onChange: (target: DimensionHitTarget, value: string) => void;
}) {
  const target = selected && editor.targets.find((item) => item.ownerId === selected.ownerId && item.kind === selected.kind);
  const textTarget = editor.textTarget;
  const extensions = editor.mode === 'extensions';
  return <>
    {target && !textTarget && editor.labelMoving && <button type="button" className="dimension-label-drag" aria-label={`移动${DIMENSION_LABELS[target.kind]}尺寸文字`}
      title="拖动尺寸文字，点击空白处结束移动；方向键微调，Esc 取消"
      style={{ left: `${target.label.x / 1440 * 100}%`, top: `${target.label.y / 1440 * 100}%`, width: `${target.label.width / 1440 * 100}%`, height: `${target.label.height / 1440 * 100}%` }}
      onPointerDown={(event) => editor.begin(event, target, 'label')} onPointerMove={editor.move} onPointerUp={editor.finish}
      onPointerCancel={editor.cancelDrag} onLostPointerCapture={editor.cancelDrag} onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (direction) { event.preventDefault(); event.stopPropagation(); editor.nudge(target, 'label', direction[0] * (event.shiftKey ? 10 : 1), direction[1] * (event.shiftKey ? 10 : 1)); }
      }}/>}
    {target && !textTarget && !editor.labelMoving && <>
      <svg className="dimension-line-selection" viewBox="0 0 1440 1440">
        {extensions && target.extensions ? (['from', 'to'] as const).map((endpoint) =>
          <line key={endpoint} aria-hidden="true" x1={target[endpoint].x} y1={target[endpoint].y} x2={target.extensions![endpoint].x} y2={target.extensions![endpoint].y}/>)
          : <line aria-hidden="true" x1={target.from.x} y1={target.from.y} x2={target.to.x} y2={target.to.y}/>}
        {!extensions && <line className="dimension-line-drag" role="button" tabIndex={0} aria-label={`整体移动${DIMENSION_LABELS[target.kind]}标注`}
          x1={target.from.x} y1={target.from.y} x2={target.to.x} y2={target.to.y}
          onPointerDown={(event) => editor.begin(event, target, 'line')} onPointerMove={editor.move} onPointerUp={editor.finish}
          onPointerCancel={editor.cancelDrag} onLostPointerCapture={editor.cancelDrag}
          onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
            const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (direction) {
              event.preventDefault(); event.stopPropagation();
              editor.nudge(target, 'line', direction[0] * (event.shiftKey ? 10 : 1), direction[1] * (event.shiftKey ? 10 : 1));
            }
          }}><title>拖动线条整体移动标注，按住 Shift 限定水平或垂直；方向键微调（Shift 加速）</title></line>}
      </svg>
      {(['from', 'to'] as const).map((endpoint, index) => <button type="button" key={endpoint}
        className={`dimension-endpoint${extensions ? ' dimension-extension-handle' : ''}`} aria-label={`${DIMENSION_LABELS[target.kind]}${extensions ? '辅助线' : '标注'}${index === 0 ? '起点' : '终点'}`}
        title={extensions ? '沿虚线方向拖动菱形，拉长或缩短辅助线；方向键微调（Shift 加速）' : '拖动调整端点，按住 Shift 锁定水平或垂直；方向键微调（Shift 加速）'}
        style={{ left: `${(extensions ? target.extensions?.[endpoint] ?? target[endpoint] : target[endpoint]).x / 1440 * 100}%`, top: `${(extensions ? target.extensions?.[endpoint] ?? target[endpoint] : target[endpoint]).y / 1440 * 100}%` }}
        onPointerDown={(event) => editor.begin(event, target, endpoint)} onPointerMove={editor.move} onPointerUp={editor.finish}
        onPointerCancel={editor.cancelDrag} onLostPointerCapture={editor.cancelDrag}
        onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
          const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
          if (direction) {
            event.preventDefault(); event.stopPropagation();
            editor.nudge(target, endpoint, direction[0] * (event.shiftKey ? 10 : 1), direction[1] * (event.shiftKey ? 10 : 1));
          }
        }}/>) }
    </>}
    {textTarget && <DimensionValueInput key={`${textTarget.ownerId}-${textTarget.kind}`} target={textTarget} value={value ?? ''} precision={precision} allowCompound={allowCompound} allowDimensionText={allowDimensionText}
      onCommit={(next) => { if (next !== parseDimensionEdit(value ?? '', precision, allowCompound, allowDimensionText)) onChange(textTarget, next); editor.setTextTarget(undefined); }} onCancel={() => editor.setTextTarget(undefined)}/>}
  </>;
}

export function DimensionEditMode({ editor }: { editor: ReturnType<typeof useDimensionEditing> }) {
  return <div className="dimension-edit-controls">
    <div className="dimension-edit-modes" role="group" aria-label="标注调整方式">
      <button type="button" aria-pressed={editor.mode === 'endpoints'} onClick={() => editor.setMode('endpoints')}>主线端点</button>
      <button type="button" aria-pressed={editor.mode === 'extensions'} onClick={() => editor.setMode('extensions')}>辅助线</button>
    </div>
    <p className="hint">{editor.mode === 'extensions' ? '选中已有尺寸，拖动菱形拉长或缩短辅助线；也可用方向键微调。' : '拖动高亮线条整体移动标注，拖动圆点调整端点；按住 Shift 限定水平／垂直。'}</p>
  </div>;
}
