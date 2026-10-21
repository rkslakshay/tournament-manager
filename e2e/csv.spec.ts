import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("viewers can download standings and fixtures as CSV", async ({ page, request }) => {
  const created = await request.post("/api/tournaments", {
    data: { name: "CSV League", sport: "Football", config: { format: "ROUND_ROBIN" } },
  });
  const { slug, adminToken } = (await created.json()) as { slug: string; adminToken: string };
  const auth = { Authorization: `Bearer ${adminToken}` };
  await request.post(`/api/t/${slug}/teams`, {
    data: { names: ["Ants, FC", "Bees"] },
    headers: auth,
  });
  const started = (await (
    await request.post(`/api/t/${slug}/start`, { headers: auth })
  ).json()) as {
    stages: Array<{ matches: Array<{ id: string }> }>;
  };
  const matchId = started.stages[0]!.matches[0]!.id;
  await request.put(`/api/t/${slug}/matches/${matchId}/result`, {
    data: { homeScore: 2, awayScore: 1 },
    headers: auth,
  });

  await page.goto(`/t/${slug}`);
  const [standings] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download standings (CSV)" }).click(),
  ]);
  expect(standings.suggestedFilename()).toBe(`${slug}-standings.csv`);
  const standingsText = await readFile((await standings.path())!, "utf8");
  expect(standingsText).toContain("Stage,Rank,Team,Played");
  expect(standingsText).toMatch(/League,1,("Ants, FC"|Bees),1/);

  await page.getByRole("tab", { name: "Fixtures" }).click();
  const [fixtures] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download fixtures (CSV)" }).click(),
  ]);
  const fixturesText = await readFile((await fixtures.path())!, "utf8");
  expect(fixturesText).toContain('"Ants, FC"');
  expect(fixturesText).toContain("FINISHED,REGULAR");
});
