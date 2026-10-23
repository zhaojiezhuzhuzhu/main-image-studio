import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point, Rect } from './domain/dimensionGeometry';
import type { CanvasOptionsEditorProps, SingleTemplateOptions, TextMeasure } from './templates/types';

export type DiningChairEditing = {
  fontFamily: string;
  read(context: TextMeasure, value: SingleTemplateOptions): { badges: Array<{ box: Rect; text: string; model: string; number?: string }>; markers?: Point[] };
  change(value: SingleTemplateOptions, index: number, change: { model?: string; marker?: Point }): SingleTemplateOptions;
};
type Drag = { index: number; start: Point; center: Point; rect: Rect; original: SingleTemplateOptions; pointerId: number; next?: SingleTemplateOptions };
const position = (point: Point) => ({ left: `${point.x / 14.4}%`, top: `${point.y / 14.4}%` });
const markerCenter = (marker: Point, rect: Rect): Point => ({
  x: rect.x + Math.max(Math.min(20, rect.width / 2), Math.min(rect.width - Math.min(20, rect.width / 2), marker.x * rect.width)),
  y: rect.y + Math.max(Math.min(20, rect.height / 2), Math.min(rect.height - Math.min(20, rect.height / 2), marker.y * rect.height)),
});

export function CanvasDiningChairEditor(props: CanvasOptionsEditorProps & { editing: DiningChairEditing }) {
  const { value, canvasRef, productRect, disabled, editing: rules, onActivate, onCommit, onPreview, onStatusChange } = props;
  const root = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const textDraft = useRef<{ index: number; text: string } | undefined>(undefined);
  const [selected, setSelected] = useState<number>();
  const [editing, setEditing] = useState<number>();
  const [preview, setPreview] = useState<SingleTemplateOptions>();
  const latest = useRef(props); latest.current = props;
  const context = canvasRef.current?.getContext('2d');
  let scene: ReturnType<DiningChairEditing['read']> = { badges: [] };
  if (context) { context.save(); context.letterSpacing = '0px'; scene = rules.read(context, preview ?? value); context.restore(); }

  function clearPreview() { drag.current = undefined; setPreview(undefined); latest.current.onPreview(undefined); }
  function finishText(commit: boolean) {
    const draft = textDraft.current;
    if (!draft) return;
    textDraft.current = undefined; setEditing(undefined);
    const next = commit ? latest.current.editing.change(latest.current.value, draft.index, { model: draft.text }) : latest.current.value;
    if (commit) latest.current.onCommit(next);
    clearPreview();
    return next;
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      finishText(true); clearPreview(); setSelected(undefined);
    };
    const cancel = () => { finishText(false); clearPreview(); setSelected(undefined); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.isComposing) cancel(); };
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('keydown', escape); window.addEventListener('blur', cancel);
    return () => { document.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', escape); window.removeEventListener('blur', cancel); };
  }, []);
  useEffect(() => { if (editing !== undefined) { input.current?.focus(); input.current?.select(); } }, [editing]);
  useEffect(() => {
    if (disabled) { finishText(false); clearPreview(); setSelected(undefined); }
  }, [disabled]);
  useEffect(() => {
    onStatusChange(disabled ? '' : editing !== undefined ? `正在编辑第${editing + 1}款餐椅／长凳文案：Enter 确认，Esc 取消`
      : selected !== undefined && scene.markers?.[selected] ? `已选中编号 ${selected + 1}：拖动编号或移动手柄，方向键微调；点击空白处结束` : '');
  }, [selected, editing, disabled, scene.markers?.length, onStatusChange]);

  function clientPoint(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 1440 / rect.width, y: (event.clientY - rect.top) * 1440 / rect.height };
  }
  function moved(original: SingleTemplateOptions, index: number, center: Point, rect: Rect, dx: number, dy: number) {
    const point = markerCenter({ x: (center.x + dx - rect.x) / rect.width, y: (center.y + dy - rect.y) / rect.height }, rect);
    return rules.change(original, index, { marker: { x: (point.x - rect.x) / rect.width, y: (point.y - rect.y) / rect.height } });
  }
  function begin(event: ReactPointerEvent<HTMLButtonElement>, index: number) {
    if (event.button !== 0 || !productRect || !scene.markers) return;
    event.preventDefault(); event.stopPropagation(); const original = finishText(true) ?? value; onActivate(); setSelected(index);
    drag.current = { index, start: clientPoint(event), center: markerCenter(scene.markers[index], productRect), rect: productRect, original, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus();
  }
  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const point = clientPoint(event), dx = point.x - active.start.x, dy = point.y - active.start.y;
    if (!active.next && Math.hypot(dx, dy) < 1) return;
    active.next = moved(active.original, active.index, active.center, active.rect, dx, dy);
    setPreview(active.next); onPreview(active.next);
  }
  function finish(event: ReactPointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    move(event); if (active.next) onCommit(active.next); clearPreview();
  }
  function keyMove(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction || !productRect || !scene.markers) return;
    event.preventDefault(); event.stopPropagation(); onActivate(); setSelected(index);
    onCommit(moved(value, index, markerCenter(scene.markers[index], productRect), productRect, direction[0] * (event.shiftKey ? 10 : 1), direction[1] * (event.shiftKey ? 10 : 1)));
  }
  if (disabled) return null;
  return <div ref={root} className="dining-chair-canvas-editor" onClick={(event) => event.stopPropagation()}>
    {scene.badges.map((badge, index) => {
      const { box } = badge, inset = badge.number ? 56 : 20;
      const style = { ...position(box), width: `${box.width / 14.4}%`, height: `${box.height / 14.4}%`, fontSize: `${35 / 14.4}cqw`, fontFamily: rules.fontFamily };
      return editing === index ? <input key={index} ref={input} className="dining-chair-text-input" aria-label={`画布第${index + 1}款餐椅规格`}
        style={{ ...style, left: `${(box.x + inset) / 14.4}%`, width: `${(box.width - inset) / 14.4}%`, paddingRight: `${20 / 14.4}cqw` }} value={textDraft.current?.text ?? badge.model}
        onPointerDown={(event) => event.stopPropagation()} onChange={(event) => {
          textDraft.current = { index, text: event.target.value };
          const next = rules.change(value, index, { model: event.target.value }); setPreview(next); onPreview(next);
        }} onBlur={() => finishText(true)} onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) event.stopPropagation();
          if (!event.nativeEvent.isComposing && ['Enter', 'Escape'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); finishText(event.key === 'Enter'); }
        }}/>
        : <button type="button" key={index} className="dining-chair-text-hit" style={style} aria-label={`编辑第${index + 1}款餐椅规格`} title="点击编辑型号与规格"
          onPointerDown={(event) => event.stopPropagation()} onClick={() => { finishText(true); onActivate(); setSelected(undefined); textDraft.current = { index, text: badge.model }; setEditing(index); }}/>;
    })}
    {productRect && scene.markers?.map((marker, index) => {
      const center = markerCenter(marker, productRect);
      const interaction = { onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => begin(event, index), onPointerMove: move, onPointerUp: finish, onPointerCancel: clearPreview, onLostPointerCapture: clearPreview, onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => keyMove(event, index) };
      return <div key={index}>
        <button type="button" className="dining-chair-marker-hit" style={position(center)} aria-label={`餐椅编号 ${index + 1}`} aria-pressed={selected === index}
          title="点击选中，拖动移动编号" {...interaction} onClick={() => { onActivate(); setSelected(index); }}/>
        {selected === index && <button type="button" className="dining-chair-marker-move" style={position(center)} aria-label={`移动餐椅编号 ${index + 1}`} title="拖动移动编号；方向键微调，Shift 加速" {...interaction}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4"/></svg>
        </button>}
      </div>;
    })}
  </div>;
}
