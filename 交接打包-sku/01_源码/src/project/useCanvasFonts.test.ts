import { SINGLE_TEMPLATE_RULES, COMBINATION_TEMPLATE_RULES } from '../templates/registry';
import { describe, expect, it } from 'vitest';
import { canvasFontSource, loadCanvasFonts, missingCanvasFonts } from './useCanvasFonts';

describe('SKU 规范字体核验', () => {
  it('使用已安装字体的完整名和PostScript别名，保留旧CSS族名', () => {
    expect(canvasFontSource('Montserrat')).toContain('local("Montserrat-Regular")');
    expect(canvasFontSource('Montserrat Semi Bold')).toContain('local("Montserrat-SemiBold")');
    expect(canvasFontSource('方正兰亭粗黑_GBK')).toContain('local("FZLTCHK--GBK1-0")');
    expect(canvasFontSource('方正兰亭准黑_GBK')).toContain('local("FZLTZHUNHK--GBK1-0")');
    expect(canvasFontSource('FZLanTingHeiS-DB-GBK')).toContain('local("FZLanTingHei-DB-GBK")');
    expect(canvasFontSource('FZLanTingHeiS-R-GBK')).toContain('local("FZLanTingHei-M-GBK")');
  });
  it('reports only unavailable required fonts', () => {
    const available = new Set(['72px "Montserrat"', '72px "方正兰亭中黑_GBK"']);
    expect(missingCanvasFonts(SINGLE_TEMPLATE_RULES['sofa-single'].requiredFonts, (font) => available.has(font))).toEqual([]);
    expect(missingCanvasFonts(COMBINATION_TEMPLATE_RULES['sofa-combination'].requiredFonts, (font) => available.has(font))).toEqual([
      'FZLanTingHeiS-DB-GBK',
      'FZLanTingHeiS-R-GBK',
    ]);
  });
  it('软床需要准黑，实际字体加载失败必须报告', async () => {
    expect(missingCanvasFonts(SINGLE_TEMPLATE_RULES['soft-bed-single'].requiredFonts, (font) => !font.includes('准黑'))).toEqual(['方正兰亭准黑_GBK']);
    expect(await loadCanvasFonts(SINGLE_TEMPLATE_RULES['soft-bed-single'].requiredFonts, async (family) => {
      if (family === '方正兰亭准黑_GBK') throw new Error('missing');
    })).toEqual(['方正兰亭准黑_GBK']);
  });
});
