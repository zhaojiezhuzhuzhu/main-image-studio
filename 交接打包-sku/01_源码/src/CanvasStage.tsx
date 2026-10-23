import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CanvasPanelHeader } from './WorkbenchChrome';

const CANVAS_SIZE = 1440;
const PADDING = 12;
const MIN_ZOOM = .1;
const MAX_ZOOM = 3;

export function CanvasStage({ title, status, children, maxFitSize = 736 }: {
  title: string;
  status: string;
  children: ReactNode;
  maxFitSize?: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState(maxFitSize);
  const [manualZoom, setManualZoom] = useState<number>();
  const zoom = manualZoom ?? fitSize / CANVAS_SIZE;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pendingAnchor = useRef<{ x: number; y: number; clientX: number; clientY: number } | undefined>(undefined);
  const displaySize = CANVAS_SIZE * zoom;

  useLayoutEffect(() => {
    const element = viewport.current!;
    const measure = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      setFitSize(Math.max(1, Math.min(element.clientWidth - PADDING * 2, element.clientHeight - PADDING * 2, maxFitSize)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [maxFitSize]);

  function zoomBy(factor: number, pointer?: { clientX: number; clientY: number }) {
    const element = viewport.current!;
    const canvas = element.querySelector('canvas');
    if (!canvas) return;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * factor));
    if (next === zoomRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const viewRect = element.getBoundingClientRect();
    const clientX = pointer?.clientX ?? viewRect.left + element.clientLeft + element.clientWidth / 2;
    const clientY = pointer?.clientY ?? viewRect.top + element.clientTop + element.clientHeight / 2;
    pendingAnchor.current = { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height, clientX, clientY };
    zoomRef.current = next;
    setManualZoom(next);
  }

  useLayoutEffect(() => {
    const element = viewport.current!;
    const anchor = pendingAnchor.current;
    pendingAnchor.current = undefined;
    if (manualZoom === undefined) {
      element.scrollLeft = 0; element.scrollTop = 0;
    } else if (anchor) {
      const rect = element.querySelector('canvas')!.getBoundingClientRect();
      element.scrollLeft += rect.left + rect.width * anchor.x - anchor.clientX;
      element.scrollTop += rect.top + rect.height * anchor.y - anchor.clientY;
    }
  }, [displaySize, manualZoom]);

  useEffect(() => {
    const element = viewport.current!;
    const wheel = (event: WheelEvent) => {
      if (!event.altKey || !event.deltaY) return;
      const rect = element.querySelector('canvas')!.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
      event.preventDefault();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      zoomBy(Math.exp(-Math.max(-120, Math.min(120, delta)) * .002), event);
    };
    // React 的滚轮监听默认被动；仅在画布内使用 Alt 时阻止浏览器滚动。
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  function fit() {
    pendingAnchor.current = undefined;
    zoomRef.current = fitSize / CANVAS_SIZE;
    setManualZoom(undefined);
    viewport.current!.scrollLeft = 0; viewport.current!.scrollTop = 0;
  }

  return <>
    <CanvasPanelHeader title={title} status={status} zoom={{ percent: Math.round(zoom * 100), isFit: manualZoom === undefined,
      canZoomOut: zoom > MIN_ZOOM, canZoomIn: zoom < MAX_ZOOM, onZoomOut: () => zoomBy(1 / 1.2), onZoomIn: () => zoomBy(1.2), onFit: fit }}/>
    <div className="stage canvas-stage">
      <div ref={viewport} className="canvas-viewport" role="region" aria-label="画布查看区域" tabIndex={0}>
        <div className="canvas-viewport-content" style={{ width: displaySize + PADDING * 2, height: displaySize + PADDING * 2, '--canvas-display-size': `${displaySize}px` } as CSSProperties}>
          {children}
        </div>
      </div>
    </div>
  </>;
}
