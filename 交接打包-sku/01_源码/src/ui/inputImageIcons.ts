import type { TemplateId } from '../domain/templates';
import { TEMPLATE_ICON, type FurnitureIconName } from './FurnitureIcon';

// Independently uploaded products use their own outline; whole-set uploads keep the template icon.
const MAIN_PRODUCT_ICON: Partial<Record<TemplateId, FurnitureIconName>> = {
  'soft-bed-combination': 'soft-bed',
  'soft-bed-multi-combination': 'soft-bed',
  'wood-bed-combination': 'wood-bed',
  'wood-bed-multi-combination': 'wood-bed',
  'standing-desk-combination': 'standing-desk',
  'study-desk-combination': 'study-desk',
  'sofa-combination': 'sofa',
};

export function inputImageIcon(templateId: TemplateId, accessoryId?: string): FurnitureIconName {
  if (accessoryId) {
    if (/^(soft|wood)-bed-(set-mattress|multi-mattress-[1-3])$/.test(accessoryId)) return 'mattress';
    if (/^soft-bed-(set-cabinet|multi-cabinet-[1-2])$/.test(accessoryId)) return 'nightstand';
    if (/^wood-bed-(set-cabinet|multi-cabinet-[1-2])$/.test(accessoryId)) return 'wood-nightstand';
    if (/^(computer|ergonomic|study-chair|side)-detail-[1-5]$/.test(accessoryId)) return 'detail-image';
    if (/^(mattress|double-mattress|pillow)-material-[1-3]$/.test(accessoryId)) return 'material-image';
    if (templateId === 'standing-desk-combination' && accessoryId === 'riser') return 'monitor-riser';
    if (templateId === 'standing-desk-combination' && accessoryId === 'chair') return 'computer-chair';
    if (templateId === 'study-desk-combination' && accessoryId === 'study-chair') return 'study-chair';
  }
  return MAIN_PRODUCT_ICON[templateId] ?? TEMPLATE_ICON[templateId];
}
