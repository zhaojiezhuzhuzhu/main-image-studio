export type Rect = { x: number; y: number; width: number; height: number };
export const SOFA_SINGLE_SAFE_AREA = { left: 70, right: 70, top: 250, bottom: 160 };
const CANVAS = 1440;
export function getSofaSingleLayout(pointWidths: number[]) {
  const safeWidth = CANVAS - SOFA_SINGLE_SAFE_AREA.left - SOFA_SINGLE_SAFE_AREA.right;
  const gap = 30;
  const populated=pointWidths.filter((width)=>width>0);
  const idealPadding=populated.length?Math.min(50,Math.max(24,(safeWidth-gap*2-pointWidths.reduce((sum,width)=>sum+width,0))/(populated.length*2))):36;
  let widths = pointWidths.map((width) => width>0?width+idealPadding*2:150);
  let total = widths.reduce((sum, width) => sum + width, 0) + gap * 2;
  if(total>safeWidth){const available=safeWidth-gap*2;const base=150;const extra=available-base*3;const weightTotal=pointWidths.reduce((sum,width)=>sum+Math.max(width,1),0);widths=pointWidths.map((width)=>base+extra*Math.max(width,1)/weightTotal);total=safeWidth;}
  let x = (CANVAS - total) / 2;
  const sellingPoints = widths.map((width) => { const box = { x, y: 1182, width, height: 98 }; x += box.width + gap; return box; });
  return {
    modelBadge: { x: 70, y: 270, height: 78 },
    productArea: { x: 70, y: 390, width: 1300, height: 730 },
    subjectSafeArea: { x: 70, y: 398, width: 1300, height: 734 },
    sellingPoints,
  };
}
