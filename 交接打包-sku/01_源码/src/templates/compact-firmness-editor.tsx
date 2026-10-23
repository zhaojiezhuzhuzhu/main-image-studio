import { compactFirmnessBand, type CompactFirmness, type CompactFirmnessStyle } from '../domain/compactFirmness';

export function CompactFirmnessEditor({ value, onChange, name, style }: { value: CompactFirmness; onChange(value: CompactFirmness): void; name: string; style: CompactFirmnessStyle }) {
  const band = compactFirmnessBand(value.faces[0].value, style), sameBand = value.mode === 'double' && band !== null && band === compactFirmnessBand(value.faces[1].value, style);
  const updateFace = (index: number, change: Partial<CompactFirmness['faces'][number]>) => onChange({ ...value, faces: value.faces.map((face, i) => i === index ? { ...face, ...change } : face) as CompactFirmness['faces'] });
  return <>
    <label>{name}软硬度形式<select aria-label={`${name}软硬度形式`} value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value === 'double' ? 'double' : 'single' })}><option value="single">单面睡</option><option value="double">双面睡</option></select></label>
    {(value.mode === 'single' ? value.faces.slice(0, 1) : value.faces).map((face, i) => {
      const faceName = `${name}${value.mode === 'single' ? '' : i === 0 ? '正面' : '反面'}`, faceBand = compactFirmnessBand(face.value, style), step = 100 / style.bands.length;
      return <div key={i}><label>{faceName}软硬度数值<input aria-label={`${faceName}软硬度数值`} inputMode="decimal" value={face.value} onChange={(event) => updateFace(i, { value: event.target.value })}/></label>
        {!sameBand && <><label>{faceName}指示位置（%）<input aria-label={`${faceName}指示位置（%）`} type="number" min={0} max={100} step={.1} value={face.position} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) updateFace(i, { position: Math.max(0, Math.min(100, event.target.valueAsNumber)) }); }}/></label>
          <p className="hint">{faceBand === null ? '数值大于0且不超过10，最多1位小数。' : `${style.bands[faceBand].label}：在${faceBand * step}%–${(faceBand + 1) * step}%内微调位置。`}</p></>}
      </div>;
    })}
    <p className="hint">{sameBand ? '同档使用固定位置；数值相同合并“正反面”，不同数值成对显示。' : '按真实床垫资料填写；改数值不会自动移动圆标。'}切换形式会保留另一面的资料。</p>
  </>;
}
