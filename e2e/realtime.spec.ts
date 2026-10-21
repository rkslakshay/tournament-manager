import { expect, test } from "@playwright/test";

test("a result entered in admin appears on an open public page without reload", async ({
  browser,
  request,
}) => {
  // Arrange through the API: a started 2-team league.
  const created = await request.post("/api/tournaments", {
    data: { name: "Realtime Derby", sport: "Football", config: { format: "ROUND_ROBIN" } },
  });
  const { slug, adminToken } = (await created.json()) as { slug: string; adminToken: string };
  const auth = { Authorization: `Bearer ${adminToken}` };
  await request.post(`/api/t/${slug}/teams`, {
    data: { names: ["Rovers", "United"] },
    headers: auth,
  });
  await request.post(`/api/t/${slug}/start`, { headers: auth });

  const viewerContext = await browser.newContext();
  const organizerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  const organizer = await organizerContext.newPage();

  await viewer.goto(`/t/${slug}`);
  await expect(viewer.locator("[data-live-mode='live']")).toBeVisible();
  // Marker that would vanish if the page reloaded.
  await viewer.evaluate(() => ((window as unknown as { marker: string }).marker = "no-reload"));
  await expect(viewer.getByRole("table", { name: "League" }).getByRole("row").nth(1)).toContainText(
    "0",
  );

  await organizer.goto(`/t/${slug}/admin?token=${encodeURIComponent(adminToken)}`);
  const form = organizer.getByRole("form", { name: /Rovers vs United|United vs Rovers/ });

  // Going live shows up for the viewer.
  await form.getByRole("button", { name: "Mark live" }).click();
  await expect(viewer.getByRole("heading", { name: "Live now" })).toBeVisible();

  // The final score shows up too, and the derived table updates.
  await form.getByLabel("Rovers score").fill("2");
  await form.getByLabel("United score").fill("1");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(organizer.getByRole("status")).toContainText("Result saved");

  await expect(viewer.getByRole("heading", { name: "Live now" })).toHaveCount(0);
  const leader = viewer.getByRole("table", { name: "League" }).getByRole("row").nth(1);
  await expect(leader).toContainText("Rovers");
  await expect(leader.getByRole("cell").last()).toHaveText("3");
  await expect(viewer.getByText("Champion: Rovers")).toBeVisible();
  expect(await viewer.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe(
    "no-reload",
  );

  await viewerContext.close();
  await organizerContext.close();
});
