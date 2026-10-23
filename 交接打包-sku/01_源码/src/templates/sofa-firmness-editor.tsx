import { normalizeSofaFirmness, type SofaFirmness } from '../domain/sofaFirmness';
import { InputDetails, InputToggle } from '../WorkbenchInputCards';
import type { OptionsEditorProps, SingleTemplateOptions } from './types';

export function SofaFirmnessEditor({ value, onChange }: OptionsEditorProps<SingleTemplateOptions>) {
  const firmness = normalizeSofaFirmness(value.sofaFirmness);
  const update = (change: Partial<SofaFirmness>) => onChange((current) => ({ ...current, sofaFirmness: { ...normalizeSofaFirmness(current.sofaFirmness), ...change } }));
  return <InputToggle title="显示坐感软硬度" checked={firmness.enabled} onChange={(enabled) => update({ enabled })}>
    <>
      <p className="hint">数值与说明按产品资料填写。指示位置单独调整，不根据分数自动换算；开启后会为标识留出空间。</p>
      <label>坐感数值（0–10）<input inputMode="decimal" value={firmness.value} placeholder="填写实际数值，最多1位小数" onChange={(event) => update({ value: event.target.value })}/></label>
      <label>坐感说明<input value={firmness.label} placeholder="按实际资料填写" onChange={(event) => update({ label: event.target.value })}/></label>
      <InputDetails title="指示位置微调"><label>指示位置（%）<input type="range" min={0} max={100} step={.1} value={firmness.position} onChange={(event) => update({ position: Number(event.target.value) })}/></label>
      <label>指示位置数值（%）<input type="number" min={0} max={100} step={.1} value={firmness.position} onChange={(event) => { if (Number.isFinite(event.target.valueAsNumber)) update({ position: Math.max(0, Math.min(100, event.target.valueAsNumber)) }); }}/></label>
      <p className="hint">0%靠硬端，100%靠软端；数值框可用方向键微调。原资料未提供完整的五档参考线边界，请按已确认的坐感位置核对。</p>
      </InputDetails>
    </>
  </InputToggle>;
}
