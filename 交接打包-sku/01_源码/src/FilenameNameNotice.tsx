import { filenameNameCandidate, type FilenameNamePolicy } from './domain/modelFromFilename';

export function FilenameNameNotice({ filename, policy, current, manuallyEdited, onApply }: {
  filename: string; policy: FilenameNamePolicy; current?: string; manuallyEdited?: boolean; onApply?: (value: string) => void;
}) {
  const candidate = filenameNameCandidate(filename, policy);
  const same = current?.trim() === candidate.value;
  const status = !candidate.value ? candidate.issue
    : current === undefined ? `文件名名称：${candidate.value}`
    : same ? `${manuallyEdited ? '已保留手动名称，与文件名提取结果一致' : '文件名提取结果'}：${candidate.value}`
    : `${manuallyEdited ? '已保留手动内容；' : current.trim() ? '已保留当前名称；' : ''}文件名建议：${candidate.value}`;
  return <div className="filename-name-notice">
    <p className="hint" role="status">{status}{candidate.value && candidate.issue ? `；${candidate.issue}` : ''}</p>
    {candidate.parts.details.length > 0 && <p className="hint">其他文件信息：{candidate.parts.details.join('；')}</p>}
    {onApply && candidate.value && !same && <button type="button" className="quick-secondary" onClick={() => onApply(candidate.value)}>采用文件名名称</button>}
  </div>;
}
