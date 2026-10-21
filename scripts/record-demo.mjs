// `npm run demo-gif`: records docs/demo.gif. An organizer (left) creates a cup, adds teams,
// starts it and enters results while a viewer (right) watches the public page update live.
// Each step is a side-by-side frame composited with pngjs and encoded with gifenc.
// `npm run demo-gif -- --frames` also writes every frame to .tmp/demo-frames/ for review.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import gifenc from "gifenc";
import { PNG } from "pngjs";
import { startDemoServer } from "./demo-server.mjs";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const PANEL = { width: 640, height: 520 };
const GAP = 8;
const frames = [];

/** Screenshot both pages and place them side by side on one frame. */
async function frame(organizer, viewer, delay = 1400) {
  const [left, right] = await Promise.all(
    [organizer, viewer].map(async (page) => PNG.sync.read(await page.screenshot())),
  );
  const width = PANEL.width * 2 + GAP;
  const canvas = new PNG({ width, height: PANEL.height });
  canvas.data.fill(255);
  PNG.bitblt(left, canvas, 0, 0, PANEL.width, PANEL.height, 0, 0);
  PNG.bitblt(right, canvas, 0, 0, PANEL.width, PANEL.height, PANEL.width + GAP, 0);
  frames.push({ data: canvas.data, width, height: PANEL.height, delay });
  if (process.argv.includes("--frames")) {
    mkdirSync(".tmp/demo-frames", { recursive: true });
    writeFileSync(
      `.tmp/demo-frames/${String(frames.length).padStart(2, "0")}.png`,
      PNG.sync.write(canvas),
    );
  }
}

const server = await startDemoServer({ port: 3201, dbName: "demo-gif.db" });
const { base } = server;
let failed = false;
try {
  const browser = await chromium.launch();
  const options = { viewport: PANEL, deviceScaleFactor: 1 };
  const organizer = await (await browser.newContext(options)).newPage();
  const viewer = await (await browser.newContext(options)).newPage();

  // 1. Create the tournament.
  await viewer.goto(`${base}/`);
  await organizer.goto(`${base}/new`);
  await organizer.getByLabel("Tournament name").fill("Friday Five-a-side Cup");
  await organizer.getByLabel("Sport").fill("Football");
  await frame(organizer, viewer);
  await organizer.getByRole("button", { name: "Next", exact: true }).click();
  await organizer.getByRole("radio", { name: /Single elimination/ }).check();
  await frame(organizer, viewer);
  await organizer.getByRole("button", { name: "Next", exact: true }).click();
  await organizer.getByRole("button", { name: "Create tournament" }).click();
  await organizer.getByText("Save this link").waitFor();
  await frame(organizer, viewer, 2000);
  const adminUrl = await organizer.getByLabel("Admin link").inputValue();

  // 2. Add teams; the viewer opens the public page.
  await organizer.goto(adminUrl);
  const slug = new URL(adminUrl).pathname.split("/")[2];
  await viewer.goto(`${base}/t/${slug}`);
  await organizer
    .getByRole("textbox", { name: "Add teams" })
    .fill("Rovers\nUnited\nAthletic\nCity");
  await frame(organizer, viewer);
  await organizer.getByRole("button", { name: "Add 4 teams" }).click();
  await organizer.getByRole("status").filter({ hasText: "team(s) added" }).waitFor();
  await viewer.getByText("Athletic").waitFor();
  await frame(organizer, viewer);

  // 3. Start: fixtures appear for the viewer without a reload.
  await organizer.getByRole("button", { name: "Start tournament" }).click();
  await organizer.getByRole("dialog").getByRole("button", { name: "Start" }).click();
  await organizer.getByRole("status").filter({ hasText: "Tournament started" }).waitFor();
  await viewer.getByRole("tab", { name: "Bracket", selected: true }).waitFor();
  await organizer.evaluate(() => window.scrollTo(0, 0));
  await frame(organizer, viewer, 1800);

  // 4. Enter results; the bracket fills in live on the right.
  for (const [home, away, h, a] of [
    ["Rovers", "City", "3", "1"],
    ["United", "Athletic", "0", "2"],
  ]) {
    const form = organizer.getByRole("form", { name: new RegExp(`${home} vs ${away}`) });
    await form.getByLabel(`${home} score`).fill(h);
    await form.getByLabel(`${away} score`).fill(a);
    await frame(organizer, viewer, 900);
    await form.getByRole("button", { name: "Save" }).click();
    await organizer.getByRole("status").filter({ hasText: "Result saved" }).waitFor();
    await viewer.waitForTimeout(1200);
    await frame(organizer, viewer, 1800);
  }
  await frame(organizer, viewer, 3000);
  await browser.close();

  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay: f.delay });
  }
  gif.finish();
  writeFileSync("docs/demo.gif", gif.bytes());
  console.log(
    `docs/demo.gif: ${frames.length} frames, ${Math.round(gif.bytes().length / 1024)} KB`,
  );
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  server.stop();
}
process.exit(failed ? 1 : 0);
