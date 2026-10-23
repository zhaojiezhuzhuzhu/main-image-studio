import { describe, expect, it } from 'vitest';
import { getDimensionGeometry } from './dimensionGeometry';

describe('尺寸标注几何', () => {
  it('手动偏移只改变文字位置，保留主线与箭头', () => {
    const from = { x: 100, y: 300 }, to = { x: 400, y: 200 };
    const rect = { x: 100, y: 400, width: 500, height: 300 }, size = { width: 150, height: 40 };
    const original = getDimensionGeometry(from, to, '140/160cm', rect, size);
    const moved = getDimensionGeometry(from, to, '140/160cm', rect, size, { x: -42, y: 75 });
    expect(moved).toEqual({ ...original, label: { ...original.label, x: original.label.x - 42, y: original.label.y + 75 } });
  });
  it('将尺寸文字贴近尺寸线的法向一侧，并输出两端箭头', () => {
    const geometry = getDimensionGeometry({ x: 100, y: 100 }, { x: 300, y: 100 }, '239cm');
    expect(geometry.label.y).toBeLessThan(100);
    expect(geometry.arrows).toHaveLength(2);
  });
  it('places an inclined label on the side farther from the product and off the line',()=>{
    const geometry=getDimensionGeometry({x:180,y:200},{x:230,y:500},'120cm',{x:300,y:220,width:500,height:400});
    expect(geometry.label.x).toBeLessThan(205);
    expect(geometry.label.distanceFromLine).toBeGreaterThan(80);
  });
});
