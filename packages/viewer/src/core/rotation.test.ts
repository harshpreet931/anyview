import { describe, it, expect } from 'vitest';
import { totalRotation, isSidewaysRotation, displayedPageSize } from './rotation';

describe('totalRotation', () => {
  it('composes (adds, not replaces) intrinsic and applied rotation', () => {
    expect(totalRotation(0, 0)).toBe(0);
    expect(totalRotation(90, 0)).toBe(90);
    expect(totalRotation(0, 90)).toBe(90);
    expect(totalRotation(90, 90)).toBe(180);
    expect(totalRotation(270, 180)).toBe(90); // wraps past 360
    expect(totalRotation(270, 270)).toBe(180); // wraps past 360
  });
});

describe('isSidewaysRotation', () => {
  it('is true only at 90/270', () => {
    expect(isSidewaysRotation(0)).toBe(false);
    expect(isSidewaysRotation(90)).toBe(true);
    expect(isSidewaysRotation(180)).toBe(false);
    expect(isSidewaysRotation(270)).toBe(true);
  });
});

describe('displayedPageSize', () => {
  it('keeps upright dimensions when not sideways', () => {
    expect(displayedPageSize(600, 900, 0, 0, 1)).toEqual({ width: 600, height: 900 });
    expect(displayedPageSize(600, 900, 0, 180, 1)).toEqual({ width: 600, height: 900 });
  });

  it('swaps width/height when the composed rotation is sideways', () => {
    expect(displayedPageSize(600, 900, 0, 90, 1)).toEqual({ width: 900, height: 600 });
    expect(displayedPageSize(600, 900, 0, 270, 1)).toEqual({ width: 900, height: 600 });
    expect(displayedPageSize(600, 900, 90, 0, 1)).toEqual({ width: 900, height: 600 });
  });

  it('composes intrinsic and applied rotation before swapping', () => {
    expect(displayedPageSize(600, 900, 90, 90, 1)).toEqual({ width: 600, height: 900 });
  });

  it('applies the scale factor to both axes', () => {
    expect(displayedPageSize(600, 900, 0, 0, 2)).toEqual({ width: 1200, height: 1800 });
    expect(displayedPageSize(600, 900, 0, 90, 0.5)).toEqual({ width: 450, height: 300 });
  });
});
