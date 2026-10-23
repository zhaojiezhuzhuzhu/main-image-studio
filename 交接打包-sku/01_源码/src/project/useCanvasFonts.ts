import { useEffect, useState } from 'react';

// local() 匹配完整名称或 PostScript 名称，不能仅依赖字体族名称。
export const CANVAS_FONT_SOURCES: Record<string, string[]> = {
  Montserrat: ['Montserrat-Regular', 'Montserrat Regular'],
  'Montserrat Semi Bold': ['Montserrat-SemiBold', 'Montserrat Semi Bold'],
  '方正兰亭中粗黑_GBK': ['方正兰亭中粗黑_GBK', 'FZLanTingHeiS-DB1-GBK', 'FZLTZCHK--GBK1-0'],
  '方正兰亭黑_GBK': ['方正兰亭黑_GBK', 'FZLanTingHei-R-GBK', 'FZLTHK--GBK1-0'],
  '方正兰亭粗黑_GBK': ['方正兰亭粗黑_GBK', 'FZLanTingHei-B-GBK', 'FZLTCHK--GBK1-0'],
  '方正兰亭中黑_GBK': ['方正兰亭中黑_GBK', 'FZLanTingHei-DB-GBK', 'FZLTZHK--GBK1-0'],
  '方正兰亭准黑_GBK': ['方正兰亭准黑_GBK', 'FZLanTingHei-M-GBK', 'FZLTZHUNHK--GBK1-0'],
  'FZLanTingHeiS-DB-GBK': ['FZLanTingHeiS-DB-GBK', 'FZLanTingHei-DB-GBK', 'FZLTZHK--GBK1-0'],
  'FZLanTingHeiS-R-GBK': ['FZLanTingHeiS-R-GBK', '方正兰亭准黑_GBK', 'FZLanTingHei-M-GBK', 'FZLTZHUNHK--GBK1-0'],
};

export function canvasFontSource(family: string): string {
  return (CANVAS_FONT_SOURCES[family] ?? [family]).map((name) => `local("${name}")`).join(', ');
}

export function missingCanvasFonts(families: readonly string[], check: (font: string) => boolean): string[] {
  return families.filter((family) => !check(`72px "${family}"`));
}

export async function loadCanvasFonts(families: readonly string[], load: (family: string) => Promise<unknown>): Promise<string[]> {
  const results = await Promise.allSettled(families.map(load));
  return families.filter((_, index) => results[index].status === 'rejected');
}

export function useCanvasFonts(families: readonly string[]) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(async () => {
      // fonts.check 对未安装且没有 @font-face 的字体也可能返回 true；用 local 实际加载核验。
      const unavailable = await loadCanvasFonts(families, async (family) => {
        const face = await new FontFace(family, canvasFontSource(family)).load();
        if (!cancelled) document.fonts.add(face);
      });
      if (cancelled) return;
      setMissing(unavailable);
      setStatus(unavailable.length ? 'missing' : 'ready');
    }).catch(() => {
      if (!cancelled) { setMissing([...families]); setStatus('missing'); }
    });
    return () => { cancelled = true; };
  }, [families]);

  return {
    status,
    missing,
    issue: status === 'loading'
      ? '正在加载 SKU 规范字体，请稍候'
      : missing.length ? `缺少 SKU 规范字体：${missing.join('、')}` : '',
  };
}
