/** Slugs of the demo tournaments created by `npm run db:seed`, linked from the landing page. */
export const DEMO_TOURNAMENTS = [
  { slug: "demo-league", label: "8-team league", description: "Round robin with live standings" },
  { slug: "demo-cup", label: "12-team cup", description: "Single elimination with byes" },
  {
    slug: "demo-world-cup",
    label: "16-team groups + knockout",
    description: "Four groups, then a bracket",
  },
] as const;
