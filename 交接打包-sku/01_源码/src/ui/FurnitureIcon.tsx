import type { TemplateId, TEMPLATES } from '../domain/templates';

const spriteUrl = new URL('./furniture-icons.svg', import.meta.url).href;

export type FurnitureIconName =
  | 'sofa' | 'sofa-combination' | 'sofa-bed' | 'footstool' | 'recliner'
  | 'soft-bed' | 'soft-bed-combination' | 'soft-bed-multi-combination' | 'mattress' | 'mattress-double' | 'pillow' | 'nightstand'
  | 'office-chair' | 'computer-chair' | 'ergonomic-chair' | 'study-chair'
  | 'shaped-vanity' | 'desk' | 'standing-desk' | 'standing-desk-combination' | 'study-desk' | 'study-desk-combination' | 'lifting-side-table'
  | 'dining-table' | 'dining-table-combination' | 'round-table' | 'round-table-combination' | 'dining-chair'
  | 'wood-nightstand' | 'drawer-chest' | 'wardrobe' | 'shoe-cabinet' | 'coffee-table' | 'tv-cabinet' | 'sideboard' | 'bookcase'
  | 'functional-sofa' | 'nightstand-pair' | 'pillow-pair'
  | 'wood-bed' | 'wood-bed-combination' | 'wood-bed-multi-combination'
  | 'wardrobe-combination' | 'wardrobe-side-cabinet' | 'side-cabinet' | 'shoe-cabinet-tall' | 'shoe-cabinet-combination'
  | 'vanity-dresser' | 'vanity-dresser-combination' | 'shaped-vanity-combination' | 'vanity-mirror' | 'vanity-stool'
  | 'drawer-chest-combination' | 'desk-combination' | 'desk-multi-combination'
  | 'dining-table-mixed-combination' | 'round-table-mixed-combination' | 'dining-bench' | 'dining-chair-pair'
  | 'standing-desk-two-piece' | 'standing-desk-three-piece' | 'monitor-riser'
  | 'detail-image' | 'material-image'
  | 'template-single' | 'template-combination' | 'arrow-right' | 'download';

export const TEMPLATE_ICON: Record<TemplateId, FurnitureIconName> = {
  'functional-sofa-combination': 'functional-sofa',
  'wood-dining-chair-single': 'dining-chair',
  'wood-bed-single': 'wood-bed',
  'wood-bed-multi-combination': 'wood-bed-multi-combination',
  'wood-bed-combination': 'wood-bed-combination',
  'wood-desk-multi-combination': 'desk-multi-combination',
  'wood-desk-combination': 'desk-combination',
  'drawer-chest-combination': 'drawer-chest-combination',
  'shaped-vanity-combination': 'shaped-vanity-combination',
  'vanity-dresser-combination': 'vanity-dresser-combination',
  'vanity-dresser-single': 'vanity-dresser',
  'shoe-cabinet-combination': 'shoe-cabinet-combination',
  'wardrobe-combination': 'wardrobe-combination',
  'wood-long-table-combination': 'dining-table-combination',
  'wood-round-table-combination': 'round-table-combination',
  'wood-long-table-single': 'dining-table',
  'wood-round-table-single': 'round-table',
  'shaped-vanity-single': 'shaped-vanity',
  'wood-desk-single': 'desk',
  'wardrobe-single': 'wardrobe',
  'shoe-cabinet-single': 'shoe-cabinet',
  'wood-bedside-single': 'wood-nightstand',
  'drawer-chest-single': 'drawer-chest',
  'study-chair-single': 'study-chair',
  'mattress-single': 'mattress',
  'mattress-double': 'mattress-double',
  'pillow-single': 'pillow',
  'soft-bed-combination': 'soft-bed-combination',
  'soft-bed-multi-combination': 'soft-bed-multi-combination',
  'computer-chair-single': 'computer-chair',
  'ergonomic-chair-single': 'ergonomic-chair',
  'dining-chair-single': 'dining-chair',
  'lifting-side-table-single': 'lifting-side-table',
  'study-desk-single': 'study-desk',
  'study-desk-combination': 'study-desk-combination',
  'standing-desk-single': 'standing-desk',
  'standing-desk-combination': 'standing-desk-combination',
  'sofa-single': 'sofa',
  'sofa-combination': 'sofa-combination',
  'sofa-bed-combination': 'sofa-bed',
  'soft-bed-single': 'soft-bed',
  'footstool-single': 'footstool',
  'office-chair-single': 'office-chair',
  'long-dining-table-single': 'dining-table',
  'round-extendable-table-single': 'round-table',
  'functional-sofa-single': 'recliner',
  'bedside-cabinet-single': 'nightstand',
  'long-dining-table-combination': 'dining-table-combination',
  'round-extendable-table-combination': 'round-table-combination',
};

export const CATEGORY_ICON: Record<(typeof TEMPLATES)[TemplateId]['category'], FurnitureIconName> = {
  沙发: 'sofa', 睡眠: 'soft-bed', 办公: 'standing-desk', 餐桌: 'dining-table', 板木: 'wardrobe',
};

export function FurnitureIcon({ name }: { name: FurnitureIconName }) {
  return <svg className="furniture-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href={`${spriteUrl}#${name}`} /></svg>;
}

export function AppMark() {
  return <span className="app-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 10h16M10 10v10"/></svg></span>;
}
