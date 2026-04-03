import { describe, it, expect } from 'vitest';

// Unit-test the location-display logic extracted from ProductEnhancementPanel
// (mirrors the logic in the component so we can test it without rendering React)

function formatShelfInfo(loc: {
  aisleDescription?: string;
  aisleNumber?: string;
  aisleSide?: string;
  bayNumberInAisle?: string;
  shelfNumber?: string;
} | null | undefined): string | undefined {
  if (!loc) return undefined;
  const desc = loc.aisleDescription?.trim();
  if (desc) {
    const parts: string[] = [desc];
    if (loc.bayNumberInAisle != null) parts.push(`Bay ${loc.bayNumberInAisle}`);
    if (loc.shelfNumber != null) parts.push(`Shelf ${loc.shelfNumber}`);
    return parts.join(', ');
  }
  const parts: string[] = [];
  if (loc.aisleNumber != null) parts.push(`Aisle ${loc.aisleNumber}${loc.aisleSide ?? ''}`);
  if (loc.bayNumberInAisle != null) parts.push(`Bay ${loc.bayNumberInAisle}`);
  if (loc.shelfNumber != null) parts.push(`Shelf ${loc.shelfNumber}`);
  return parts.length > 0 ? parts.join(', ') : undefined;
}

describe('formatShelfInfo — location display', () => {
  it('uses aisleDescription when present (e.g. PRODUCE TABLE 4)', () => {
    const result = formatShelfInfo({
      aisleDescription: 'PRODUCE TABLE 4',
      aisleNumber: '353',
      aisleSide: 'L',
      bayNumberInAisle: '1',
      shelfNumber: '7',
    });
    expect(result).toBe('PRODUCE TABLE 4, Bay 1, Shelf 7');
    expect(result).not.toContain('353');
  });

  it('falls back to number+side when aisleDescription is absent', () => {
    const result = formatShelfInfo({
      aisleNumber: '5',
      aisleSide: 'R',
      bayNumberInAisle: '2',
      shelfNumber: '3',
    });
    expect(result).toBe('Aisle 5R, Bay 2, Shelf 3');
  });

  it('omits bay and shelf when not present', () => {
    const result = formatShelfInfo({ aisleDescription: 'DELI DEPT' });
    expect(result).toBe('DELI DEPT');
  });

  it('falls back to aisle number only when no description, no bay/shelf', () => {
    const result = formatShelfInfo({ aisleNumber: '12', aisleSide: 'L' });
    expect(result).toBe('Aisle 12L');
  });

  it('returns undefined for null location', () => {
    expect(formatShelfInfo(null)).toBeUndefined();
    expect(formatShelfInfo(undefined)).toBeUndefined();
  });

  it('returns undefined when all fields are absent', () => {
    expect(formatShelfInfo({})).toBeUndefined();
  });

  it('trims whitespace from aisleDescription', () => {
    const result = formatShelfInfo({ aisleDescription: '  PRODUCE TABLE 4  ' });
    expect(result).toBe('PRODUCE TABLE 4');
  });
});
