// `npm run screenshots`: regenerates docs/screenshots/*.png from a production build with the
// seeded demo tournaments. Uses its own database file and port, and cleans up afterwards.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { chromium, devices } from "@playwright/test";

const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const OUT = "docs/screenshots";
const env = {
  ...process.env,
  DATABASE_URL: "file:./screenshots.db",
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_PUBLIC_SITE_URL: BASE,
  RATE_LIMIT_CREATE_PER_HOUR: "1000",
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { env, shell: true, encoding: "utf8", ...options });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Server did not start");
}

/** A double-elimination demo through the public API, part-played. */
async function createDoubleElimination() {
  const post = (path, body, token, method = "POST") =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => r.json());
  const { slug, adminToken } = await post("/api/tournaments", {
    name: "Winter Double Cup",
    sport: "Table tennis",
    config: { format: "DOUBLE_ELIM" },
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
  await post(`/api/t/${slug}/teams`, { names }, adminToken);
  let view = await post(`/api/t/${slug}/start`, undefined, adminToken);
  for (let i = 0; i < 9; i++) {
    const next = view.stages[0].matches.find((m) => m.status === "SCHEDULED");
    if (!next) break;
    const homeWins = i % 3 !== 2;
    const res = await post(
      `/api/t/${slug}/matches/${next.id}/result`,
      { homeScore: homeWins ? 3 : 1, awayScore: homeWins ? 1 : 3 },
      adminToken,
      "PUT",
    );
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

rmSync("prisma/screenshots.db", { force: true });
mkdirSync(OUT, { recursive: true });
run("npx", ["prisma", "migrate", "deploy"]);
const seedOutput = run("npx", ["tsx", "prisma/seed.ts"]);
const adminLeague = seedOutput.match(/demo-league[\s\S]*?admin:\s+(\S+)/)?.[1];
if (!adminLeague) throw new Error("Seed did not print an admin link");
run("npx", ["next", "build"], { stdio: "ignore" });

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env,
  shell: true,
  stdio: "ignore",
});
let failed = false;
try {
  await waitForServer();
  const doubleSlug = await createDoubleElimination();
  const browser = await chromium.launch();
  console.log("Screenshots:");
  await shoot(browser, "home", `${BASE}/`, { fullPage: false });
  await shoot(browser, "standings", `${BASE}/t/demo-world-cup`, { tab: "Standings" });
  await shoot(browser, "bracket", `${BASE}/t/demo-world-cup`, { tab: "Bracket" });
  await shoot(browser, "double-elimination", `${BASE}/t/${doubleSlug}`, { tab: "Bracket" });
  await shoot(browser, "swiss", `${BASE}/t/demo-swiss`, { tab: "Standings" });
  await shoot(browser, "mobile", `${BASE}/t/demo-league`, {
    device: devices["Pixel 7"],
    fullPage: false,
  });
  await shoot(browser, "admin", adminLeague, { fullPage: false });
  await shoot(browser, "dark-mode", `${BASE}/t/demo-cup`, { colorScheme: "dark", tab: "Bracket" });
  await browser.close();
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();
  rmSync("prisma/screenshots.db", { force: true });
}
process.exit(failed ? 1 : 0);
