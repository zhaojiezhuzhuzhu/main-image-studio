export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type DimensionLabelSize = { width: number; height: number; orientation?: 'line' };
export function dimensionLabelAngle(from: Point, to: Point, size: DimensionLabelSize): number {
  if (size.orientation !== 'line') return 0;
  let angle = Math.atan2(to.y - from.y, to.x - from.x);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return angle;
}
export function dimensionLabelBounds(from: Point, to: Point, size: DimensionLabelSize) {
  const angle = dimensionLabelAngle(from, to, size), c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  return { width: size.width * c + size.height * s, height: size.width * s + size.height * c };
}
export function getDimensionGeometry(from: Point, to: Point, text: string, product?: Rect, labelSize?: DimensionLabelSize, labelOffset?: Point) {
  const dx=to.x-from.x, dy=to.y-from.y, length=Math.hypot(dx,dy)||1, nx=-dy/length, ny=dx/length;
  const size=labelSize ? dimensionLabelBounds(from, to, labelSize) : {width:text.length*32,height:62};
  const offset=labelSize?.orientation === 'line' ? labelSize.height/2+18 : Math.abs(nx)*size.width/2+Math.abs(ny)*size.height/2+18;
  const mid={x:(from.x+to.x)/2,y:(from.y+to.y)/2};
  const candidates=[{x:mid.x+nx*offset,y:mid.y+ny*offset},{x:mid.x-nx*offset,y:mid.y-ny*offset}];
  let chosen=candidates[1];
  if(product){const center={x:product.x+product.width/2,y:product.y+product.height/2};const distance=(p:Point)=>Math.hypot(p.x-center.x,p.y-center.y);chosen=distance(candidates[0])>distance(candidates[1])?candidates[0]:candidates[1]}
  return { label:{x:chosen.x+(labelOffset?.x ?? 0),y:chosen.y+(labelOffset?.y ?? 0),text,distanceFromLine:offset}, arrows:[{x:from.x,y:from.y,angle:Math.atan2(dy,dx)},{x:to.x,y:to.y,angle:Math.atan2(dy,dx)+Math.PI}] };
}
