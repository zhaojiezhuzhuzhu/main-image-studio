import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { DimensionAnnotation, DimensionLabelAdjustment } from './domain/dimensionAnnotations';
import type { DimensionHitTarget } from './domain/dimensionHitTest';
import { commitDimensionEndpoint, previewDimensionEndpoint, previewDimensionExtension, previewDimensionTranslation, preserveManualLabelPosition, dimensionExtensionPoint, type DimensionEditScene, type DimensionEndpoint } from './domain/dimensionEditing';
import type { Point } from './domain/dimensionGeometry';

type DimensionHandle = DimensionEndpoint | 'line' | 'label';
type Drag = {
  ownerId: string;
  endpoint: DimensionHandle;
  pointerId: number;
  scene: DimensionEditScene;
  original: DimensionAnnotation;
  annotation: DimensionAnnotation;
  offset: { x: number; y: number };
  mode: 'endpoints' | 'extensions';
  desired: Point;
  target: DimensionHitTarget;
};

function moveLabel(annotation: DimensionAnnotation, target: DimensionHitTarget, desired: Point): DimensionAnnotation {
  const { label } = target;
  const dx = Math.max(0, Math.min(1440 - label.width, desired.x)) - label.x;
  const dy = Math.max(0, Math.min(1440 - label.height, desired.y)) - label.y;
  if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7) return annotation;
  return { ...annotation, labelOffset: {
    x: (annotation.labelOffset?.x ?? 0) + dx,
    y: (annotation.labelOffset?.y ?? 0) + dy,
  } };
}

export function useDimensionEditing(canvas: RefObject<HTMLCanvasElement | null>, onCommit: (ownerId: string, change: ReturnType<typeof commitDimensionEndpoint>) => void,
  onLabelCommit: (target: DimensionHitTarget, changes: DimensionLabelAdjustment) => void) {
  const scenes = useRef<Record<string, DimensionEditScene>>({});
  const drag = useRef<Drag | undefined>(undefined);
  const [preview, setPreview] = useState<Drag>();
  const [textTarget, setTextTarget] = useState<DimensionHitTarget>();
  const [labelTarget, setLabelTarget] = useState<Pick<DimensionHitTarget, 'ownerId' | 'kind'>>();
  const [labelMoving, setLabelMoving] = useState(false);
  const [targets, setTargets] = useState<DimensionHitTarget[]>([]);
  const [mode, setMode] = useState<Drag['mode']>('endpoints');

  function cancelDrag() { drag.current = undefined; setPreview(undefined); }
  function clear() { cancelDrag(); setTextTarget(undefined); setLabelTarget(undefined); setLabelMoving(false); }

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); cancelDrag(); }
      if (event.key === 'Escape') setLabelMoving(false);
      if (event.key === 'Shift' && drag.current) updateDrag(drag.current.desired, event.shiftKey);
    };
    window.addEventListener('keydown', cancel);
    window.addEventListener('keyup', cancel);
    window.addEventListener('blur', cancelDrag);
    return () => { window.removeEventListener('keydown', cancel); window.removeEventListener('keyup', cancel); window.removeEventListener('blur', cancelDrag); };
  }, []);

  function point(event: PointerEvent) {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 1440 / rect.width, y: (event.clientY - rect.top) * 1440 / rect.height };
  }

  function begin(event: PointerEvent<HTMLButtonElement | SVGLineElement>, target: DimensionHitTarget, endpoint: DimensionHandle) {
    if (event.button !== 0) return;
    const scene = scenes.current[target.ownerId];
    const annotation = scene?.annotations.find((item) => item.annotation.kind === target.kind)?.annotation;
    if (!annotation) return;
    if (endpoint !== 'label') { setLabelTarget(undefined); setLabelMoving(false); }
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = point(event);
    const handle = endpoint === 'label' ? target.label : endpoint === 'line' ? annotation.from : mode === 'extensions' ? dimensionExtensionPoint(annotation, endpoint, scene.adjustment?.dimensionFrame ?? scene.productRect) : annotation[endpoint];
    drag.current = { ownerId: target.ownerId, endpoint, pointerId: event.pointerId, scene, original: annotation, annotation,
      mode, target, desired: handle, offset: { x: handle.x - start.x, y: handle.y - start.y } };
    setPreview(drag.current);
  }

  function updateDrag(desired: Point, shift: boolean) {
    const current = drag.current;
    if (!current) return;
    const extension = current.mode === 'extensions';
    const annotation = current.endpoint === 'label' ? moveLabel(current.original, current.target, desired) : current.endpoint === 'line'
      ? previewDimensionTranslation(current.scene, current.original, { x: desired.x - current.original.from.x, y: desired.y - current.original.from.y }, shift)
      : extension
      ? previewDimensionExtension(current.scene, current.original, current.endpoint, desired)
      : previewDimensionEndpoint(current.original, current.endpoint, desired, shift);
    drag.current = { ...current, annotation: current.endpoint === 'label' ? annotation : preserveManualLabelPosition(current.scene, annotation), desired };
    setPreview(drag.current);
  }

  function move(event: PointerEvent<HTMLButtonElement | SVGLineElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    const cursor = point(event);
    updateDrag({ x: cursor.x + current.offset.x, y: cursor.y + current.offset.y }, event.shiftKey);
  }

  function finish(event: PointerEvent<HTMLButtonElement | SVGLineElement>) {
    move(event);
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    if (JSON.stringify(current.annotation) !== JSON.stringify(current.original)) {
      if (current.endpoint === 'label') onLabelCommit(current.target, { labelOffset: current.annotation.labelOffset });
      else onCommit(current.ownerId, commitDimensionEndpoint(current.scene, current.annotation));
    }
    cancelDrag();
  }

  function nudge(target: DimensionHitTarget, endpoint: DimensionHandle, dx: number, dy: number) {
    const scene = scenes.current[target.ownerId];
    const original = scene?.annotations.find((item) => item.annotation.kind === target.kind)?.annotation;
    if (!original || drag.current) return;
    if (endpoint === 'label') {
      const next = moveLabel(original, target, { x: target.label.x + dx, y: target.label.y + dy });
      onLabelCommit(target, { labelOffset: next.labelOffset }); return;
    }
    setLabelMoving(false);
    const start = endpoint === 'line' ? original.from : mode === 'extensions' ? dimensionExtensionPoint(original, endpoint, scene.adjustment?.dimensionFrame ?? scene.productRect) : original[endpoint];
    if (endpoint !== 'line' && mode === 'extensions' && !(original.kind === 'height' ? dx : dy)) return;
    const desired = { x: start.x + dx, y: start.y + dy };
    const annotation = endpoint === 'line' ? previewDimensionTranslation(scene, original, { x: dx, y: dy })
      : mode === 'extensions' ? previewDimensionExtension(scene, original, endpoint, desired) : previewDimensionEndpoint(original, endpoint, desired);
    if (JSON.stringify(annotation) !== JSON.stringify(original)) {
      onCommit(target.ownerId, commitDimensionEndpoint(scene, preserveManualLabelPosition(scene, annotation)));
    }
  }

  return {
    scenes, targets, textTarget, labelTarget, labelMoving, preview, clear, begin, move, finish, cancelDrag, nudge, mode,
    toggleLabelMoving: () => { cancelDrag(); setTextTarget(undefined); setLabelMoving((current) => !current); },
    setLabelTarget: (next: typeof labelTarget) => { setLabelTarget(next); if (!next) setLabelMoving(false); },
    setTextTarget: (next: DimensionHitTarget | undefined) => { setTextTarget(next); if (next) { setLabelMoving(false); setLabelTarget({ ownerId: next.ownerId, kind: next.kind }); } },
    setMode: (next: Drag['mode']) => { cancelDrag(); setLabelMoving(false); setMode(next); },
    updateTargets: (next: DimensionHitTarget[]) => setTargets((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next),
    display: (ownerId: string, annotation: DimensionAnnotation) => preview?.ownerId === ownerId && preview.annotation.kind === annotation.kind ? preview.annotation : annotation,
  };
}
