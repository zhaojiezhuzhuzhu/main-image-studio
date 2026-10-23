import { describe, expect, it } from 'vitest';
import { SOFA_SINGLE_SAFE_AREA, getSofaSingleLayout } from './sofaSingleLayout';

describe('沙发单品版式', () => {
  it('把型号标签放入顶部预留以下的安全区', () => {
    const layout = getSofaSingleLayout([120, 120, 120]);
    expect(SOFA_SINGLE_SAFE_AREA).toEqual({ left: 70, right: 70, top: 250, bottom: 160 });
    expect(layout.modelBadge.x).toBe(70);
    expect(layout.modelBadge.y).toBeGreaterThanOrEqual(250);
  });
  it('为每个卖点输出固定高度且独立的边框', () => {
    const layout = getSofaSingleLayout([180, 250, 200]);
    expect(layout.sellingPoints).toHaveLength(3);
    expect(layout.sellingPoints.every((box) => box.height === 98)).toBe(true);
    expect(layout.sellingPoints[1].x - (layout.sellingPoints[0].x + layout.sellingPoints[0].width)).toBeGreaterThanOrEqual(30);
  });
  it('uses the same horizontal padding for all selling point boxes',()=>{
    const widths=[160,280,360]; const layout=getSofaSingleLayout(widths);
    const paddings=layout.sellingPoints.map((box,index)=>(box.width-widths[index])/2);
    expect(paddings[0]).toBeCloseTo(paddings[1]);expect(paddings[1]).toBeCloseTo(paddings[2]);
  });
  it('keeps all boxes inside the safe area when text overflows capacity',()=>{
    const layout=getSofaSingleLayout([300,420,900]);
    expect(layout.sellingPoints[0].x).toBeGreaterThanOrEqual(70);
    const last=layout.sellingPoints[2];expect(last.x+last.width).toBeLessThanOrEqual(1370);
  });
  it('reserves 50px between the annotated subject, model badge, and selling points',()=>{
    const layout=getSofaSingleLayout([180,250,200]);
    expect(layout.subjectSafeArea).toEqual({x:70,y:398,width:1300,height:734});
    expect(layout.subjectSafeArea.y-layout.modelBadge.y-layout.modelBadge.height).toBe(50);
    expect(layout.sellingPoints[0].y-layout.subjectSafeArea.y-layout.subjectSafeArea.height).toBe(50);
  });
});
