/**
 * Team names from pasted text: one per line (commas and tabs also split), trimmed, blanks
 * dropped.
 *
 * @example
 * parseTeamList("Ants\n  Bees \n\nCats"); // ["Ants", "Bees", "Cats"]
 */
export function parseTeamList(text: string): string[] {
  return text
    .split(/[\n,\t]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Copy of `items` with the element at `from` moved to index `to` (clamped to the list).
 *
 * @example
 * moveItem(["a", "b", "c"], 2, 0); // ["c", "a", "b"]
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const out = [...items];
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(out.length - 1, to));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item as T);
  return out;
}
