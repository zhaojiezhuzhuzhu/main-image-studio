import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { adjustFunctionalCurve, defaultFunctionalCurve, functionalCurveGeometry, type FunctionalCurve, type FunctionalCurveKind } from '../domain/functionalSofaCurve';
import { FUNCTIONAL_SOFA_MODEL_FONT, normalizeFunctionalSofaOptions } from '../domain/functionalSofaSingleLayout';
import type { Point } from '../domain/dimensionGeometry';
import type { CanvasOptionsEditorProps, SingleTemplateOptions } from './types';

type Part = keyof FunctionalCurve | 'move';
type Drag = { kind: FunctionalCurveKind; part: Part; start: Point; original: SingleTemplateOptions; pointerId: number; next?: SingleTemplateOptions };
const names = { rocking: '摇动', rotation: '旋转' };
const partNames = { from: '起点', to: '终点', bend: '弧度' };
const position = (point: Point) => ({ left: `${point.x / 14.4}%`, top: `${point.y / 14.4}%` });

export function FunctionalSofaCanvasEditor(props: CanvasOptionsEditorProps) {
  const { value, canvasRef, disabled, onCommit, onPreview, onActivate, onStatusChange } = props;
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const textDraft = useRef<{ kind: FunctionalCurveKind; text: string } | undefined>(undefined);
  const [selected, setSelected] = useState<FunctionalCurveKind>();
  const [preview, setPreview] = useState<SingleTemplateOptions>();
  const [editing, setEditing] = useState<FunctionalCurveKind>();
  const [text, setText] = useState('');
  const normalized = normalizeFunctionalSofaOptions(preview ?? value);
  const latest = useRef(props);
  latest.current = props;

  function cancelDrag() {
    drag.current = undefined; setPreview(undefined); latest.current.onPreview(undefined);
  }

  function finishText(commit: boolean) {
    const draft = textDraft.current;
    if (!draft) return;
    textDraft.current = undefined; setEditing(undefined);
    const current = latest.current.value;
    if (commit && current[draft.kind]?.text !== draft.text) {
      const next = { ...current, [draft.kind]: { ...normalizeFunctionalSofaOptions(current)[draft.kind], text: draft.text } };
      latest.current.onCommit(next);
      return next;
    }
    return current;
  }

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      finishText(true); cancelDrag(); setSelected(undefined);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      finishText(false); cancelDrag(); setSelected(undefined);
    };
    const blur = () => { finishText(false); cancelDrag(); setSelected(undefined); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', escape); window.addEventListener('blur', blur);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape); window.removeEventListener('blur', blur); };
  }, []);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const enabled = selected ? normalized[selected].enabled : false;
  useEffect(() => {
    if (disabled || !enabled) { finishText(false); cancelDrag(); setSelected(undefined); }
  }, [disabled, enabled]);
  useEffect(() => {
    onStatusChange(!selected || disabled || !enabled ? '' : editing ? `正在编辑${names[selected]}说明：Enter 确认，Esc 取消` : preview
      ? `正在调整${names[selected]}曲线：松开保存，Esc 取消` : `已选中${names[selected]}${selected === 'rocking' ? '圆弧' : '椭圆弧'}：端点移动时菱形自动居中；菱形沿中线调弧度，方向键微调`);
  }, [selected, editing, Boolean(preview), disabled, enabled, onStatusChange]);

  function clientPoint(event: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 1440 / rect.width, y: (event.clientY - rect.top) * 1440 / rect.height };
  }
  function adjust(original: SingleTemplateOptions, kind: FunctionalCurveKind, part: Part, dx: number, dy: number): SingleTemplateOptions {
    const feature = normalizeFunctionalSofaOptions(original)[kind];
    if (part === 'move') return { ...original, [kind]: { ...feature, x: feature.x + dx, y: feature.y + dy } };
    const curve = feature.curve ?? defaultFunctionalCurve(kind);
    return { ...original, [kind]: { ...feature, curve: adjustFunctionalCurve(curve, part, { x: curve[part].x + dx, y: curve[part].y + dy }) } };
  }
  function begin(event: ReactPointerEvent<Element>, kind: FunctionalCurveKind, part: Part) {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const original = finishText(true) ?? latest.current.value;
    onActivate(); setSelected(kind);
    drag.current = { kind, part, start: clientPoint(event), original, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    (event.currentTarget as HTMLElement).focus();
  }
  function move(event: ReactPointerEvent<Element>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    event.stopPropagation();
    const point = clientPoint(event), dx = point.x - active.start.x, dy = point.y - active.start.y;
    if (!active.next && Math.hypot(dx, dy) < 1) return;
    active.next = adjust(active.original, active.kind, active.part, dx, dy);
    setPreview(active.next); onPreview(active.next);
  }
  function finish(event: ReactPointerEvent<Element>) {
    const active = drag.current;
    if (!active || event.pointerId !== active.pointerId) return;
    move(event);
    if (active.next) onCommit(active.next);
    cancelDrag();
  }
  function keyAdjust(event: React.KeyboardEvent<Element>, kind: FunctionalCurveKind, part: Part) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (direction) {
      event.preventDefault(); event.stopPropagation(); onActivate(); setSelected(kind);
      onCommit(adjust(value, kind, part, direction[0] * (event.shiftKey ? 10 : 1), direction[1] * (event.shiftKey ? 10 : 1)));
    } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onActivate(); setSelected(kind); }
  }
  if (disabled) return null;
  return <div className="functional-curve-editor" ref={root} onClick={(event) => event.stopPropagation()}>
    <svg className="functional-curve-paths" viewBox="0 0 1440 1440">
      {(['rocking', 'rotation'] as const).filter((kind) => normalized[kind].enabled).map((kind) => {
        const geometry = functionalCurveGeometry(kind, normalized[kind]);
        return <g key={kind}>
          {selected === kind && <path d={geometry.path} className="functional-curve-highlight" aria-hidden="true"/>}
          <path d={geometry.path} className="functional-curve-hit" tabIndex={0} role="button" aria-label={`${names[kind]}曲线`} aria-pressed={selected === kind}
            onPointerDown={(event) => begin(event, kind, 'move')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
            onKeyDown={(event) => keyAdjust(event, kind, 'move')}/>
        </g>;
      })}
    </svg>
    {(['rocking', 'rotation'] as const).filter((kind) => normalized[kind].enabled).map((kind) => {
      const feature = normalized[kind], geometry = functionalCurveGeometry(kind, feature);
      const context = canvasRef.current?.getContext('2d');
      let width = (feature.text.length || 5) * 46;
      if (context) { const font = context.font; context.font = `46px ${FUNCTIONAL_SOFA_MODEL_FONT}`; width = Math.max(46, context.measureText(editing === kind ? text || ' ' : feature.text || '点击填写说明').width); context.font = font; }
      const style = { ...position(geometry.text), width: `${(width + 8) / 14.4}%`, height: `${52 / 14.4}%`, fontSize: `${46 / 14.4}cqw`, fontFamily: FUNCTIONAL_SOFA_MODEL_FONT };
      return <div key={kind}>
        {editing === kind ? <input ref={input} className="functional-curve-text-input" aria-label={`画布${names[kind]}功能说明`} style={style} value={text}
          onPointerDown={(event) => event.stopPropagation()} onChange={(event) => { setText(event.target.value); textDraft.current = { kind, text: event.target.value }; }} onBlur={() => finishText(true)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) event.stopPropagation();
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finishText(event.key === 'Enter'); }
          }}/>
          : <button type="button" className="functional-curve-text-hit" aria-label={`编辑${names[kind]}功能说明`} title="点击编辑文字" style={style}
            onPointerDown={(event) => event.stopPropagation()} onClick={() => { onActivate(); setSelected(kind); setText(feature.text); textDraft.current = { kind, text: feature.text }; setEditing(kind); }}>
            {!feature.text && <span>点击填写说明</span>}
          </button>}
        {selected === kind && !editing && (['from', 'to', 'bend'] as const).map((part) => <button type="button" key={part}
          className={`functional-curve-handle${part === 'bend' ? ' bend' : ''}`} style={position(geometry.handles[part])} aria-label={`${names[kind]}曲线${partNames[part]}`}
          title={`${part === 'bend' ? '沿端点连线的垂直方向拖动，调整弯曲程度' : '拖动圆点调整端点，菱形自动保持居中'}；方向键微调，Shift 加速`}
          onPointerDown={(event) => begin(event, kind, part)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
          onKeyDown={(event) => keyAdjust(event, kind, part)}/>)}
      </div>;
    })}
  </div>;
}
