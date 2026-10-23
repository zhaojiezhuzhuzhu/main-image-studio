import { wardrobeSetRules } from './wardrobe-combination';
import { shoeCabinetSetRules } from './shoe-cabinet-combination';
import { vanityDresserRules } from './vanity-dresser-single';
import { vanityDresserSetRules } from './vanity-dresser-combination';
import { shapedVanitySetRules } from './shaped-vanity-combination';
import { drawerChestSetRules } from './drawer-chest-combination';
import { woodDeskSetRules } from './wood-desk-combination';
import { woodDeskMultiRules } from './wood-desk-multi-combination';
import { woodBedCombinationRules } from './wood-bed-combination';
import { woodBedMultiCombinationRules } from './wood-bed-multi-combination';
import { woodBedRules } from './wood-bed-single';
import { woodDiningChairRules } from './wood-dining-chair-single';
import { functionalSofaCombinationRules } from './functional-sofa-combination';
import { woodLongTableSetRules } from './wood-long-table-combination';
import { woodRoundTableSetRules } from './wood-round-table-combination';
import { woodLongTableSingleRules } from './wood-long-table-single';
import { woodRoundTableSingleRules } from './wood-round-table-single';
import { shapedVanitySingleRules } from './shaped-vanity-single';
import { woodDeskSingleRules } from './wood-desk-single';
import { wardrobeSingleRules } from './wardrobe-single';
import { shoeCabinetSingleRules } from './shoe-cabinet-single';
import { woodBedsideSingleRules } from './wood-bedside-single';
import { drawerChestSingleRules } from './drawer-chest-single';
import { softBedCombinationRules } from './soft-bed-combination';
import { softBedMultiCombinationRules } from './soft-bed-multi-combination';
import { mattressDoubleRules } from './mattress-double';
import { pillowSingleRules } from './pillow-single';
import { studyChairSingleRules } from './study-chair-single';
import { mattressSingleRules } from './mattress-single';
import { computerChairSingleRules } from './computer-chair-single';
import { ergonomicChairSingleRules } from './ergonomic-chair-single';
import { diningChairSingleRules } from './dining-chair-single';
import { liftingSideTableSingleRules } from './lifting-side-table-single';
import { studyDeskSingleRules } from './study-desk-single';
import { studyDeskCombinationRules } from './study-desk-combination';
import { standingDeskSingleRules } from './standing-desk-single';
import { standingDeskCombinationRules } from './standing-desk-combination';
import { sofaSingleRules } from './sofa-single';
import { softBedSingleRules } from './soft-bed-single';
import { sofaCombinationRules } from './sofa-combination';
import { sofaBedCombinationRules } from './sofa-bed-combination';
import { footstoolSingleRules } from './footstool-single';
import { officeChairSingleRules } from './office-chair-single';
import { longDiningTableSingleRules } from './long-dining-table-single';
import { roundExtendableTableSingleRules } from './round-extendable-table-single';
import { functionalSofaSingleRules } from './functional-sofa-single';
import { bedsideCabinetSingleRules } from './bedside-cabinet-single';
import { longDiningTableCombinationRules } from './long-dining-table-combination';
import { roundExtendableTableCombinationRules } from './round-extendable-table-combination';
import type { TemplateId } from '../domain/templates';

export const SINGLE_TEMPLATE_RULES = {
  'wood-dining-chair-single': woodDiningChairRules,
  'wood-bed-single': woodBedRules,
  'wood-bed-multi-combination': woodBedMultiCombinationRules,
  'wood-bed-combination': woodBedCombinationRules,
  'wood-desk-multi-combination': woodDeskMultiRules,
  'wood-desk-combination': woodDeskSetRules,
  'drawer-chest-combination': drawerChestSetRules,
  'shaped-vanity-combination': shapedVanitySetRules,
  'vanity-dresser-combination': vanityDresserSetRules,
  'vanity-dresser-single': vanityDresserRules,
  'shoe-cabinet-combination': shoeCabinetSetRules,
  'wardrobe-combination': wardrobeSetRules,
  'wood-long-table-combination': woodLongTableSetRules,
  'wood-round-table-combination': woodRoundTableSetRules,
  'wood-long-table-single': woodLongTableSingleRules,
  'wood-round-table-single': woodRoundTableSingleRules,
  'shaped-vanity-single': shapedVanitySingleRules,
  'wood-desk-single': woodDeskSingleRules,
  'wardrobe-single': wardrobeSingleRules,
  'shoe-cabinet-single': shoeCabinetSingleRules,
  'wood-bedside-single': woodBedsideSingleRules,
  'drawer-chest-single': drawerChestSingleRules,
  'soft-bed-combination': softBedCombinationRules,
  'soft-bed-multi-combination': softBedMultiCombinationRules,
  'mattress-double': mattressDoubleRules,
  'pillow-single': pillowSingleRules,
  'study-chair-single': studyChairSingleRules,
  'mattress-single': mattressSingleRules,
  'computer-chair-single': computerChairSingleRules,
  'ergonomic-chair-single': ergonomicChairSingleRules,
  'dining-chair-single': diningChairSingleRules,
  'lifting-side-table-single': liftingSideTableSingleRules,
  'study-desk-single': studyDeskSingleRules,
  'study-desk-combination': studyDeskCombinationRules,
  'standing-desk-single': standingDeskSingleRules,
  'standing-desk-combination': standingDeskCombinationRules,
  'sofa-single': sofaSingleRules,
  'soft-bed-single': softBedSingleRules,
  'footstool-single': footstoolSingleRules,
  'office-chair-single': officeChairSingleRules,
  'long-dining-table-single': longDiningTableSingleRules,
  'round-extendable-table-single': roundExtendableTableSingleRules,
  'functional-sofa-single': functionalSofaSingleRules,
  'bedside-cabinet-single': bedsideCabinetSingleRules,
  'long-dining-table-combination': longDiningTableCombinationRules,
  'round-extendable-table-combination': roundExtendableTableCombinationRules,
};

export const COMBINATION_TEMPLATE_RULES = {
  'functional-sofa-combination': functionalSofaCombinationRules,
  'sofa-combination': sofaCombinationRules,
  'sofa-bed-combination': sofaBedCombinationRules,
};

export type SingleTemplateId = keyof typeof SINGLE_TEMPLATE_RULES;
export type CombinationTemplateId = keyof typeof COMBINATION_TEMPLATE_RULES;

export function isSingleTemplateId(id: TemplateId): id is SingleTemplateId {
  return Object.prototype.hasOwnProperty.call(SINGLE_TEMPLATE_RULES, id);
}

export function isCombinationTemplateId(id: TemplateId): id is CombinationTemplateId {
  return Object.prototype.hasOwnProperty.call(COMBINATION_TEMPLATE_RULES, id);
}
