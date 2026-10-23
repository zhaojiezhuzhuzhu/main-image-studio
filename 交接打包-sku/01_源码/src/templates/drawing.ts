import { canvasFontFromPs } from '../domain/typography';
import type { DimensionLabel, SellingPointStyle, TextMeasure } from './types';

export function measurePlainDimension(context: TextMeasure, text: string, font: string, fallbackHeight: number, lineGap = 0): DimensionLabel {
  context.font = font;
  const lines = text.split('\n');
  const metrics = lines.map((line) => context.measureText(line));
  const lineHeight = Math.max(...metrics.map((metric) => metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent || fallbackHeight));
  return { width: Math.max(...metrics.map((metric) => metric.width)), height: lineHeight * lines.length + lineGap * (lines.length - 1),
    runs: lines.map((text, index) => ({ text, font, x: 0, y: (index - (lines.length - 1) / 2) * (lineHeight + lineGap) })) };
}

export function applyTemplateSellingPointFont(context: Pick<CanvasRenderingContext2D, 'font' | 'letterSpacing'>, style: SellingPointStyle) {
  context.font = `400 ${canvasFontFromPs(style.fontSize, style.fontFamily)}`;
  context.letterSpacing = '0px';
}
