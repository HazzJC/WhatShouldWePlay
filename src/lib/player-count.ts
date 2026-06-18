export function parseMinimumPlayers(value?: string) {
  const parsed = Number(value ?? 5);
  const fallback = Number.isFinite(parsed) ? parsed : 5;

  return Math.max(1, Math.min(50, fallback));
}
