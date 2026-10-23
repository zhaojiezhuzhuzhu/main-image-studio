import type { Rect } from './domain/dimensionGeometry';
import type { CSSProperties } from 'react';

export function CanvasModelEditor({ box, value, fontSize, fontFamily, color, background, paddingX, radius, letterSpacing, multiline, onChange, onFocus, onBlur }: {
  box: Rect;
  value: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  background?: string;
  paddingX?: number;
  radius?: number;
  letterSpacing?: number;
  multiline?: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const Element = multiline ? 'textarea' : 'input';
  return <Element
    className="canvas-model-editor"
    aria-label="画布产品型号"
    title="点击编辑产品型号"
    placeholder="产品型号"
    value={value}
    style={{ left: `${box.x / 1440 * 100}%`, top: `${box.y / 1440 * 100}%`, width: `${box.width / 1440 * 100}%`, height: `${box.height / 1440 * 100}%`, fontSize: fontSize ? `${fontSize / 1440 * 100}cqw` : undefined, fontFamily, letterSpacing: letterSpacing === undefined ? undefined : `${letterSpacing / 1440 * 100}cqw`, padding: paddingX === undefined ? undefined : `0 ${paddingX / 1440 * 100}cqw`, borderRadius: radius === undefined ? undefined : `${radius / 1440 * 100}cqw`, ...(multiline ? { resize: 'none', lineHeight: `${50 / 1440 * 100}cqw`, overflow: 'hidden', whiteSpace: 'pre-wrap' } : {}), '--model-text-color': color, '--model-background': background } as CSSProperties}
    onChange={(event) => onChange(event.target.value)}
    onFocus={onFocus}
    onBlur={onBlur}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (!event.nativeEvent.isComposing && ((event.key === 'Enter' && !multiline) || event.key === 'Escape')) event.currentTarget.blur();
    }}
  />;
}
