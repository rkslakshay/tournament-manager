import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { editResult, recordResult } from "@/server/services/results";
import { createTestDb, type TestDb } from "./test-db";
import { makeTournament, matchesOf, teamIds } from "./fixtures";

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => t.cleanup());

const full = (id: string, short: string) => `${id}-${short}`;

describe("recordResult", () => {
  it("records a round-robin result, allows draws and bumps the version", async () => {
    const { id } = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 4);
    const out = await recordResult(t.db, id, full(id, "rr-r1m1"), { homeScore: 2, awayScore: 2 });
    expect(out).toEqual({
      changedMatchIds: [full(id, "rr-r1m1")],
      resetMatchIds: [],
      status: "IN_PROGRESS",
    });
    const m = (await matchesOf(t.db, id))["rr-r1m1"]!;
    expect(m).toMatchObject({
      status: "FINISHED",
      homeScore: 2,
      awayScore: 2,
      winnerTeamId: null,
      version: 1,
    });
  });

  it("advances the winner of a knockout match and refuses draws there", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 4);
    const names = await teamIds(t.db, id);
    await expect(
      recordResult(t.db, id, full(id, "r1m1"), { homeScore: 1, awayScore: 1 }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: expect.stringMatching(/draws/),
    });
    const out = await recordResult(t.db, id, full(id, "r1m1"), { homeScore: 0, awayScore: 1 });
    expect(out.changedMatchIds).toEqual([full(id, "r1m1"), full(id, "r2m1")]);
    expect((await matchesOf(t.db, id))["r2m1"]).toMatchObject({
      homeTeamId: names.T4,
      status: "PENDING",
      version: 1,
    });
  });

  it("completes the tournament after the last match", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 3);
    await recordResult(t.db, id, full(id, "r1m2"), { homeScore: 3, awayScore: 0 });
    const out = await recordResult(t.db, id, full(id, "r2m1"), { homeScore: 1, awayScore: 0 });
    expect(out.status).toBe("COMPLETED");
    expect((await t.db.tournament.findUniqueOrThrow({ where: { id } })).status).toBe("COMPLETED");
  });

  it("rejects pending matches, byes, bad scores, unknown matches and unstarted tournaments", async () => {
    const { id } = await makeTournament(t.db, { format: "SINGLE_ELIM" }, 3);
    await expect(
      recordResult(t.db, id, full(id, "r2m1"), { homeScore: 1, awayScore: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      recordResult(t.db, id, full(id, "r1m1"), { homeScore: 1, awayScore: 0 }),
    ).rejects.toMatchObject({
      code: "INVALID_STATE",
      message: expect.stringMatching(/bye/),
    });
    await expect(
      recordResult(t.db, id, full(id, "r1m2"), { homeScore: -1, awayScore: 0 }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      recordResult(t.db, id, "nope", { homeScore: 1, awayScore: 0 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const notStarted = await makeTournament(t.db, { format: "ROUND_ROBIN" }, 2, { start: false });
    await expect(
      recordResult(t.db, notStarted.id, "x", { homeScore: 1, awayScore: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("fills the knockout once every group is finished", async () => {
    const { id } = await makeTournament(
      t.db,
      { format: "GROUP_KNOCKOUT", groups: 2, advancePerGroup: 1 },
      4,
    );
    const ms = await matchesOf(t.db, id);
    const groupMatches = Object.keys(ms).filter((k) => k.startsWith("g"));
    expect(groupMatches).toHaveLength(2);
    await recordResult(t.db, id, full(id, groupMatches[0]!), { homeScore: 1, awayScore: 0 });
    expect((await matchesOf(t.db, id))["r1m1"]).toMatchObject({ status: "PENDING" });
    await recordResult(t.db, id, full(id, groupMatches[1]!), { homeScore: 0, awayScore: 2 });
    const final = (await matchesOf(t.db, id))["r1m1"]!;
    expect(final.status).toBe("SCHEDULED");
    expect([ms[groupMatches[0]!]!.homeTeamId, ms[groupMatches[1]!]!.awayTeamId]).toEqual([
      final.homeTeamId,
      final.awayTeamId,
    ]);
  });
});

describe("editing results", () => {
  async function playedSemis(editPolicy: "RESET_DOWNSTREAM" | "BLOCK_EDIT") {
    const t4 = await makeTournament(t.db, { format: "SINGLE_ELIM", editPolicy }, 4);
    await recordResult(t.db, t4.id, full(t4.id, "r1m1"), { homeScore: 2, awayScore: 0 });
    await recordResult(t.db, t4.id, full(t4.id, "r1m2"), { homeScore: 2, awayScore: 0 });
    return t4.id;
  }

  it("re-resolves an unplayed final when a semi-final result is flipped", async () => {
    const id = await playedSemis("RESET_DOWNSTREAM");
    const names = await teamIds(t.db, id);
    const out = await editResult(t.db, id, full(id, "r1m1"), { homeScore: 0, awayScore: 1 });
    expect(out.resetMatchIds).toEqual([]);
    expect((await matchesOf(t.db, id))["r2m1"]).toMatchObject({
      homeTeamId: names.T4,
      awayTeamId: names.T2,
      status: "SCHEDULED",
    });
  });

  it("asks for confirmation before resetting a played final, then resets it", async () => {
    const id = await playedSemis("RESET_DOWNSTREAM");
    await recordResult(t.db, id, full(id, "r2m1"), { homeScore: 3, awayScore: 1 });
    expect((await t.db.tournament.findUniqueOrThrow({ where: { id } })).status).toBe("COMPLETED");

    await expect(
      editResult(t.db, id, full(id, "r1m1"), { homeScore: 0, awayScore: 1 }),
    ).rejects.toMatchObject({
      code: "CONFIRMATION_REQUIRED",
      details: { invalidated: [expect.objectContaining({ id: full(id, "r2m1"), round: 2 })] },
    });
    expect((await matchesOf(t.db, id))["r1m1"]).toMatchObject({ homeScore: 2, version: 1 });

    const out = await editResult(t.db, id, full(id, "r1m1"), {
      homeScore: 0,
      awayScore: 1,
      confirmReset: true,
    });
    expect(out).toMatchObject({ resetMatchIds: [full(id, "r2m1")], status: "IN_PROGRESS" });
    expect((await matchesOf(t.db, id))["r2m1"]).toMatchObject({
      status: "SCHEDULED",
      homeScore: null,
      winnerTeamId: null,
    });
  });

  it("blocks such edits under BLOCK_EDIT", async () => {
    const id = await playedSemis("BLOCK_EDIT");
    await recordResult(t.db, id, full(id, "r2m1"), { homeScore: 3, awayScore: 1 });
    await expect(
      editResult(t.db, id, full(id, "r1m1"), { homeScore: 0, awayScore: 1, confirmReset: true }),
    ).rejects.toMatchObject({ code: "EDIT_BLOCKED" });
  });

  it("allows score-only edits that do not change the winner, even under BLOCK_EDIT", async () => {
    const id = await playedSemis("BLOCK_EDIT");
    await recordResult(t.db, id, full(id, "r2m1"), { homeScore: 3, awayScore: 1 });
    const out = await editResult(t.db, id, full(id, "r1m1"), { homeScore: 5, awayScore: 0 });
    expect(out.changedMatchIds).toEqual([full(id, "r1m1")]);
  });

  it("editResult refuses matches without a result", async () => {
    const id = await playedSemis("RESET_DOWNSTREAM");
    await expect(
      editResult(t.db, id, full(id, "r2m1"), { homeScore: 1, awayScore: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(
      editResult(t.db, id, "nope", { homeScore: 1, awayScore: 0 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
