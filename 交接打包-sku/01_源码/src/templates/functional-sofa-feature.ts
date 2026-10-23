import { FUNCTIONAL_SOFA_MODEL_FONT, normalizeFunctionalSofaOptions } from '../domain/functionalSofaSingleLayout';
import { canvasFontFromPs } from '../domain/typography';
import type { SingleTemplateOptions } from './types';
import { functionalCurveGeometry } from '../domain/functionalSofaCurve';

export function drawFunctionalSofaFeatures(context: CanvasRenderingContext2D, options: SingleTemplateOptions) {
  const { rocking, rotation } = normalizeFunctionalSofaOptions(options);
  context.save();
  context.strokeStyle = '#545454'; context.lineWidth = 2;
  context.font = canvasFontFromPs(46, FUNCTIONAL_SOFA_MODEL_FONT);
  context.fillStyle = '#000000'; context.textAlign = 'left'; context.textBaseline = 'top';
  for (const kind of ['rocking', 'rotation'] as const) {
    const feature = kind === 'rocking' ? rocking : rotation;
    if (!feature.enabled) continue;
    const geometry = functionalCurveGeometry(kind, feature);
    context.setLineDash([6, 4]); context.beginPath();
    context.moveTo(geometry.handles.from.x, geometry.handles.from.y);
    const arc = geometry.arc;
    if (arc) context.ellipse(arc.center.x, arc.center.y, arc.radiusX, arc.radiusY, arc.rotation, arc.start, arc.start + arc.sweep, arc.sweep < 0);
    else context.lineTo(geometry.handles.to.x, geometry.handles.to.y);
    context.stroke(); context.setLineDash([]); context.beginPath();
    for (const [a, tip, b] of geometry.arrows) { context.moveTo(a.x, a.y); context.lineTo(tip.x, tip.y); context.lineTo(b.x, b.y); }
    context.stroke(); context.fillText(feature.text, geometry.text.x, geometry.text.y);
  }
  context.restore();
}
