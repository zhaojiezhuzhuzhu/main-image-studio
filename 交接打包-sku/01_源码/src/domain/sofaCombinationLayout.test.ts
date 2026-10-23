import { describe, expect, it } from 'vitest';
import { constrainOptionalLabelOffset, getSofaCombinationLayout } from './sofaCombinationLayout';

describe('沙发组合 SKU 自动布局', () => {
  it.each([1, 2, 3, 4])('keeps %i optional products within the confirmed margins', (count) => {
    const layout = getSofaCombinationLayout(count, 'standard');

    expect(layout.optionalGroups).toHaveLength(count);
    for (const group of layout.optionalGroups) {
      expect(group.x).toBeGreaterThanOrEqual(130);
      expect(group.x + group.width).toBeLessThanOrEqual(1440 - 130);
    }
  });

  it.each([2, 3])('keeps at least 50px between %i horizontally arranged groups', (count) => {
    const groups = getSofaCombinationLayout(count, 'standard').optionalGroups;

    for (let index = 1; index < groups.length; index += 1) {
      const previous = groups[index - 1];
      expect(groups[index].x - (previous.x + previous.width)).toBeGreaterThanOrEqual(50);
    }
  });

  it('uses the PPT structure of one auxiliary group plus three lower groups for four sizes', () => {
    const layout = getSofaCombinationLayout(4, 'standard');
    const groups = layout.optionalGroups;
    const auxiliary = groups[0];
    const lower = groups.slice(1);

    expect(auxiliary.width).toBeGreaterThan(lower[0].width);
    expect(lower).toHaveLength(3);
    expect(new Set(lower.map((group) => group.y))).toHaveLength(1);
    expect(lower[0].y - (layout.optionalLabel.y + layout.optionalLabel.height)).toBe(50);
    expect(auxiliary.y - (layout.optionalLabelRightY + layout.optionalLabel.height)).toBe(50);
    expect(lower[0].y - (auxiliary.y + auxiliary.height)).toBeGreaterThanOrEqual(50);
    for (let index = 1; index < lower.length; index += 1) {
      expect(lower[index].x - (lower[index - 1].x + lower[index - 1].width)).toBeGreaterThanOrEqual(50);
    }
  });

  it('uses the confirmed 120px side margin for functional sofas', () => {
    const layout = getSofaCombinationLayout(4, 'functional');

    expect(layout.optionalGroups.at(-3)!.x).toBe(120);
    expect(layout.optionalGroups.at(-1)!.x + layout.optionalGroups.at(-1)!.width).toBe(1440 - 120);
  });

  it('keeps the note above the confirmed 60px bottom whitespace', () => {
    const layout = getSofaCombinationLayout(4, 'standard');

    expect(layout.note.y + layout.note.height).toBeLessThanOrEqual(1440 - 60);
    expect(layout.note.y - (layout.optionalGroups.at(-1)!.y + layout.optionalGroups.at(-1)!.height)).toBe(40);
  });

  it('keeps the optional label inside its movable safe range', () => {
    expect(constrainOptionalLabelOffset(3, 'standard', 'left', -1000)).toBe(-275);
    expect(constrainOptionalLabelOffset(3, 'standard', 'left', 1000)).toBe(30);
    expect(constrainOptionalLabelOffset(4, 'standard', 'right', 1000)).toBe(30);
  });
});
