import { expect, test, type Page } from "@playwright/test";

/** Create a tournament through the wizard and return its admin URL. */
async function createTournament(page: Page, name: string, format: RegExp): Promise<string> {
  await page.goto("/");
  await page.getByRole("link", { name: "Create a tournament" }).click();
  await expect(page.getByRole("heading", { name: "Create a tournament" })).toBeVisible();

  await page.getByLabel("Tournament name").fill(name);
  await page.getByLabel("Sport").fill("Football");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("radio", { name: format }).check();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText(name)).toBeVisible();
  await page.getByRole("button", { name: "Create tournament" }).click();

  await expect(
    page.getByText("Save this link, it is the only way to manage your tournament."),
  ).toBeVisible();
  return page.getByLabel("Admin link").inputValue();
}

async function addTeams(page: Page, names: string[]) {
  await page.getByRole("textbox", { name: "Add teams" }).fill(names.join("\n"));
  await page.getByRole("button", { name: `Add ${names.length} teams` }).click();
  await expect(page.getByRole("status")).toHaveText(`${names.length} team(s) added`);
}

async function enterResult(
  page: Page,
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
) {
  const form = page.getByRole("form", { name: new RegExp(`${home} vs ${away}`) });
  await form.getByLabel(`${home} score`).fill(String(homeScore));
  await form.getByLabel(`${away} score`).fill(String(awayScore));
  await form.getByRole("button", { name: /Save|Update/ }).click();
  await expect(page.getByRole("status")).toContainText("Result saved");
}

test("organizer runs a knockout from creation to champion, viewers see it", async ({ page }) => {
  const adminUrl = await createTournament(page, "E2E Cup", /Single elimination/);
  await page.goto(adminUrl);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "E2E Cup" })).toBeVisible();

  await addTeams(page, ["Lions", "Sharks", "Eagles", "Wolves"]);
  await page.getByRole("button", { name: "Move Wolves up" }).click();
  await expect(page.getByRole("status")).toHaveText("Seeds updated");
  await expect(page.getByText("Lions vs Eagles")).toBeVisible();

  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Tournament started. Fixtures are live.");

  await enterResult(page, "Lions", "Eagles", 2, 0);
  await enterResult(page, "Sharks", "Wolves", 1, 3);
  await enterResult(page, "Lions", "Wolves", 1, 0);

  // Editing a semi-final after the final was played asks before resetting it.
  await enterResultExpectingConfirmation(page);

  await page.getByRole("link", { name: "Public page" }).click();
  await expect(page.getByRole("heading", { name: "E2E Cup" })).toBeVisible();
  await expect(page.getByText("Champion: Eagles")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Bracket" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Final", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Fixtures" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Eagles");
});

async function enterResultExpectingConfirmation(page: Page) {
  const form = page.getByRole("form", { name: /Lions vs Eagles/ });
  await form.getByLabel("Lions score").fill("0");
  await form.getByLabel("Eagles score").fill("1");
  await form.getByRole("button", { name: "Update" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset later results?" });
  await expect(dialog).toContainText("Lions vs Wolves");
  await dialog.getByRole("button", { name: "Save and reset" }).click();
  await expect(page.getByRole("status")).toHaveText("Result saved. 1 later result(s) were reset.");
  await enterResult(page, "Eagles", "Wolves", 2, 1);
}

test("round robin standings are derived from results", async ({ page }) => {
  const adminUrl = await createTournament(page, "E2E League", /Round robin/);
  await page.goto(adminUrl);
  await addTeams(page, ["Ants", "Bees", "Cats"]);
  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("status")).toHaveText("Tournament started. Fixtures are live.");

  const forms = page.getByRole("form");
  await expect(forms).toHaveCount(3);
  const first = forms.first();
  const label = (await first.getAttribute("aria-label")) ?? "";
  const [, home, away] = label.match(/: (\w+) vs (\w+)/) ?? [];
  await enterResult(page, home as string, away as string, 3, 1);

  await page.getByRole("link", { name: "Public page" }).click();
  const table = page.getByRole("table", { name: "League" });
  await expect(table).toBeVisible();
  const leader = table.getByRole("row").nth(1);
  await expect(leader).toContainText(home as string);
  await expect(leader.getByRole("cell").last()).toHaveText("3");
});

test("unknown tournaments show a not-found page", async ({ page }) => {
  const response = await page.goto("/t/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
});
