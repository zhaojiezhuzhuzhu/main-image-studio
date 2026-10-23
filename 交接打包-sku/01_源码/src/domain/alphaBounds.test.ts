import { expect, it } from 'vitest';
import { alphaBounds } from './alphaBounds';
it('returns the visible alpha pixel bounding box',()=>{
 const rgba=new Uint8ClampedArray(4*4*4);
 for(const [x,y] of [[1,1],[2,1],[1,2],[2,2]]) rgba[(y*4+x)*4+3]=255;
 expect(alphaBounds(rgba,4,4)).toEqual({x:1,y:1,width:2,height:2});
});
