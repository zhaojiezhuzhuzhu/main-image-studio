import { DEFAULT_SOFA_BED_FEATURE, getSofaBedFeatureBounds } from '../domain/sofaBedCombinationLayout';
import { canvasFontFromPs } from '../domain/typography';
import type { CombinationTemplateRules, FeatureEditorProps, FeaturePlacement } from './types';
import type { Rect } from '../domain/dimensionGeometry';
const CANVAS_SIZE = 1440;
const FEATURE_FONT = canvasFontFromPs(40, '"FZLanTingHeiS-R-GBK", "Microsoft YaHei", sans-serif');
function FeatureEditor({ value, box, editing, onChange, onFocus, onBlur }: FeatureEditorProps) {
  return <input className="canvas-note-editor" aria-label="画布功能说明" value={value.text} maxLength={14} placeholder="功能说明" style={{ left: `${(box.x + 100) / CANVAS_SIZE * 100}%`, top: `${(box.y + 18) / CANVAS_SIZE * 100}%`, width: `${Math.max(80, box.width - 100) / CANVAS_SIZE * 100}%`, height: `${52 / CANVAS_SIZE * 100}%`, fontSize: `${parseFloat(FEATURE_FONT) / CANVAS_SIZE * 100}cqw`, fontFamily: FEATURE_FONT.replace(/^.*?px\s+/, ''), color: editing ? '#000' : undefined }} onFocus={onFocus} onBlur={onBlur} onChange={(event) => onChange({ ...value, text: event.target.value })} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (!event.nativeEvent.isComposing && (event.key === 'Enter' || event.key === 'Escape')) event.currentTarget.blur(); }}/>;
}
function FeatureInspector({ value, box, onMove }: { value: FeaturePlacement; box?: Rect; onMove(value: FeaturePlacement): void }) {
  return <section className="label-inspector"><h2>功能说明 · 位置微调</h2><div className="quick-annotation-actions">
          <button type="button" onClick={() => onMove({ ...value, x: (box?.x ?? value.x) - 10 })}>左移 10px</button>
          <button type="button" onClick={() => onMove({ ...value, x: (box?.x ?? value.x) + 10 })}>右移 10px</button>
          <button type="button" onClick={() => onMove({ ...value, y: (box?.y ?? value.y) - 10 })}>上移 10px</button>
          <button type="button" onClick={() => onMove({ ...value, y: (box?.y ?? value.y) + 10 })}>下移 10px</button>
          <button type="button" onClick={() => onMove({ ...value, x: DEFAULT_SOFA_BED_FEATURE.x, y: DEFAULT_SOFA_BED_FEATURE.y })}>复位</button>
        </div></section>;
}
export const sofaBedFeatureRules: NonNullable<CombinationTemplateRules['feature']> = {
  font: FEATURE_FONT, textInset: 100,
  bounds: (feature, width, count) => getSofaBedFeatureBounds(feature, width, count === 0),
  issues: (feature, width) => [...(!feature.text.trim() ? ['请填写功能说明，或关闭该说明'] : []), ...(width + 100 > 1300 ? ['功能说明过长，请缩短文案'] : [])],
  Editor: FeatureEditor, Inspector: FeatureInspector,
  draw(context, feature, bounds) {
      const { x, y } = bounds;
      context.save(); context.strokeStyle = '#545454'; context.lineWidth = 2; context.setLineDash([8, 6]);
      context.beginPath(); context.moveTo(x + 8, y + 8); context.bezierCurveTo(x + 90, y + 8, x + 90, y + 110, x + 48, y + 112); context.stroke();
      context.setLineDash([]); context.beginPath();
      context.moveTo(x + 20, y); context.lineTo(x + 8, y + 8); context.lineTo(x + 18, y + 20);
      context.moveTo(x + 57, y + 101); context.lineTo(x + 48, y + 112); context.lineTo(x + 61, y + 119); context.stroke(); context.restore();
      context.font = FEATURE_FONT; context.fillStyle = '#000'; context.textAlign = 'left'; context.textBaseline = 'top';
      context.fillText(feature.text, x + 100, y + 18);
  },
};
