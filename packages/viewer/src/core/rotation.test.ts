import { describe, it, expect } from 'vitest';
import { totalRotation, isSidewaysRotation } from './rotation';

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
