import type { ModelBadge, SingleLayout, TextMeasure } from '../templates/types';

// P21组合蓝标：35pt不缩字，按搭配分段；保留原文，最多两行，高100px。
export function multilineModelBadge(context: TextMeasure, model: string, layout: Pick<SingleLayout, 'modelBadge'>, fontFamily: string, maxWidth = 856, padding = 20, fontSize = 35): ModelBadge {
  const text = model.trim() || '产品型号及完整规格';
  context.font = `${fontSize}px ${fontFamily}`;
  const available = maxWidth - padding * 2, lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    let rest = paragraph;
    while (context.measureText(rest).width > available) {
      let end = 1;
      while (end < rest.length && context.measureText(rest.slice(0, end + 1)).width <= available) end++;
      const plus = rest.lastIndexOf('+', end - 1);
      if (plus > 0) end = plus;
      lines.push(rest.slice(0, end)); rest = rest.slice(end);
    }
    lines.push(rest);
  }
  const width = Math.max(...lines.map((line) => context.measureText(line).width)) + padding * 2;
  const wrapped = lines.length > 1;
  return { text, fontSize, box: { ...layout.modelBadge, width, height: wrapped ? 100 : layout.modelBadge.height },
    ...(wrapped ? { lines } : {}),
    issue: lines.length > 2 || /[\t\u2028\u2029]/.test(text) || width > maxWidth ? '完整型号超出两行蓝标区域，请核对或拆分SKU；原文已保留，不缩小字号或截断' : null };
}
