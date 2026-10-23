export function DimensionLinkControls({ fixed, onChange }: { fixed: boolean; onChange: (fixed: boolean) => void }) {
  return <div className="dimension-link-controls">
    <div className="dimension-edit-modes" role="group" aria-label="尺寸线联动方式">
      <button type="button" aria-pressed={fixed} onClick={() => onChange(true)}>尺寸线固定</button>
      <button type="button" aria-pressed={!fixed} onClick={() => onChange(false)}>随产品联动</button>
    </div>
    <p className="hint">{fixed ? '移动、缩放或换图时尺寸线保持原位，仍可单独编辑。' : '尺寸线随产品移动、缩放；替换图片后自动固定。'}</p>
  </div>;
}
