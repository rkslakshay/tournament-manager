# Study guide

Ten things to be able to explain without notes. For each: read the file, run the test, then make
the suggested change and watch a test fail. That is the fastest way to be sure you understand why
the code is the way it is. Revert each change afterwards (`git checkout -- <file>`).

Run one test file with:

```bash
npx vitest run src/engine/__tests__/round-robin.test.ts
```

---

### 1. The circle method and home/away balance

- **Read:** `src/engine/round-robin.ts` (`generateRoundRobin`, `pairingsForRound`).
- **Run:** `src/engine/__tests__/round-robin.test.ts`.
- **Break it:** in `pairingsForRound`, change `i % 2 === 1 ? [b, a] : [a, b]` to always `[a, b]`.
  The property "balances home and away: at most 2 in a row" fails, and fast-check prints the
  smallest team count that shows it.
- **Explain:** why rotating everyone but one seat gives every pair exactly once, and what a
  "break" is.

### 2. Seeding and byes

- **Read:** `src/engine/seeding.ts` (`seedBracket`, `firstRoundPairs`, `orderBySeed`).
- **Run:** `src/engine/__tests__/seeding.test.ts`.
- **Break it:** in `seedBracket`, swap the pair to `[next - seed, seed]`. The "standard order for
  2, 4 and 8" test fails, and seeds 1 and 2 can now meet before the final.
- **Explain:** why the byes always land on the top seeds.

### 3. Sources and propagation (the most important idea)

- **Read:** `src/engine/propagation.ts` (`propagate`, `applySlots`, `topologicalOrder`).
- **Run:** `src/engine/__tests__/propagation.test.ts`.
- **Break it:** in `wasInvalidated`, return `false` always. "reports and resets downstream matches
  that already have results" fails: edits would silently keep stale results.
- **Explain:** why matches are processed in topological order, and what "idempotent" means and
  how it is tested.

### 4. Double elimination and "the loser of a bye is a bye"

- **Read:** `src/engine/double-elimination.ts` and `loserSlot` in `propagation.ts`.
- **Run:** `src/engine/__tests__/double-elimination.test.ts`.
- **Break it:** in `loserSlot`, make `if (!hasResult(feeder)) return BYE;` return `UNKNOWN`
  instead. Brackets with byes never finish, and "eliminates every team except the champion after
  exactly two losses" fails.
- **Explain:** drop-down versus consolidation rounds, and when the grand-final reset is played.

### 5. Tiebreakers and recursive head-to-head

- **Read:** `src/engine/tiebreakers.ts` (`rankTeams`, `orderGroup`, `headToHeadScorer`).
- **Run:** `src/engine/__tests__/tiebreakers.test.ts`.
- **Break it:** in `orderGroup`, change `criterion === "headToHead" ? criterionIndex :
criterionIndex + 1` to always `criterionIndex + 1`. "re-applies head-to-head recursively"
  fails (C, B, A, D becomes B, C, A, D).
- **Explain:** why the chain always ends in a total order.

### 6. Swiss pairing and Buchholz

- **Read:** `src/engine/swiss.ts` (`pairSwissRound`, `pairWithoutRematches`, `swissStandings`).
- **Run:** `src/engine/__tests__/swiss.test.ts`.
- **Break it:** in `pairSwissRound`, replace `pairWithoutRematches(pool, met, budget)` with
  `null`, so it always uses the greedy fallback. The property "nobody meets twice" fails within a
  few runs.
- **Explain:** why greedy pairing alone can corner itself, and what backtracking adds.

### 7. The scheduler's "most constrained first"

- **Read:** `src/engine/scheduler.ts` (`scheduleMatches`, `compareCandidates`).
- **Run:** `src/engine/__tests__/scheduler.test.ts`.
- **Break it:** in `compareCandidates`, delete the `busiest(b.match) - busiest(a.match) ||` line.
  "places the most constrained matches first so a busy team's games all fit" fails.
- **Explain:** why greedy scheduling needs a good order, and why it is still not optimal.

### 8. One write path: results, forfeits, edit policy, Swiss rounds

- **Read:** `src/server/services/results.ts` (`applyResult`, `enforceEditPolicy`) and
  `src/lib/result-rules.ts`.
- **Run:** `npx vitest run src/server/__tests__/results.test.ts src/server/__tests__/forfeit.test.ts`.
- **Break it:** in `enforceEditPolicy`, remove the `if (!confirmed)` block. "asks for confirmation
  before resetting a played final" fails.
- **Explain:** why everything goes through one transaction, and why events are published _after_
  it commits.

### 9. Optimistic concurrency

- **Read:** `assertCurrentVersion` and the `updateMany({ where: { id, version } })` loop in
  `applyResult` (`src/server/services/results.ts`).
- **Run:** `npx vitest run src/server/__tests__/concurrency.test.ts`.
- **Break it:** delete the `assertCurrentVersion(match, options.expectedVersion);` line. Both
  "refuses a stale version" and "lets only one of two simultaneous writers … win" fail.
- **Then try:** restore that line and instead drop `version: …` from the `updateMany` condition.
  The tests still pass. SQLite runs write transactions one at a time, so the second writer always
  reads the new version and the first check catches it. The update condition is defense in depth
  for databases like PostgreSQL, where two transactions can read the same version before either
  writes.
- **Explain:** the difference between `expectedVersion` (what the client saw) and the version
  condition in the update (a race between this transaction's read and its write).

### 10. Live updates end to end

- **Read:** `src/server/pubsub.ts`, `src/server/events.ts`, `src/server/redis-pubsub.ts`,
  `src/app/api/t/[slug]/events/route.ts`, `src/components/use-live-view.ts`.
- **Run:** `npx vitest run src/server/__tests__/pubsub-contract.test.ts`, then
  `npx playwright test e2e/realtime.spec.ts`.
- **Break it:** in `createRedisPubSubFrom`, make `publish` deliver to the local registry instead
  of Redis. The contract test "delivers events published on another instance" fails, which is
  exactly the bug Redis exists to fix.
- **Explain:** SSE versus WebSockets, why clients refetch the whole view, and what happens on
  serverless hosting without Redis.
