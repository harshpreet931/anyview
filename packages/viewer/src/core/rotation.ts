export type Rotation = 0 | 90 | 180 | 270;

/** Compose a page's intrinsic rotation with the interactively-applied one. */
export function totalRotation(intrinsic: Rotation, applied: Rotation): Rotation {
  return (((intrinsic + applied) % 360) as Rotation);
}

/** Whether a total rotation swaps the page's displayed width/height. */
export function isSidewaysRotation(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}

export function displayedPageSize(
  width: number,
  height: number,
  intrinsic: Rotation,
  applied: Rotation,
  scale: number,
): { width: number; height: number } {
  const sideways = isSidewaysRotation(totalRotation(intrinsic, applied));
  return {
    width: (sideways ? height : width) * scale,
    height: (sideways ? width : height) * scale,
  };
}
