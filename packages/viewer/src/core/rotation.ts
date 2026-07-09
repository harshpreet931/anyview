/* ============================================================
 * Rotation composition.
 *
 * PageRef.width/height/rotation describe a page in its CANONICAL
 * (unrotated) frame; PageRef.rotation is the page's own intrinsic rotation
 * (e.g. a PDF's /Rotate entry - always 0 for formats with no such concept).
 * The interactive rotation the user applies via the toolbar composes with
 * it, not replaces it: a scanned page with /Rotate 90 rotated another 90
 * by the user should show at 180, not snap back to 0.
 * ============================================================ */

export type Rotation = 0 | 90 | 180 | 270;

/** Compose a page's intrinsic rotation with the interactively-applied one. */
export function totalRotation(intrinsic: Rotation, applied: Rotation): Rotation {
  return (((intrinsic + applied) % 360) as Rotation);
}

/** Whether a total rotation swaps the page's displayed width/height. */
export function isSidewaysRotation(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}
