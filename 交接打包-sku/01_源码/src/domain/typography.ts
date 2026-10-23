export const PS_CANVAS_PPI = 72;

export function psPointToCanvasPx(points: number, canvasPpi = PS_CANVAS_PPI): number {
  return points * canvasPpi / 72;
}

export function canvasFontFromPs(points: number, family: string, canvasPpi = PS_CANVAS_PPI): string {
  return `${psPointToCanvasPx(points, canvasPpi)}px ${family}`;
}

type SellingPointTextContext = {
  font: string;
  letterSpacing: string;
};

export function applySellingPointTypography(context: SellingPointTextContext): void {
  context.font = `400 ${canvasFontFromPs(50, 'Montserrat, "方正兰亭中黑_GBK", sans-serif')}`;
  context.letterSpacing = '0px';
}
