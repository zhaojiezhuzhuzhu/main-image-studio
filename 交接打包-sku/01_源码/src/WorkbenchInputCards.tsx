import { useEffect, useState, type ChangeEvent, type ReactNode, type Ref } from 'react';
import type { ProductImage } from './project/productImage';
import { FurnitureIcon, type FurnitureIconName } from './ui/FurnitureIcon';

export type InputSlots = {
  main(fields?: ReactNode): ReactNode;
  accessory(id: string, fields?: ReactNode): ReactNode;
};

// Editors can also be rendered on their own without the workbench's image controls.
export const standaloneInputSlots: InputSlots = {
  main: (fields) => <>{fields}</>,
  accessory: (id, fields) => <div key={id}>{fields}</div>,
};

export function InputCard({ title, children, image, quickFields, selected, onSelect, className = '' }: {
  title: string; children?: ReactNode; image?: ReactNode; quickFields?: ReactNode;
  selected?: boolean; onSelect?: () => void; className?: string;
}) {
  return <section className={`input-card ${selected ? 'is-selected' : ''} ${className}`} aria-label={`${title}资料`}>
    <div className={`input-card-header${image ? ' has-image' : ''}`}>
      {image}
      <div className="input-card-heading">
        {onSelect ? <button type="button" className="input-card-select" aria-pressed={Boolean(selected)} onClick={onSelect}>{title}</button> : <h3>{title}</h3>}
        {quickFields}
      </div>
    </div>
    {children && <div className="input-card-fields">{children}</div>}
  </section>;
}

export function InputImage({ image, icon, label, inputRef, onChange, disabled = false }: {
  image?: ProductImage; icon: FurnitureIconName; label: string; inputRef?: Ref<HTMLInputElement>; onChange(event: ChangeEvent<HTMLInputElement>): void; disabled?: boolean;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!image || typeof URL.createObjectURL !== 'function') { setUrl(undefined); return; }
    const next = URL.createObjectURL(image.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [image]);
  return <label className="input-image object-thumb object-thumb-upload small" title="支持 PNG、JPG、WebP；白底产品图可直接上传" aria-disabled={disabled}>
    {url ? <img src={url} alt=""/> : <FurnitureIcon name={icon}/>}
    <span>{disabled ? '导入中' : image ? '换图' : '上传'}</span>
    <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label={label} aria-description="支持 PNG、JPG、WebP，白底产品图自动抠图" disabled={disabled} onChange={onChange}/>
  </label>;
}

export function InputDetails({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="input-details" open={open}><summary>{title}</summary><div className="input-details-fields">{children}</div></details>;
}

export function InputToggle({ title, checked, onChange, children }: {
  title: string; checked: boolean; onChange(checked: boolean): void; children?: ReactNode;
}) {
  return <div className="input-option">
    <label className="input-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span>{title}</span><small>{checked ? '开启' : '关闭'}</small></label>
    {checked && children && <div className="input-option-fields">{children}</div>}
  </div>;
}

export function InputChoice<T extends string>({ label, value, choices, onChange }: {
  label: string; value: T; choices: readonly { value: T; label: string }[]; onChange(value: T): void;
}) {
  return <div className="input-choice"><span>{label}</span><div role="group" aria-label={label}>{choices.map((choice) => <button type="button" key={choice.value} aria-pressed={value === choice.value} onClick={() => onChange(choice.value)}>{choice.label}</button>)}</div></div>;
}
