import { describe, expect, it } from 'vitest';
import { applySellingPointTypography, canvasFontFromPs, psPointToCanvasPx } from './typography';

describe('Photoshop 72 ppi typography',()=>{
  it('maps one PS point to one canvas pixel at 72 ppi',()=>{
    expect(psPointToCanvasPx(60)).toBe(60);
    expect(psPointToCanvasPx(50)).toBe(50);
    expect(psPointToCanvasPx(46)).toBe(46);
  });
  it('emits pixel canvas fonts rather than CSS point units',()=>{
    expect(canvasFontFromPs(60,'Montserrat')).toBe('60px Montserrat');
  });
  it('applies the selling-point mixed-script font and zero tracking',()=>{
    const context = { font: '', letterSpacing: '12px' };

    applySellingPointTypography(context);

    expect(context.font).toBe('400 50px Montserrat, "方正兰亭中黑_GBK", sans-serif');
    expect(context.letterSpacing).toBe('0px');
  });
});
