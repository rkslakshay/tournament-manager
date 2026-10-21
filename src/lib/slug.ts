/**
 * URL-friendly version of a name: lowercase ASCII letters, digits and single hyphens,
 * at most 40 characters. Accents are stripped. Falls back to "tournament" when nothing
 * usable is left.
 *
 * @example
 * slugify("Summer Cup 2026!"); // "summer-cup-2026"
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "tournament";
}
