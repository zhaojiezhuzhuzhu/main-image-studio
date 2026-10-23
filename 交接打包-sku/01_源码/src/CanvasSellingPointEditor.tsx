import type { Rect } from './domain/dimensionGeometry';
import type { CSSProperties } from 'react';
import type { SellingPointStyle } from './templates/types';

export function CanvasSellingPointEditor({ box, index, value, textStyle, maxLength = 14, onChange, onFocus }: {
  box: Rect;
  index: number;
  value: string;
  maxLength?: number;
  textStyle?: SellingPointStyle;
  onChange: (value: string) => void;
  onFocus?: () => void;
}) {
  const inset = textStyle?.borderWidth ?? 4;
  return <input
    className="canvas-selling-editor"
    aria-label={`画布卖点 ${index + 1}`}
    title="点击编辑卖点"
    placeholder={`卖点 ${index + 1}`}
    maxLength={maxLength}
    value={value}
    style={{ left: `${(box.x + inset) / 1440 * 100}%`, top: `${(box.y + inset) / 1440 * 100}%`, width: `${(box.width - inset * 2) / 1440 * 100}%`, height: `${(box.height - inset * 2) / 1440 * 100}%`, fontSize: textStyle ? `${textStyle.fontSize / 1440 * 100}cqw` : undefined, fontFamily: textStyle?.fontFamily, '--selling-point-color': textStyle?.color } as CSSProperties}
    onChange={(event) => onChange(event.target.value)}
    onFocus={onFocus}
    onPointerDown={(event) => event.stopPropagation()}
    onClick={(event) => event.stopPropagation()}
    onKeyDown={(event) => {
      if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === 'Escape')) event.currentTarget.blur();
    }}
  />;
}
