export type FilenameNamePolicy = { includeSpecification: boolean; suffix?: string };
export type ProductFilenameParts = { model: string | null; specification: string; details: string[]; ambiguous: boolean };

const ASSET_DESCRIPTION = /^(?:透明素材|透明图|透明底|白底图|白底|抠图|产品图|主图|渲染图|效果图|正面图|侧面图|背面图)$/;
const PRODUCT_WORD = /(?:沙发|脚踏|床|桌|椅|凳|柜|几|架|床垫)/;
const MATERIAL_OR_COLOR = /(?:颜色|材质|色|洞石|岩板|大理石|木纹|贝母白|米白|胡桃木|橡木)/;

export function parseProductFilename(filename: string): ProductFilenameParts {
  const stem = filename.split(/[\\/]/).pop()!.replace(/\.(?:png|jpe?g|webp|avif|tiff?|bmp)$/i, '')
    .replace(/(?:\s*[（(]\d+[)）])+$/, '').trim().replace(/[－—–]/g, '-');
  const first = stem.match(/^[A-Za-z][A-Za-z0-9]*/)?.[0];
  let model = first && /\d/.test(first) ? first : null;
  let rest = model ? stem.slice(model.length) : stem;
  if (model) {
    // 连字符段必须完整匹配；160cm、1.6m等规格不能吞进型号。
    let suffix: RegExpMatchArray | null;
    while ((suffix = rest.match(/^-([A-Za-z0-9]+)(?=$|[-_\s（(\u3400-\u9fff])/))) {
      if (/^\d+(?:mm|cm|m|x\d.*)$/i.test(suffix[1])) break;
      model += suffix[0];
      rest = rest.slice(suffix[0].length);
    }
    if (rest && !/^[-_\s（(\u3400-\u9fff]/.test(rest)) { model = null; rest = stem; }
  }
  const details: string[] = [], specifications: string[] = [];
  let size = '';
  for (const raw of rest.split(/[-_]+/).map((part) => part.trim()).filter(Boolean)) {
    const contentText = raw.split(/\s+/).filter((part) => !ASSET_DESCRIPTION.test(part)).join(' ');
    const text = contentText.replace(/[（(]([^（）()]+)[)）]/g, (whole, content: string) => {
      if (!MATERIAL_OR_COLOR.test(content)) return whole;
      details.push(content.trim());
      return '';
    }).trim();
    if (!text) continue;
    if (PRODUCT_WORD.test(text)) { specifications.push(`${size}${text}`); size = ''; }
    else if (/^\d+(?:\.\d+)?(?:[x×*]\d+(?:\.\d+)?){0,2}\s*(?:mm|cm|m|米|厘米|毫米)$/i.test(text)) {
      if (size) details.push(size);
      size = text;
    } else details.push(text);
  }
  if (size) details.push(size);
  // “沙发床 / 双人沙发床”取完整的后者；两个不同尺寸的名称不擅自择一。
  const unique = [...new Set(specifications)];
  const specific = unique.filter((value) => !unique.some((other) => other !== value && other.includes(value)));
  return { model, specification: specific.length === 1 ? specific[0] : '', details: [...new Set([...details, ...(specific.length > 1 ? specific : [])])], ambiguous: specific.length > 1 };
}

export function filenameNameCandidate(filename: string, policy: FilenameNamePolicy) {
  const parts = parseProductFilename(filename);
  const value = parts.model ? `${parts.model}${policy.includeSpecification && parts.specification ? ` ${parts.specification}` : policy.suffix ?? ''}` : '';
  const issue = !parts.model ? '文件名中未识别到完整型号，请手动填写'
    : policy.includeSpecification && parts.ambiguous ? '存在多个规格候选，请核对完整名称'
    : policy.includeSpecification && !parts.specification ? '仅识别到型号，规格待补充' : '';
  return { value, issue, parts };
}

export function modelFromFilename(filename: string): string | null {
  return parseProductFilename(filename).model;
}

export function resolveModelOnUpload(current: string, manuallyEdited: boolean, filename: string, policy: FilenameNamePolicy = { includeSpecification: false }): string {
  if (manuallyEdited || current.trim()) return current;
  return filenameNameCandidate(filename, policy).value || current;
}
