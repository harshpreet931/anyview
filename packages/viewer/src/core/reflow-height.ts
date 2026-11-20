export function estimatedReflowHeight(chars: number): number {
  return Math.max(Math.ceil(chars / 80) * 24 + 200, 400);
}
