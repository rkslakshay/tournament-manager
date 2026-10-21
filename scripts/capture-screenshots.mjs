// `npm run screenshots`: regenerates docs/screenshots/*.png from a production build with the
// seeded demo tournaments. Uses its own database file and port, and cleans up afterwards.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { api, startDemoServer } from "./demo-server.mjs";

const OUT = "docs/screenshots";

/** A part-played double-elimination tournament created through the public API. */
async function createDoubleElimination(base) {
  const { slug, adminToken } = await api(base, "/api/tournaments", {
    body: { name: "Winter Double Cup", sport: "Table tennis", config: { format: "DOUBLE_ELIM" } },
  });
  const names = [
    "Red Lions",
    "Blue Sharks",
    "Green Eagles",
    "Black Wolves",
    "Golden Bears",
    "Silver Hawks",
    "Orange Tigers",
    "White Owls",
  ];
  await api(base, `/api/t/${slug}/teams`, { body: { names }, token: adminToken });
  let view = await api(base, `/api/t/${slug}/start`, { token: adminToken });
  for (let i = 0; i < 9; i++) {
    const next = view.stages[0].matches.find((m) => m.status === "SCHEDULED");
    if (!next) break;
    const homeWins = i % 3 !== 2;
    const res = await api(base, `/api/t/${slug}/matches/${next.id}/result`, {
      method: "PUT",
      body: { homeScore: homeWins ? 3 : 1, awayScore: homeWins ? 1 : 3 },
      token: adminToken,
    });
    view = res.view;
  }
  return slug;
}

async function shoot(
  browser,
  name,
  url,
  { device, colorScheme = "light", tab, fullPage = true } = {},
) {
  const context = await browser.newContext({
    ...(device ?? { viewport: { width: 1280, height: 860 } }),
    colorScheme,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  if (tab) await page.getByRole("tab", { name: tab }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  await context.close();
  console.log(`  ${OUT}/${name}.png`);
}

mkdirSync(OUT, { recursive: true });
const server = await startDemoServer({ port: 3200, dbName: "screenshots.db" });
const { base } = server;
let failed = false;
try {
  const doubleSlug = await createDoubleElimination(base);
  const browser = await chromium.launch();
  console.log("Screenshots:");
  await shoot(browser, "home", `${base}/`, { fullPage: false });
  await shoot(browser, "standings", `${base}/t/demo-world-cup`, { tab: "Standings" });
  await shoot(browser, "bracket", `${base}/t/demo-world-cup`, { tab: "Bracket" });
  await shoot(browser, "double-elimination", `${base}/t/${doubleSlug}`, { tab: "Bracket" });
  await shoot(browser, "swiss", `${base}/t/demo-swiss`, { tab: "Standings" });
  await shoot(browser, "mobile", `${base}/t/demo-league`, {
    device: devices["Pixel 7"],
    fullPage: false,
  });
  await shoot(browser, "admin", server.adminUrls["demo-league"], { fullPage: false });
  await shoot(browser, "dark-mode", `${base}/t/demo-cup`, { colorScheme: "dark", tab: "Bracket" });
  await browser.close();
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  server.stop();
}
process.exit(failed ? 1 : 0);
