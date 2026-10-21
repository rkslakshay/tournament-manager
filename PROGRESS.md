# Progress Log

## Final summary (2026-10-21, autonomous run)

**Phases completed:** 0, 1, 2, 3, 4, 5 and 6. Every roadmap task is checked off, and every gate (0–6) was verified. Stretch tasks were not started.

**Tests:** 230 unit and integration tests (Vitest), plus 8 Playwright E2E runs (4 scenarios × desktop and mobile), all passing. Lint and typecheck are clean.
**Engine coverage:** 100% statements, lines and functions; 97.1% branches (CI enforces 90%).

**Gate 6 check:** a fresh `git clone`, following only the README steps (`npm install`, `cp .env.example .env`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`), served `/`, `/new`, all three demo pages and the API with HTTP 200. Tests, lint, typecheck and coverage also passed in the clone.

**Assumptions made** (details in the task entries below):

1. New tournaments start in REGISTRATION. DRAFT stays in the state machine but is unused because the wizard sets the format up front.
2. `generateRoundRobin` returns `{ fixtures, byes, rounds }` rather than `Fixture[]`, because byes must be recorded.
3. Head-to-head compares mini-table points, then mini goal difference, then mini goals scored (UEFA-style), re-applied recursively.
4. Byes need no extra column. A FINISHED match with one team and no score is a bye; with no teams it is "not needed". The loser of a bye is a bye.
5. Draws are rejected in knockout stages (no extra-time or penalty fields).
6. The third-place match is silently skipped when there are no semi-finals (2 teams).
7. Generators return raw brackets, and the services always run `propagate`, so participants are resolved in one place only.
8. Stage and match ids are prefixed with the tournament id for global uniqueness. The internal id is therefore indirectly visible in public match ids; it is not a secret.
9. `editResult` shares `recordResult`'s implementation, so record and edit cannot drift apart.
10. Hand-written shadcn-style components instead of the shadcn CLI and Radix (fewer dependencies).
11. Admin links use `?token=`, as in TECHSTACK. The page moves the token to localStorage and strips it from the URL.
12. Added one route beyond DESIGN's list, `PUT /matches/:id/status`, because task 5.3 needs a way to mark matches live. Also added a scheduling UI (DESIGN organizer step 6) on top of the existing endpoint.
13. E2E runs against an isolated production build (own DB file, port and `distDir`).
14. On serverless hosting, live updates are bounded rather than instant: streams recycle every 60 s and clients re-sync every 30 s, until Redis pub/sub (S.2) is added.

**Needs your attention** (see BLOCKERS.md):

- **Task 2.3 (product decision):** a dedicated "forfeit a team" action is not built. Walkovers can be entered as normal results.
- **Task 6.2 (verification):** the PostgreSQL path (generated schema plus offline migration) passes `prisma validate`, but no live Postgres server was available here. Run the steps in BLOCKERS.md once against Neon.
- **Not done (needs your accounts):** the Vercel and Neon deployment itself, real screenshots for the README, and adding the live demo link. `docs/DEPLOYMENT.md` has the checklist.

**Exact next step to resume:** follow `docs/DEPLOYMENT.md` to deploy (or verify Postgres per BLOCKERS.md). Then start Stretch task **S.1 Swiss system pairing** in `docs/ROADMAP.md`: add `src/engine/swiss.ts` test-first, alongside the other generators.

Append newest entries at the top. Format:

```
## YYYY-MM-DD HH:MM: Task X.Y: short title
- What changed
- Decisions made and why
- Tests added / results
- Dependencies added (with justification)
- Next task
```

## 2026-10-22 04:05: Task 7.16: NEEDS_YOU.md

- `NEEDS_YOU.md` lists the only remaining manual work, in order, with copy-paste commands: create a Neon database (pooled and direct URLs); optionally Upstash Redis; `vercel login`/`link`/`env add`/`deploy --prod`; set `NEXT_PUBLIC_SITE_URL` and seed the demos (PowerShell one-liner); put the live URL in the README.

## 2026-10-22 04:05: Task 7.15: Deploy: SKIPPED

- Not attempted: `npx vercel whoami` reports "Logged out", and no Postgres connection string exists in the environment. `vercel deploy --temporary` would be possible, but without a database every page would fail, and credentials are never invented. Left unchecked in ROADMAP.md with the reason; the steps are in NEEDS_YOU.md.

## 2026-10-22 03:55: Task 7.14: Published to GitHub

- Secrets audit re-run before pushing:
  - no `.env`/`*.db` tracked or in history;
  - no token, key or credentialed-URL patterns (the only Postgres URL is the test runner's template, with a password generated at runtime for a throwaway local server);
  - no personal data beyond the public GitHub username.
- Found and fixed before publishing: frame 3 of `docs/demo.gif` showed the "Tournament created" panel with an admin link containing a token. The token belonged to a throwaway local database deleted after recording, but no published image should contain one. The recorder now masks that input (Playwright `mask`) and the GIF was re-recorded.
- Created **https://github.com/rkslakshay/tournament-manager** (public) with `gh repo create --source . --push`, added a description, and added topics: nextjs, typescript, tournament, bracket, round-robin, swiss-system, prisma, server-sent-events, property-based-testing, playwright. `main` pushed; history untouched (no force push).

## 2026-10-22 03:40: Task 7.13: Available tooling

- `git remote -v`: no remote configured.
- `gh auth status`: logged in as `rkslakshay` (keyring), scopes `repo`, `workflow`, `gist`, `read:org`. `rkslakshay/tournament-manager` does not exist yet.
- `npx vercel whoami`: **logged out**.
- Docker: not installed.
- Environment: no `DATABASE_URL`/`DIRECT_URL` for Postgres, no Neon, Vercel or Redis variables.
- Consequences: 7.14 (GitHub publish) can proceed. 7.15 (deploy) cannot: it needs a Vercel login and a Postgres connection string, and no credentials will be invented. Logged for NEEDS_YOU.md.

## 2026-10-22 03:30: Task 7.12: README polish

- README rewritten against the final code:
  - one-paragraph pitch and the demo GIF;
  - feature list (five formats, forfeits, extra time and penalties, live status, CSV, scheduler);
  - screenshots and an architecture diagram (now showing the pub/sub hub with optional Redis);
  - a tech stack table, getting started, a testing section and the other scripts;
  - a full API table (result body now with `decidedBy`/`winnerTeamId`, plus the forfeit route);
  - design decisions, an explicit **Known limitations** section and a roadmap.
- Every number in it was measured just before writing: **42 test files, 304 tests; engine 99.9% lines, 96.3% branches; all code 97.6% lines; E2E 10/10.**
- Links to `NEEDS_YOU.md` and `docs/CODE_TOUR.md` are created by 7.16 and 7.17 (checked at the end).

## 2026-10-22 03:10: Task 7.11: Demo GIF

- `npm run demo-gif` (`scripts/record-demo.mjs`) records `docs/demo.gif` (11 frames, 289 KB, 1288×520):
  - An organizer (left) creates "Friday Five-a-side Cup" in the wizard, adds 4 teams, starts it and enters both semi-finals.
  - A viewer (right) has the public page open the whole time and sees teams, the bracket and each result appear without reloading.
  - Each step is a side-by-side frame composited with `pngjs` and encoded with `gifenc`. `-- --frames` also dumps PNG frames to `.tmp/demo-frames/` for review. Embedded at the top of the README.
- Refactor: the seeded production server setup is shared by the screenshot and GIF scripts (`scripts/demo-server.mjs`); admin links stay in memory and are never printed.
- **UX bug found while reviewing the frames, and fixed:** a viewer who opened the public page before the start stayed on "Fixtures" after the tournament went live, because the default tab was decided once at first render, when there were no stages. The page now follows the best default (Standings, else Bracket, else Fixtures) until the viewer picks a tab. Screenshots were regenerated afterwards.
- Dependencies (dev): `gifenc` (small pure-JS GIF encoder; no ffmpeg needed) and `pngjs` (decode and composite Playwright screenshots).
- 304 unit/integration tests; E2E 10/10.

## 2026-10-22 02:30: Task 7.10: Screenshots

- `npm run screenshots` (`scripts/capture-screenshots.mjs`) regenerates `docs/screenshots/*.png` reproducibly:
  - Setup: its own SQLite file, `prisma migrate deploy`, the real seed (admin links parsed in-process, never printed), a production build in `.next-e2e`, `next start` on port 3200.
  - It adds a part-played 8-team double elimination through the public API, since no demo uses that format.
  - Afterwards it kills the server and deletes the database.
- Images (stable names, ~650 KB total): `home`, `standings` (groups, desktop), `bracket` (knockout, desktop), `double-elimination`, `swiss`, `mobile` (Pixel 7), `admin` (result entry), `dark-mode`. The README placeholder table is replaced with all eight.
- **Bugs found by looking at the screenshots, and fixed:**
  1. A Swiss "Live now" card was labelled **"Final"**: `shortMatchLabel` treated SWISS as a knockout, so round 4 of 4 became "Final". Fixed by treating SWISS like the league stages; a regression test was added first and failed before the fix.
  2. Team names wrapped onto two lines in standings tables. The team cell is now `whitespace-nowrap`; the table still scrolls sideways on narrow screens.
  3. A single league table took only half the page width. The two-column layout now applies only with several tables.
  4. The landing page's "Every format" card omitted Swiss.
- 304 tests passing; lint and typecheck clean.

## 2026-10-22 01:45: Task 7.9: CSV export

- `src/lib/csv.ts` (pure):
  - `csvCell`/`toCsv`: RFC 4180 quoting of commas, quotes, line breaks and edge spaces; CRLF line endings.
  - **Formula-injection guard**: text starting with `= + - @`, tab or CR gets an apostrophe prefix (team names are user input). Real numbers like `-2` are untouched.
  - `standingsCsv` (every league table, stage column, Buchholz excluded for a stable header) and `fixturesCsv` (stage, round, match label, teams or their source, scores, status, decided-by, UTC kick-off, venue). Both start with a UTF-8 BOM for Excel.
- UI: "Download standings (CSV)" and "Download fixtures (CSV)" buttons on the public tabs build the file in the browser from the view already loaded. No new endpoint and no extra server load.
- Tests: 6 unit tests, including a property test that any text round-trips through a reference RFC 4180 parser, plus the injection cases. A new Playwright test `e2e/csv.spec.ts` really clicks both buttons and reads the downloaded files (desktop and mobile). **304 unit/integration tests; full E2E suite 10/10.**
- Stretch S.3 checked off; README feature list updated.

## 2026-10-22 01:15: Task 7.8: Multi-instance live updates (pub/sub adapter)

- New `PubSub` interface (`src/server/pubsub.ts`: event types, contract, and the shared `ListenerRegistry` that isolates failing listeners) with two adapters:
  - `createMemoryPubSub` (default, synchronous, as before).
  - `createRedisPubSub(REDIS_URL)` in `src/server/redis-pubsub.ts`: one `SUBSCRIBE tm:events:<slug>` per instance while it has local viewers (unsubscribing when the last one leaves), `PUBLISH` for every event (so local and remote viewers are treated alike), lazy connections, and errors logged rather than thrown. A lost event only delays viewers until their next re-sync.
- `eventHub` picks Redis when `REDIS_URL` is set. Services and the SSE route are unchanged.
- Dependencies:
  - `ioredis` (runtime): the standard Node Redis client with pub/sub support.
  - `ioredis-mock` (dev): no Redis server is available on this machine, and the task allows the mock. Checked first that the mock delivers pub/sub across separate instances.
- Contract suite `pubsub-contract.test.ts`, run with `describe.each` against both adapters: delivery to every subscriber of the slug only, unsubscribe and subscriber counts, isolation from a throwing listener, and the cross-instance rule (Redis delivers across two hub instances standing in for two servers; memory documents that it does not). Plus Redis-specific malformed-message and foreign-channel handling, and adapter selection. 10 tests; **298 passing**; a production build (`next build`) compiles.
- Docs: DEPLOYMENT.md section rewritten, ARCHITECTURE.md §5, `.env.example`. Stretch S.2 checked off.
- About the caveat (honest status): the "up to ~30 s late" note is **kept for deployments without Redis**. With `REDIS_URL` set, cross-instance delivery is immediate, verified against `ioredis-mock` only; a live Redis has not been exercised (listed in NEEDS_YOU).

## 2026-10-22 00:30: Task 7.7: Swiss system

- Engine `src/engine/swiss.ts` (pure, written test-first):
  - `defaultSwissRounds(n)`: ceil(log2 n), capped at n-1.
  - `swissStandings`: a bye counts as a win. Order is points, then **Buchholz** (sum of opponents' points; byes add nothing), then goal difference, goals scored, seed, id.
  - `pairSwissRound`: Monrad-style pairing of neighbours in the current ranking, so teams meet others on similar scores. A depth-first search with backtracking (200k-step budget) avoids every rematch; otherwise it falls back to the fewest rematches and reports them rather than failing. Odd counts give the bye to the lowest-ranked team without one. Home goes to the team with fewer home games.
  - Assumption: Monrad (adjacent pairing) instead of FIDE Dutch top-half-vs-bottom-half pairing. It is simpler to prove correct, still pairs within score groups, and is a recognised Swiss variant. Logged as a known limitation.
- Service integration:
  - New `SWISS` format with optional `swissRounds`. The start service fixes the round count (default as above; more than n-1 is rejected) and plans round 1.
  - `applyResult` pairs the next round in the same transaction when the latest round completes (new `services/swiss-rounds.ts`). New match ids appear in `changedMatchIds`, so live viewers refresh.
  - The tournament completes after the last round. Editing an earlier result recomputes standings but never re-pairs.
- Public view: Swiss standings carry `buchholz`; the table shows a "BH" column (with an `<abbr>` explanation); the champion is the standings leader once completed. Stage title "Swiss standings". Draws are allowed (league rules).
- Wizard: Swiss option with an optional rounds field (empty means automatic). Legs are hidden for Swiss and the review text is correct.
- Demo: fourth seeded tournament `demo-swiss` ("Autumn Rapid Open", 10 players, 4 rounds, 3 played, one game live), linked from the landing page.
- Docs: ARCHITECTURE.md §3.9, README features. Stretch S.1 checked off.
- Tests: `swiss.test.ts` (11, including property tests over 2-24 teams: one game per team per round, no rematch, at most one bye each, deterministic pairing whatever the input order), `swiss-service.test.ts` (5), seed assertions. **288 passing.** `swiss.ts` coverage 99.4% lines, 91% branches; engine overall 99.9% lines, 96.3% branches.

## 2026-10-21 23:20: Task 7.6: Knockout draws via extra time or penalties

- `resultBody` gains optional `decidedBy` (`REGULAR | EXTRA_TIME | PENALTIES`) and `winnerTeamId`. With neither field, behaviour is exactly as before (knockout draws rejected, league draws allowed).
- Rules live in pure `src/lib/result-rules.ts` (`decideResult`), used by both the service and the admin form:
  - League stages: regular time only; a level score is a draw.
  - Knockout: the higher score wins (`REGULAR` or `EXTRA_TIME`). A level score is accepted only as `PENALTIES` with a shoot-out winner who is in the match. A winner that contradicts the score is rejected, as is `PENALTIES` on a non-level score.
  - Assumption: a level knockout score with a winner but no `decidedBy` is read as penalties.
- The engine needed no change: propagation already advances whoever `winnerTeamId` names, including on level scores. The shoot-out score itself is not stored (listed under future improvements).
- UI: knockout result rows get "Decided in" (Regular time / Extra time / Penalties) and, for penalties, a "Shoot-out winner" picker, validated client-side by the same rules. The optimistic view honours the explicit winner. Public match cards show `AET` / `Pens` / `W/O` as `<abbr>` labels.
- Refactor: renamed the view-model helper `isWalkover` to `isAutoDecided` (it means a bye or a not-needed match), so it no longer clashes with real walkovers.
- Docs: DESIGN.md edge case, ARCHITECTURE.md entity and README design decision updated.
- Tests: `knockout-decisions.test.ts` (4 service tests: penalties advance the chosen winner, extra time, every invalid combination, league restrictions), `result-rules.test.ts` (3, including a property test that every accepted knockout result has a playing winner, and the score winner when scores differ), a route test, and an optimistic-winner assertion. **272 tests passing.**
- PostgreSQL re-verified after the schema change: `npm run test:pg` applied both Postgres migrations (`init`, `match_decided_by`) and passed **109 tests**.

## 2026-10-21 22:30: Task 7.5: Forfeit / walkover

- Schema: new nullable `Match.decidedBy` (`REGULAR | WALKOVER`; 7.6 adds extra time and penalties). SQLite migration `*_match_decided_by` via `migrate dev`. The Postgres migration `20261021100000_match_decided_by` was generated offline by diffing the previous generated schema against the new one.
- Config: `walkoverScore { winner, loser }`, default 3-0, validated (winner > loser).
  - Assumption for "or 1-0 by sport": the wizard sets 1-0 for game-scored sports (chess, tennis, table tennis, badminton, squash, esports) and 3-0 otherwise (`defaultWalkoverScore`, tested). The review step shows it.
- Service: `recordResult` and the new `forfeitMatch` now share one `applyResult` core (the same transaction, propagation, edit policy, version checks and events). A forfeit is stored as an ordinary result with `decidedBy: WALKOVER`. Standings, bracket advancement, champion detection and the reset confirmation all work unchanged, and the engine needed no change.
- Correctness detail: the persistence mapper clears `decidedBy` whenever the score is cleared, so propagation-reset matches never keep a stale walkover marker. `decidedBy` is part of change detection.
- Route: `PUT /api/t/:slug/matches/:matchId/forfeit` (admin, zod `forfeitBody { teamId, expectedVersion?, confirmReset? }`). Added to the route inventory, the auth-guard test, the README API table and DESIGN.md.
- UI: a "Forfeit…" button on every playable admin row opens a dialog to pick which team forfeits; it uses the same confirmation flow. Admin rows and public match cards show `W/O` (`<abbr title="Walkover">`).
- Tests (all written before the service): 6 service tests (default 3-0 counted in standings, configured 1-0, bracket propagation, edit policy plus reset clearing `decidedBy`, a regular result replacing a walkover, invalid team/bye/stale version), 2 route tests, a wizard test, and updated config-default and repository round-trip expectations for the new field. **264 tests passing.**
- BLOCKERS 2.3 is marked resolved.

## 2026-10-21 21:40: Task 7.4: PostgreSQL verified for real

- Docker: not installed on this machine (`docker: command not found`), so the second option was used.
- `embedded-postgres@17.10.0-beta.17` (devDependency): ships real PostgreSQL binaries per platform, which makes Postgres testable with no Docker or system install. Only beta versions are published; the binaries are stock PostgreSQL 17.
- `npm run test:pg` (`scripts/test-postgres.mjs`):
  1. Starts a throwaway server on port 54329 with a random password in `.tmp/pg-data`.
  2. Generates the Postgres client.
  3. Runs a real `prisma migrate deploy` of `prisma/postgres/migrations` into an empty database: the migration applied cleanly.
  4. Runs every test under `src/server` with `TEST_POSTGRES_URL` set. `test-db.ts` then gives each test file its own PostgreSQL database built from the production migration SQL, and drops it with `WITH (FORCE)` afterwards.
  5. Always: stops the server, deletes its data, and regenerates the SQLite client.
- Result: **17 files, 96 tests passed on PostgreSQL 17, with no incompatibilities.** The JSONB sources, unique constraints (P2002), the transactions and the optimistic-concurrency race test all behave the same as on SQLite.
- Cleanup verified: nothing is listening on 54329, the data dir is removed, and the SQLite suite still passes (255). A pre-existing PostgreSQL Windows service on port 5432 belongs to the machine and was not touched.
- A CI job `postgres` runs `npm run test:pg` on every push. BLOCKERS 6.2 is marked resolved. The README lists the script.
- Also deleted old scratch files under the ignored `.tmp/` that held local test admin tokens.

## 2026-10-21 21:00: Task 7.3: Skeptical engine review

- New `src/engine/__tests__/edge-cases.test.ts` (24 tests) covers the gaps the existing suites didn't pin down:
  - Round robin at 2, 3, 5, 17 and 128 teams (128 gives 127 rounds and 8,128 unique pairings).
  - Single and double elimination played to completion at 2, 3, 5, 17 and 128 teams.
  - Groups + knockout with 17 teams (uneven groups 5/4/4/4, advancers capped by the smallest group).
  - The scheduler with zero slots.
  - All-draw tables, a perfect 4-way cycle, and a 3-way cycle with no seed in the chain (alphabetical, then id).
  - Deep double-elimination edits: flipping a round-one result after the entire bracket is played invalidates the winners and losers paths through to GF1; untouched results survive; GF2 returns to PENDING; replaying still eliminates everyone after two losses. Turning GF1 into an upset brings the "not needed" reset match back.
- **Bugs found and fixed:**
  1. **Duplicate team ids were accepted** by the single-elimination, double-elimination and groups + knockout generators (only the round robin checked). A bracket could contain the same team twice. They now throw.
  2. **Duplicate seeds made brackets depend on input order.** The generators used a stable sort on seed alone, so two calls with the same teams in a different order produced different brackets. The service always assigns unique seeds, so this was latent, but the engine contract should be deterministic.
  - Fix for both: new `orderBySeed` in `src/engine/seeding.ts` (seed, then id; rejects duplicate ids), used by every generator and `planStages`.
- Tests: 25 new, 255 total. Engine coverage after the change is shown below.
- Engine coverage after 7.3: lines 100 %, branches 97.16 %.

## 2026-10-21 20:40: Task 7.2: Secrets and junk audit

- Checked:
  - Tracked files for `.env`, `*.db`, build, coverage and test output: none tracked. The full history also never contained `.env` or `*.db` files.
  - Secret patterns (GitHub tokens, OpenAI-style keys, AWS keys, private keys, credentialed Postgres URLs, `password=`): no matches.
  - Personal data (account name, email): none in tracked files.
  - Largest tracked file: `package-lock.json` at 308 KB; everything else is under 60 KB.
- `.env.example` contains only the SQLite path and commented placeholders. Admin tokens printed by the seed script and saved during manual testing live only in the ignored `.tmp/` and the terminal.
- Fixed: `.gitignore` used trailing-slash directory patterns, which only match once the directory exists (`git check-ignore playwright-report` reported NOT-IGNORED). It is rewritten with slash-agnostic patterns, plus `.vercel`, `.env.*.local`, `*.log` and OS files.

## 2026-10-21 20:30: Task 7.1: Independent clean-state verification

- Method: fresh `git clone` into a scratch directory, `npm ci` (463 packages, 31 s), `cp .env.example .env`, `prisma migrate deploy`, then every check. Nothing reused from the working copy.
- Measured results:
  - `npm run lint`: 0 problems.
  - `npm run typecheck`: 0 errors.
  - `npm run test:cov`: **34 test files, 230 tests, all passing**. Overall coverage 97.22% lines, 96.07% branches. **Engine: 100% lines, 97.11% branches**, 100% functions.
  - `npx playwright test`: **8 passed** (4 scenarios × desktop and mobile) against an isolated production build.
- `npm audit --omit=dev`: 5 advisories (1 moderate, 4 high), all in build/CLI tooling:
  - `postcss` (bundled by `next`, used to compile our own CSS at build time);
  - `deepmerge-ts` via `@prisma/config` (the Prisma CLI's config loader).
  - Neither processes user input at runtime. The only offered fix is a forced major upgrade to Next 16; not taken now (logged as a known limitation).
- These numbers match the Phase 6 summary.

## 2026-10-21 19:50: Task 6.5: docs/INTERVIEW_NOTES.md

- Plain-language answers, each pointing at the backing code: architecture, byes (including double-elimination "ghost" byes), edited results (propagation, invalidation, policy, versions), derived standings and recursive head-to-head, live updates and how to scale them (Redis pub/sub, edge caching), the scheduler heuristic and why its tie-break exists, testing strategy, and next steps.
- Next: Gate 6 (a fresh clone runs with the documented steps only).

## 2026-10-21 19:35: Task 6.4: README

- Rewritten README sections: pitch, demo note, screenshot placeholders (table with target paths under `docs/screenshots/`), feature list, Mermaid architecture flowchart plus layer summary, getting started, full script table, API table (including the status and events routes), testing strategy, design decisions, "what I'd improve next", and project layout.
- Screenshots are placeholders, as the roadmap asks. Real images need the deployed demo.
- Next task: 6.5 INTERVIEW_NOTES.

## 2026-10-21 19:15: Task 6.3: Deployment config (Vercel + Neon)

- `vercel.json`: Next.js framework, `buildCommand: npm run build:prod` (Postgres client, `migrate deploy`, `next build`).
- `docs/DEPLOYMENT.md` covers:
  - Neon setup (pooled `DATABASE_URL` with `pgbouncer=true`, direct `DIRECT_URL`) and the env var table.
  - Seeding production and the two-schema workflow for future migrations.
  - A deploy checklist.
  - Honest notes on serverless limits for SSE and rate limiting.
- Serverless real-time hardening (decision):
  - The in-memory hub only reaches viewers on the same instance. The `/events` route sets `maxDuration = 60`, so streams recycle and the client refetches on each reconnect.
  - `useLiveView` also re-syncs every 30 s while connected. Worst case on Vercel is about 30 s; on a single server, updates stay instant.
  - Redis pub/sub (Stretch S.2) is the documented fix.
- Not deployed: deploying needs the owner's Vercel and Neon accounts. The config and docs are ready.
- Tests: 230 passing; lint and typecheck clean.
- Next task: 6.4 README.

## 2026-10-21 18:55: Task 6.2: PostgreSQL for production, env vars documented

- Prisma cannot switch providers by environment variable, so production uses a generated schema.
  - `scripts/postgres-schema.mjs` (`npm run db:pg:schema`) writes `prisma/postgres/schema.prisma`: same models, `postgresql` provider, plus `directUrl = env("DIRECT_URL")` because Neon's pooled connection cannot run migrations.
  - Its migrations live in `prisma/postgres/migrations/`. The init migration was generated offline with `prisma migrate diff --from-empty --to-schema-datamodel` (no database needed).
- New scripts: `db:pg:schema`, `db:pg:generate`, `db:pg:deploy`, and `build:prod` (generate the Postgres client, apply migrations, `next build`).
- Drift guard: `postgres-schema.test.ts` fails if the generated schema is stale or the migration lacks a table for any model.
- Env vars documented in `.env.example`: `DATABASE_URL` (SQLite in dev, pooled Postgres in prod), `DIRECT_URL`, `NEXT_PUBLIC_SITE_URL`, and both rate limits.
- Not verified against a live PostgreSQL server (none available here); logged in BLOCKERS.md with exact verification steps. The schema passes `prisma validate`.
- Tests: 3 new, 230 total.
- Next task: 6.3 deployment config (Vercel + Neon).

## 2026-10-21 18:30: Task 6.1: Seed script with three demo tournaments

- `src/server/seed.ts` (`seedDemo(db)`) builds the demo tournaments linked from the landing page through the real services, so propagation, standings and versions are exactly what users get:
  - `demo-league`: 8-team round robin, 20 results, one match live.
  - `demo-cup`: 12-team single elimination with a third-place match, 4 byes for the top seeds, 6 results, one match live.
  - `demo-world-cup`: 16 teams in 4 groups of 4, top 2 advance; all 24 group matches and the 4 quarter-finals played, semi-finals ready.
  - All three are auto-scheduled across two fields.
- Scores come from the seeded PRNG, so every run is identical. Knockout draws are nudged into a winner. Re-running deletes earlier demo copies first (idempotent). Fixed slugs are set after creation; admin tokens are random each run and printed by `npm run db:seed`.
- `prisma/seed.ts` now calls `seedDemo` and prints the public and admin links, replacing the 0.3 stub.
- Found while testing: playing the earliest-scheduled match first meant a knockout tie could be played as soon as its two groups ended, before other groups (correct scheduler behaviour, odd for a demo). The seed now plays league stages first, then knockout rounds in order.
- Verified: `npm run db:seed` populates the dev DB and `/t/demo-world-cup` shows the bracket with quarter-finals played.
- Tests: 2 new, 227 total (shapes of all three demos, repeatability).
- Next task: 6.2 PostgreSQL for production.

## 2026-10-21 17:50: Gate 5: passed

- `e2e/realtime.spec.ts` uses two isolated browser contexts, an organizer and a viewer.
  - The viewer's page reaches live mode. "Mark live" in admin makes "Live now" appear for the viewer.
  - Saving 2-1 in admin updates the viewer's derived league table (Rovers 3 pts) and shows "Champion: Rovers". A `window` marker proves the viewer never reloaded.
- It passes on desktop and mobile; the full E2E suite is 8/8. Unit and integration tests: 225 passing; lint and typecheck clean.
- Next task: 6.1 seed script with demo tournaments.

## 2026-10-21 17:50: Task 5.3: Live match status and indicators

- New service `setMatchStatus`: SCHEDULED ⇄ LIVE only (finished, pending and bye matches are refused), with the same `expectedVersion` check and version-guarded write as results, publishing `match_updated` after the commit. A LIVE match is finished by entering its result as usual.
- New route `PUT /api/t/:slug/matches/:matchId/status` (admin, zod `matchStatusBody`). This is the one route beyond DESIGN.md's API list; task 5.3 needs a way to mark matches live. It has been added to the route inventory and API tests, and to the README.
- UI:
  - The admin result row has a "Mark live" / "End live" toggle and a pulsing "Live" label.
  - The public page has a "Live now" section above the tabs. Match cards already show "Live" as text plus a dot, with an accent border.
- Tests: 5 new, 225 total (service, route, auth guard).

## 2026-10-21 17:15: Task 5.2: Public page subscribes, refetches, polling fallback

- `src/components/use-live-view.ts` (`useLiveView`) opens an `EventSource` on `/api/t/:slug/events`. On `match_updated` or `tournament_updated` it refetches the full public view, debounced 250 ms. It applies the full current state rather than patches, so a missed event can never leave the page wrong (DESIGN.md).
  - It also refetches after a reconnect and when the tab becomes visible again.
  - Fallback: if `EventSource` is unavailable, or SSE errors 3 times in a row without opening, it closes the stream and polls every 10 s (TECHSTACK.md).
- The public page shows a small "Updates automatically" / "Refreshing every 10 s" note next to the status badge.
- The admin page uses the same hook, so two organizers see each other's changes without reloading. Optimistic result entry still works through the hook's `setView`.
- Verified in the browser: with the public page open, a result posted through the API appeared within about 1.5 s without a reload (a JS marker on `window` survived). The automated proof is Gate 5's E2E test (5.3).
- Next task: 5.3 live match status and indicators.

## 2026-10-21 16:55: Task 5.1: SSE hub and /events endpoint

- `src/server/events.ts`: an in-memory `eventHub` keyed by slug, with subscribe (returns unsubscribe), publish and `subscriberCount`. A listener that throws is isolated from the others. It is kept on `globalThis` so dev hot reloads don't orphan connections. Events are `match_updated { matchIds }` and `tournament_updated`.
- Services publish after their transaction commits, never inside it, so a rolled-back write never notifies anyone:
  - `recordResult`/`editResult` publish `match_updated` with every changed match.
  - `startTournament`, the team changes and `scheduleTournament` publish `tournament_updated`.
  - Team writes now share a `withTeamChange` helper for this.
- `GET /api/t/:slug/events` returns a `text/event-stream` with `retry: 3000`, one `event:`/`data:` frame per event, a 25 s comment heartbeat, and `no-cache, no-transform` plus `X-Accel-Buffering: no` so proxies don't buffer. It unsubscribes on client abort or stream cancel, and returns 404 for unknown slugs.
- The route inventory test now includes the events route, which is covered in its own suite.
- Test fix: the shared fixture `makeTournament` called `addTeams([])` for zero teams, which correctly fails validation. The fixture now skips the call; the service behaviour is unchanged.
- Tests: 5 new, 220 total. Covered: hub delivery and isolation, the order of published events across a real flow (failed writes publish nothing), and the stream contents and unsubscription.
- Next task: 5.2 public page subscribes and refetches.

## 2026-10-21 16:30: Gate 4: passed (Playwright walkthrough)

- `e2e/walkthrough.spec.ts` runs on desktop Chrome and a Pixel 7 profile. All 6 pass.
  1. A full knockout through the UI only: create via the wizard, open the admin link (token stripped from the URL), paste 4 teams, reseed with a button, preview, start via the dialog, and enter both semis and the final. Then flip a semi-final, confirm the reset dialog naming the final, replay the final, and check the public page shows "Champion", "Completed", the Bracket tab by default, and fixtures.
  2. A round robin where a result puts the winner top of the derived "League" table with 3 points.
  3. Unknown slugs return 404 with the not-found page.
- Isolation (`e2e/start-server.mjs`): a fresh `prisma/e2e.db` with migrations applied, a production build in `.next-e2e` (`distDir` is configurable via `NEXT_DIST_DIR`), port 3100 and relaxed rate limits. Running E2E never touches dev data or a running `npm run dev`.
  - Decision: production build rather than `next dev`, because the dev-tools overlay button ("Open Next.js Dev Tools") collided with role locators and on-demand compilation made timing flaky.
- CI: a new `e2e` job (after `check`) installs Chromium and runs `npm run test:e2e`, uploading traces on failure.
- Dependencies: @playwright/test (TECHSTACK).
- Unit and integration tests: 215 passing; lint and typecheck clean.
- Next task: 5.1 SSE hub and `/events` endpoint.

## 2026-10-21 15:50: Task 4.6: Mobile polish, dark mode, accessibility pass, OG metadata

- Mobile (checked at 375 px in the browser):
  - Standings hide the F/A columns below `sm`, so P W D L GD Pts fit without scrolling. There is no page-level horizontal overflow.
  - Admin result rows restack on phones (full team names, Save on its own line) and show each match's label, which distinguishes "3rd place" from "Final".
  - Group tables go two-up only at `xl`. Tables no longer have a min-width that overflowed in two columns.
- Dark mode follows the OS. Light mode was also checked in the browser.
- Accessibility:
  - A scripted audit of `/`, `/new`, a public page, the admin page and a bracket page found no unlabelled controls, no nameless buttons or links, exactly one h1, and `lang` set.
  - It did find a heading jump (h1→h3) in the bracket and the single-stage fixtures list, and duplicate ids on round headings. Both fixed: bracket section titles are h2, round headings are h2 or h3 by depth, and sections use `aria-label`.
  - Earlier work already provides: a skip link, a visible focus ring, labelled score inputs, keyboard tabs, native `<dialog>`, and text alongside every colour cue.
- OG metadata:
  - `generateMetadata` on `/t/[slug]` sets title, description, canonical, Open Graph and a Twitter `summary_large_image` card.
  - `opengraph-image.tsx` renders a 1200×630 preview card (name, sport, format, team count, status) with the built-in `next/og`, so no new dependency.
  - `metadataBase` comes from `NEXT_PUBLIC_SITE_URL`.
- Added `src/app/not-found.tsx`.
- Next: Gate 4 (Playwright walkthrough).

## 2026-10-21 15:10: Task 4.5: Bracket visualization

- `src/lib/bracket-layout.ts` (pure, tested): `layoutBracket` places matches in one column per round.
  - Round-one matches stack one per row. Later matches are centred on their in-section feeders; a single feeder keeps the same height, which suits losers-bracket drop-down rounds.
  - Matches with no in-section feeder (the third-place match) go below the column.
  - It also returns the feeder→match edges.
- `Bracket` component: absolutely positioned compact `MatchCard`s with SVG elbow connector lines and round headings per column. It sits in a horizontally scrollable, focusable container so it works on mobile.
  - Double elimination renders Winners, Losers and Grand-final sections. GF1→GF2 is connected because GF2 is fed by GF1's winner.
  - Winners are in bold, TBD and bye slots are muted italics, and status is text.
- The public page gains a Bracket tab for SINGLE_ELIM and DOUBLE_ELIM stages (including the knockout of groups + knockout). The default tab is Standings when league tables exist, otherwise Bracket.
- Verified visually on a 6-team double elimination with 7 results: top-seed byes, connectors, the winners final, and losers-bracket byes propagated from losers of bye matches.
- Tests: 4 new, 215 total.
- Next task: 4.6 mobile polish, dark mode, accessibility, OG metadata.

## 2026-10-21 14:40: Task 4.4: Public page with standings and fixtures tabs

- `/t/[slug]`: a server-rendered page (`force-dynamic`, metadata title from the tournament) that passes the view to the client `PublicTournament`. Unknown slugs give 404.
- Header: sport, format, team count, name, status badge (Live / Upcoming / Completed), a Share button that copies the URL (read after hydration to avoid a mismatch), and a champion banner once decided.
- Tabs (`src/components/ui/tabs.tsx`): WAI-ARIA tablist with arrow/Home/End keys and a roving tabindex. Standings shows only when there are league stages, and is then the default tab.
- `StandingsTable`: P W D L F A GD Pts with `<abbr>` titles, sticky header and horizontal scroll on narrow screens. Qualification places are highlighted with a background, a left bar, a visible "Q" and screen-reader text, so meaning never relies on colour alone.
- `FixturesList` and `MatchCard`: grouped by stage and round. Each card shows the score, winner in bold (plus screen-reader "winner"), TBD slots in muted italics with their source ("Winner of SF 1"), Live/FT/Bye/Not needed status as text, and kick-off time and venue when scheduled.
- Before the start, the page lists the teams by seed with a note that fixtures will follow.
- Verified in the browser on a groups + knockout tournament with partial results: both group tables render with derived standings and Q markers.
- Next task: 4.5 bracket visualization.

## 2026-10-21 14:10: Task 4.3: Fixtures preview, start, result entry, edits with confirmation

- Before the start, `StartPanel` previews fixtures in the browser with the same pure `planStages` the server uses: match and round counts per stage, round-one pairings, and a readable error when the settings cannot work (e.g. too few teams for the groups). Start asks for confirmation in a native `<dialog>` (`ConfirmDialog`), explaining that teams lock.
- After the start, `ResultsPanel` shows every stage grouped by round (double elimination in order: winners, losers, grand final).
  - Each playable match is a labelled form with two numeric score inputs and Save/Update, operable from the keyboard.
  - Pending slots show where teams come from ("Winner of SF 1", "Group A 1st"). Byes show "Advances on a bye" or "Not needed".
  - Client-side checks give whole-number scores and "Knockout matches need a winner" before any request is sent.
  - Saving is optimistic (`withOptimisticResult`), then replaced by the server's propagated view. On failure the view is rolled back. `expectedVersion` is always sent; VERSION_CONFLICT shows the message and reloads.
  - CONFIRMATION_REQUIRED opens a dialog listing the matches whose results will be cleared; confirming resends with `confirmReset`.
- `SchedulePanel` (DESIGN organizer step 6, using the existing endpoint): venues, start time, slot length and rest slots. It reports how many matches did not fit.
- New pure modules, tested:
  - `src/lib/match-labels.ts`: round names (Final, Semi-finals, Round of 16, Winners final, Losers round N, Grand final (reset)), short labels (SF 1, QF 2, WB R2 M1, 3rd place), ordinals and source labels.
  - `src/lib/view-model.ts`: match index, team names, slot text, rounds per stage, walkover detection, config from view, optimistic result, `allowsDraws`.
- Verified in the browser on a 4-team single elimination with a third-place match:
  - The preview matched (1v4, 2v3, 4 matches).
  - Start went through the dialog. A knockout draw was blocked client-side.
  - Both semis saved and filled the final and third-place match. The final was saved.
  - Flipping a semi raised the confirmation listing the final; confirming reset it and re-seeded the final with the new winner.
  - A redundant "Final (Final)" label in that dialog was found and fixed.
- Tests: 11 new, 211 total.
- Next task: 4.4 public page.

## 2026-10-21 13:20: Task 4.2: Admin team management and seed reordering

- `/t/[slug]/admin` (server page, `noindex`) loads the view with `loadPublicView`, which is React-`cache`d per request and returns null for unknown slugs (404). It renders the client `AdminApp`.
- `AdminApp`: header with status badge and public link, an aria-live notice area, and shared `AdminActions`. `api` calls admin endpoints with the bearer token. `run` performs a write, refreshes the view and reports success or the API error; on UNAUTHORIZED it forgets the stored token.
- `useAdminToken`: moves `?token=` from the admin link into localStorage (per slug) and removes it from the address bar. Without a token, the page explains that the admin link is needed and links to the public page.
  - Bug found in the browser and fixed: a raw `history.replaceState` in a child effect was undone by the App Router's own initial history entry, so the token reappeared. It now uses `router.replace`.
- `TeamManager`: paste box (one per line; commas and tabs also split) with a live count. The seed list supports drag-and-drop plus keyboard-operable ↑/↓ buttons and remove buttons with descriptive aria-labels.
- `StatusBadge`: Draft / Upcoming / Live / Completed / Archived as text, with a pulsing dot for Live, so meaning never depends on colour alone.
- Pure helpers `parseTeamList` and `moveItem` in `src/lib/team-list.ts` are tested, including a permutation property.
- Verified in the browser: adding 5 teams, moving a team up, removing a team (seeds close up), and the token moving out of the URL.
- Tests: 3 new, 200 total.
- Next task: 4.3 fixtures preview, start, result entry, edits.

## 2026-10-21 12:40: Task 4.1: Landing page and create wizard

- Landing page (`/`): hero, "Create a tournament" CTA, feature list, and links to three demo tournaments. The slugs `demo-league`, `demo-cup` and `demo-world-cup` live in `src/lib/demo.ts`; the seed script (6.1) will create them.
- Layout: header with brand and CTA, skip link, footer. One emerald accent colour defined as Tailwind `@theme` tokens. Dark mode follows the OS (`prefers-color-scheme`) and the global focus ring is visible.
- Create wizard (`/new`) in three steps:
  1. Basics: name, plus sport with datalist suggestions.
  2. Format and rules: format radio cards with help text; per-format options (legs and points for league formats, groups and advancers, third place, grand-final reset); edit policy.
  3. Review.
  - The wizard validates per step with the shared zod schema, then shows the success panel with the copy prompt from DESIGN.md, the admin link and a copy button.
- `src/lib/wizard.ts` (pure, tested) maps form state to a create request and keeps only the settings relevant to the chosen format. `src/lib/api-client.ts` (`apiFetch`, `ApiError`) is the typed client.
- UI kit: small hand-written components in the shadcn style (`Button`, `Field` with label/hint/error ARIA wiring, `Card`, `CopyButton`). Decision: shadcn/ui is a copy-in pattern, so writing a handful of components avoids pulling in Radix, cva and the rest for the few controls this app needs.
- Admin link format: `/t/{slug}/admin?token=…`, as in TECHSTACK.md. The admin page (4.2) moves the token into localStorage and strips it from the URL.
- Verified in the browser: empty-field validation messages, step navigation, and creation through the real API reaching the success panel.
- Tests: 4 new (wizard mapping), 197 total. Added `.claude/launch.json` for the dev server.
- Next task: 4.2 admin team management.

## 2026-10-21 12:00: Gate 3: passed

- Every route file under `src/app/api` is exercised for success, validation failure, auth failure and state conflicts. The inventory test fails if a new route file appears without being added to the suite (the SSE route is excluded until 5.1 adds its own tests).
- Every route with a body validates it with a zod schema from `src/lib/api-schemas.ts`. Path params are checked by the services (404 for unknown or foreign ids).
- 193 tests passing; lint, typecheck and `next build` are clean. README now documents the API.
- Next task: 4.1 landing page and create wizard.

## 2026-10-21 12:00: Task 3.4: API tests

- `src/server/api/__tests__/routes.test.ts` (20 tests) calls the real route handlers against a temporary SQLite DB.
- Coverage by area:
  - Create: success, bad config, malformed JSON.
  - Public view: no token leakage, 404.
  - Auth: missing, wrong and cross-tournament tokens; unknown slug; every admin route guarded.
  - Teams: add, duplicates, after-start; remove, unknown team, after-start; reorder, partial order, bad body.
  - Start: success, too few teams, twice.
  - Results: success with propagated view, invalid score, knockout draw, unknown match, another tournament's match, stale version, confirmation-required then confirmed reset.
  - Schedule: success, invalid body, before start.
- Each test uses its own fake client IP so per-client rate limits don't interfere.

## 2026-10-21 11:35: Task 3.3: Rate limiting on writes

- `src/server/api/rate-limit.ts`: a fixed-window in-memory `RateLimiter` with an injectable clock and pruning of expired windows past 10k keys, plus `clientKey` (first `x-forwarded-for` hop, then `x-real-ip`) and `enforceRateLimit`, which throws RATE_LIMITED (429 with `Retry-After`).
- Limits: tournament creation is 10 per hour per client; every admin write is 120 per minute per client. Both are configurable via `RATE_LIMIT_CREATE_PER_HOUR` and `RATE_LIMIT_WRITES_PER_MINUTE`, documented in `.env.example`.
- The write limit is applied inside `requireAdmin`, before the token check, so admin-token guessing is throttled too. Public GETs are not limited; they are cheap and can be edge-cached.
- Known limitation: the limiter is per server instance (in memory). The multi-instance fix is Redis, the same move as the SSE hub (Stretch S.2).
- Tests: 6 new, 173 total, at unit level and against the real route handlers.
- Next task: 3.4 API tests.

## 2026-10-21 11:15: Task 3.2: Routes and admin auth

- Every route from DESIGN.md is implemented as a Next.js App Router handler under `src/app/api/`:
  - `POST /api/tournaments` returns 201 `{ slug, adminToken }`.
  - `GET /api/t/:slug` returns the public view with `Cache-Control: no-store`.
  - `POST /teams` returns 201 `{ teams }`.
  - `DELETE /teams/:teamId` and `PUT /teams/order` return `{ teams }`.
  - `POST /start` returns the view.
  - `PUT /matches/:matchId/result` returns `{ changedMatchIds, resetMatchIds, status, view }`. The view is included so the admin UI updates without a second request.
  - `POST /schedule` returns `{ scheduled, unscheduled }`.
  - The SSE `/events` route arrives in 5.1.
- Admin guard: `requireAdmin(request, slug)` reads `Authorization: Bearer <token>` and checks it in constant time. It runs before the body is parsed, so unauthenticated requests get 401 regardless of payload.
- New service `scheduleTournament`, behind `POST /schedule`. It replaces the tournament's venues, runs the engine scheduler over open matches (generous slot budget: open × (rest + 1) + 1), sets `scheduledAt = startTime + slot × slotMinutes` and the venue, and clears the schedule of matches that don't fit. It runs in one transaction and bumps versions.
- API tests call the route handlers directly. `useApiTestDb()` points `getDb()` at a fresh SQLite DB through the same global slot used for the dev hot-reload cache.
- Tests: 4 new, 167 total (schedule service plus an end-to-end API smoke test). `next build` passes, which validates the handler signatures.
- Next task: 3.3 rate limiting.

## 2026-10-21 10:50: Task 3.1: zod schemas and error format

- `src/lib/api-schemas.ts` defines the request body schemas for every write endpoint: create tournament, add teams, reorder, result, schedule. It also defines the `ApiErrorBody` type. The schemas live in `lib/` so client forms validate with the same rules.
- The services now reuse these schemas instead of keeping their own copies. Validation rules exist exactly once.
- `src/server/api/http.ts`:
  - `json`.
  - `errorResponse`: ServiceError → its status plus `{ error: { code, message, details? } }`; ZodError → 400; anything else → generic 500 with the cause logged server-side only; `Retry-After` on 429.
  - `parseBody`: malformed JSON and schema failures → 400 VALIDATION with zod's flattened details.
  - `handle`: wraps a handler and converts thrown errors.
  - `bearerToken`.
- Tests: 8 new, 163 total.
- Next task: 3.2 routes and admin auth.

## 2026-10-21 10:30: Gate 2: passed

- All 155 tests pass, including the service integration tests against temporary SQLite databases. Lint and typecheck are clean.
- State-transition coverage:
  - The full transition table is asserted, including illegal moves (ARCHIVED→IN_PROGRESS, DRAFT→IN_PROGRESS).
  - Starting twice or from DRAFT is refused.
  - Team changes after the start are refused.
  - Results are refused before the start, on pending matches and on byes.
  - COMPLETED→IN_PROGRESS happens when an edit re-opens matches.
- Coverage: overall 99.2% lines; engine 100% lines, 96% branches; services above 92%. `db.ts` is untested because tests inject their own client; it is covered by API and E2E tests later.
- Next task: 3.1 zod schemas and error format.

## 2026-10-21 10:30: Task 2.7: Optimistic concurrency via match version

- `recordResult` / `editResult` accept `expectedVersion`. If it is stale, they throw VERSION_CONFLICT (409, "This match was changed by someone else. Reload to see the latest result.", `details: { matchId, currentVersion }`) and change nothing.
- Every changed row is written with `updateMany where { id, version }`, so a concurrent write that lands between the read and the write also aborts the transaction with VERSION_CONFLICT. This applies even without `expectedVersion`.
- Without `expectedVersion`, the behaviour is last-write-wins per match, as DESIGN.md describes.
- Tests: 4 new, 155 total, including two simultaneous writers with the same version (exactly one wins).

## 2026-10-21 10:10: Task 2.6: getPublicView

- `getPublicView(db, slug)` returns a `PublicView` (types in `src/lib/public-view.ts`, shared with the UI).
  - Contents: tournament (slug, name, sport, status, format, public rules), teams, venues, and stages with matches. ROUND_ROBIN and GROUP stages also get standings computed on read with `computeStandings`; standings are never stored.
  - Excluded: the admin token hash, the tournament's internal id and the edit policy.
- `championOf` (pure, in `lib/`): the final's winner for single elimination and groups + knockout. For double elimination it is the GF2 winner, or the GF1 winner once GF2 is "not needed". For a round robin it is the leader, only once COMPLETED.
- Accepted trade-off: match ids carry the tournament id as a prefix (needed for global uniqueness), so the internal id is indirectly visible. It is not a secret (edits need the admin token), and this is documented here.
- Tests: 6 new, 151 total. Covered: no secrets in the serialised JSON, derived standings, per-group tables, champions for every format (including the double-elimination reset), not-found, and pre-start views.
- Next task: 2.7 optimistic concurrency.

## 2026-10-21 09:50: Task 2.5: recordResult and editResult with propagation and invalidation policy

- `recordResult(db, tournamentId, matchId, { homeScore, awayScore, confirmReset })` runs in one transaction:
  1. Validate status (IN_PROGRESS or COMPLETED) and match readiness. Both teams must be known; byes cannot be scored.
  2. Apply the score.
  3. Recompute group rankings for finished groups and run `propagate` over every match of every stage.
  4. Enforce the edit policy.
  5. Persist only the changed rows, bumping `version`.
  6. Set COMPLETED when every match is finished, or back to IN_PROGRESS if an edit re-opened matches.
- `editResult` is the same path but requires an existing result. One implementation means record and edit cannot drift apart.
- Edit policy: under BLOCK_EDIT, an edit that changes participants of already-played matches gets EDIT_BLOCKED. Under RESET_DOWNSTREAM (the default), it gets CONFIRMATION_REQUIRED with `details.invalidated` (id, round, teams) unless `confirmReset: true`, in which case those results are cleared. Score-only edits that keep the same winner never invalidate anything.
- Assumption (DESIGN.md "draws in knockout"): draws are rejected in knockout stages (single, double, and the knockout of groups + knockout) rather than adding an extra-time/penalties field. Draws are allowed in ROUND_ROBIN and GROUP stages.
- Added `standingsConfigOf(config)` to `src/lib/tournament-config.ts`, and a shared integration-test fixture helper (`src/server/__tests__/fixtures.ts`).
- Tests: 10 new, 145 total. Covered: draws, winner advancement, completion, invalid targets, groups feeding the knockout, re-resolution, confirmation then reset, BLOCK_EDIT, score-only edits, and COMPLETED→IN_PROGRESS on reset.
- Next task: 2.6 getPublicView.

## 2026-10-21 09:20: Task 2.4: startTournament

- `src/lib/plan-stages.ts`: `planStages(config, teams, idPrefix)` picks the generator for the format and propagates byes. It is pure and lives in `lib/` so the admin UI can preview fixtures client-side with the same code (no preview endpoint needed).
- `startTournament(db, id)` runs in one transaction: checks the REGISTRATION→IN_PROGRESS transition and at least 2 teams, plans the stages, inserts stages (stage `config` stores `groupLabel`) and matches, writes team group labels, and sets IN_PROGRESS.
- Engine errors from an impossible configuration (e.g. 3 groups with 5 teams) become VALIDATION (400), and the transaction rolls back.
- Ids: every stage and match id is prefixed with `{tournamentId}-`.
- Tests: 6 new, 135 total. Covered: all four formats, bye propagation, group labels, illegal starts and rollback.
- Next task: 2.5 recordResult and editResult.

## 2026-10-21 09:00: Task 2.3: Team management with lifecycle validation

- `src/server/lifecycle.ts` holds the tournament state machine:
  - DRAFT→REGISTRATION→IN_PROGRESS→COMPLETED, and any non-archived state can go to ARCHIVED.
  - COMPLETED→IN_PROGRESS is allowed so an organizer can edit a result after the end.
  - `assertTransition` and `assertStatus` throw INVALID_STATE.
- `src/server/services/teams.ts`:
  - `addTeams` (batch, trimmed, next free seeds, max 128, case- and whitespace-insensitive duplicates rejected within the batch and against existing teams with DUPLICATE and the offending names).
  - `removeTeam` (closes the seed gap).
  - `reorderTeams` (must be a full permutation).
  - `listTeams`.
  - Every write runs in a transaction, and changes are refused once the tournament has started. The message suggests a forfeit instead.
- Assumption: forfeits are not a roadmap task. They are mentioned in DESIGN.md's edge cases, and recording a walkover result covers them for now (logged in BLOCKERS.md as a product decision).
- Tests: 8 new, 129 total. They include the full transition table and illegal moves.
- Next task: 2.4 startTournament.

## 2026-10-21 08:45: Task 2.2: createTournament

- `createTournament(db, { name, sport, config })`:
  - Validates with zod and starts the tournament in REGISTRATION.
  - Slug is `slugify(name)` plus a 6-character random suffix, retried up to 5 times on unique-constraint collisions.
  - Admin token is 32 random bytes in base64url. It is returned once; only its SHA-256 hex hash is stored.
- `authorizeAdmin(db, slug, token)`: constant-time comparison (`timingSafeEqual` on the digests). A missing or wrong token gives the same UNAUTHORIZED error; an unknown slug gives NOT_FOUND.
- `src/lib/slug.ts` (`slugify`, which strips accents) and `src/server/security.ts` (token generation, hashing, comparison, random suffix).
- Decision: the random slug suffix means public URLs cannot be guessed from the name alone. They are still public by design.
- Tests: 6 new, 121 total (integration tests against a temporary SQLite DB).
- Lesson for future sessions: the Bash tool rewrites backslash escapes inside heredocs (`\u0300`, `\`). Source files are written with the Write and Edit tools instead.
- Next task: 2.3 team management.

## 2026-10-21 08:25: Task 2.1: DB client, repositories, test DB helper

- `src/server/db.ts`: a shared `getDb()` Prisma client (cached on `globalThis` for dev hot reload) and `Db`/`Tx` types.
- `src/server/errors.ts`: `ServiceError(code, message, details)` with stable codes mapped to HTTP status (400, 401, 404, 409, 429, 500).
- `src/server/repositories/tournament-repository.ts`:
  - Mappers between Prisma rows and engine objects. Source JSON is validated with zod when read back.
  - `loadAggregate` (tournament + teams by seed + stages by order, with matches sorted by bracket, round and position) and `findTournamentBySlug`.
  - `StoredMatch` extends the engine `Match` with `version`, `scheduledAt` and `venueId`. Engine functions spread matches, so these fields pass through untouched.
- `src/lib/tournament-config.ts`: zod schema for the tournament `config` JSON (format, legs, points, tiebreakers, third place, grand-final reset, groups, edit policy) with defaults. It lives in `lib/` so the client wizard can share it.
- Test DB helper (`src/server/__tests__/test-db.ts`): each test file gets a fresh SQLite file in `.tmp/test-db/` with every migration's SQL applied directly. No `prisma` subprocess is needed, so it is fast and parallel-safe.
- Tests: 7 new, 115 total. Covered: a full round-trip of generated matches through the DB, defaults, not-found errors, the DB-level duplicate-name constraint, and config validation.
- Dependencies: zod (TECHSTACK).
- Next task: 2.2 createTournament.

## 2026-10-21 08:00: Gate 1: passed

- 108 tests pass (all property tests included). Engine coverage: 100% statements, lines and functions; 96.96% branches. The 90% threshold is enforced by `npm run test:cov`. Lint and typecheck are clean.
- Next task: 2.1 DB client, repositories, test DB helper.

## 2026-10-21 08:00: Task 1.10: Double elimination

- `generateDoubleElimination(teams, { idPrefix, stageId, grandFinalReset })`:
  - The winners bracket (`w{r}m{p}`) reuses `buildBracketRounds`.
  - The losers bracket (`l{r}m{p}`) has 2(log2 N - 1) rounds. Round 1 pairs the winners round-one losers, then drop-down and consolidation rounds alternate.
  - Grand final: `gf1` is the winners champion (home) against the losers champion (away). `gf2` is the reset, played only if the away side wins `gf1` (handled in `propagate`). The reset can be turned off.
  - With 2 teams, the loser of the only match goes straight to `gf1`.
- Routing: `losersDropPosition` cycles reverse, swap halves, identity, reverse halves per winners round. A throwaway simulation over 1,200 random brackets (8-64 teams) compared four patterns. Losers-bracket rematch rates: always-reverse 6.9%, reverse/identity 3.7%, reverse/swap 3.8%, the 4-cycle 3.0%. The cycle was chosen. Some rematches are unavoidable in double elimination. The first drop-down round never has one when there are at least 8 slots.
- Byes need no special code. The loser of a bye is a bye (1.7), so odd team counts flow through the losers bracket.
- Test fixes (both were test bugs, not implementation bugs):
  1. The reset scenario kept playing after GF1, so GF2 had been played rather than left SCHEDULED. Assertions now check that GF2 was played and the losers champion won.
  2. The "no rematch in the first drop-down" property started at 4 teams. A 4-slot bracket has a single drop-down match where that rematch can't be avoided, so the property now starts at 5 teams. The reason is documented in the test.
- Tests: 13 new, 108 total. Property tests check that every team except the champion is eliminated after exactly 2 losses (with random results, 2-40 teams), the bracket shape (N-1 / N-2 / 2), propagation idempotence throughout, and that seed 1 wins with seed 2 as runner-up when favourites always win.

## 2026-10-21 07:30: Task 1.9: Scheduler

- `scheduleMatches(matches, { venues, slots, minRestSlots, groupStageIds })` returns `{ assignments, unscheduled }`. Slots are indices 0..slots-1; the service maps them to real times.
- Hard constraints: one match per venue per slot; a team plays at most once per slot with `minRestSlots` free slots between games; a match comes after its feeders plus the rest gap. For `groupRank` sources, every match of that group counts as a feeder (mapped via `groupStageIds`).
- Greedy, most-constrained-first. Among matches whose feeders are placed, the one with the fewest feasible (slot, venue) options goes first into its earliest option. Ties go to the match with the busiest team (most remaining matches), then lower round, then input order.
  - Decision: the team-load tiebreak was added because option counts alone tie at the start. A test case where a team must play once in each of 3 slots fails without it.
- FINISHED and LIVE matches are skipped and treated as played. Matches that do not fit, and everything depending on them, go into `unscheduled`.
- Tests: 10 new, 95 total. Property tests check that no hard constraint is ever broken for random round robins and brackets with random venues, slots and rest gaps; that every open match is either assigned or reported; that output is deterministic; and that everything is scheduled when capacity is ample.
- Next task: 1.10 double elimination.

## 2026-10-21 07:05: Task 1.8: Group + knockout

- `src/engine/group-knockout.ts`:
  - `groupLabel`: A..Z, then AA and onwards.
  - `assignGroups`: snake draft by seed.
  - `generateGroupKnockout(teams, { groups, advancePerGroup, legs, thirdPlaceMatch, idPrefix })` returns `{ stages, groupOf }`: one GROUP stage per group (round robin, ids `g{A}-r{r}m{p}`) plus a SINGLE_ELIM stage whose round-one sources are `groupRank`.
  - `resolveGroupRankings`: rankings only for fully finished groups, fed into `propagate({ groupRankings })`.
- Added `roundRobinMatches` in `round-robin.ts`, which turns fixtures into SCHEDULED matches. It is shared with plain round-robin tournaments.
- Knockout seeding:
  - Group winners take seeds 1..g in group order. Each lower rank tier uses the first rotation of the group order that avoids same-group pairs in round one.
  - With 2 groups this gives A1 vs B2 and B1 vs A2, as documented. It also works when g×k is not a power of two, in which case byes go to group winners.
- Validation: at least 1 group, at least 2 teams per group, advancePerGroup between 1 and the smallest group size, and at least 2 qualifiers.
- Tests: 11 new, 85 total. Property tests check that group sizes differ by at most 1 and top seeds are spread across groups, and that there is no same-group round-one pairing for 2-8 groups with 1-2 qualifiers each. An end-to-end test plays the groups and checks the knockout fills correctly.
- Next task: 1.9 scheduler.

## 2026-10-21 06:45: Task 1.7: Propagation

- `propagate(matches, { groupRankings })` returns `{ matches, invalidated }`. It walks the match DAG in topological order (Kahn's algorithm, stable, throws on unknown references or cycles) and resolves each source to a team, a bye or unknown.
- Rules:
  - Bye versus a team: auto-FINISHED, and the team advances.
  - Bye versus a bye: FINISHED with no teams, meaning the match is not needed.
  - The loser of a bye is a bye. This is what makes double-elimination losers brackets work with odd counts.
  - A grand-final reset (`GRAND_FINAL`, round 2) is not needed when GF1 is won by its home side, the winners-bracket champion.
  - If participants change: an unplayed match is re-resolved. A match with a result, or one that is LIVE, is reset and listed in `invalidated`, and the reset cascades. The service applies RESET_DOWNSTREAM or BLOCK_EDIT.
  - Matches without sources (round robin) are untouched.
  - A knockout match finished as a draw with no winner advances nobody. The service layer rejects such results.
- Decision: generators return the raw bracket and the service always runs `propagate` after generating and after every result, so there is only one place that resolves participants.
- Tests: 19 new, 74 total.
  - Property tests: idempotence at every step of randomly played brackets of 2-40 teams; seed 1 beats seed 2 in the final when favourites win, and every match finishes; input order is preserved.
  - Unit tests cover edits, cascading invalidation, LIVE matches, byes and double byes, group ranks, the grand-final reset, cycles and unknown references.
- Coverage: engine at 100% lines, 96.6% branches.
- Next task: 1.8 group + knockout.

## 2026-10-21 06:20: Task 1.6: Single elimination

- `generateSingleElimination(teams, { idPrefix, stageId, thirdPlaceMatch })` sorts teams by seed. `buildSingleElimination(entrantSources, ...)` takes any sources (used later for group qualifiers). `buildBracketRounds` is the shared tree builder that double elimination will reuse.
- Match ids are `${prefix}r{round}m{position}`, and the third-place match is `${prefix}3rd` (same round as the final, position 2).
  - Round one: team sources are resolved immediately, and a known team facing a bye gets a FINISHED match with itself as winner.
  - Later rounds: PENDING with `winner` sources. `propagate` (1.7) fills them.
- Assumption: `thirdPlaceMatch` is silently ignored when there are no semi-finals (2 teams), so a default-on UI option never causes an error.
- Test fix: the "seeds 1 and 2 in opposite halves" property initially included n=2. With 2 teams the only match is the final, so "halves" do not exist. The property now starts at 3 teams; the 2-team case is covered by its own test.
- Tests: 10 new, 55 total. Property tests check that the bracket is a valid tree for 2-70 teams: the match count, every feeder used once from the previous round, unique ids and all teams placed.
- Next task: 1.7 propagation.

## 2026-10-21 06:05: Task 1.5: Seeding

- `src/engine/seeding.ts`:
  - `bracketSize(n)`: next power of two, minimum 2 teams.
  - `seedBracket(size)`: standard order, built by doubling, e.g. 8 gives `[1,8,4,5,2,7,3,6]`.
  - `firstRoundPairs(n)`: seed pairs with null byes, which always go to the highest seeds. The better seed is always the home slot, so a bye is always in the away slot.
- Tests: 9 new, 45 total. Property tests check the order is a permutation, first-round pairs sum to size + 1, and the top 2^k seeds sit in distinct blocks of size/2^k, which implies seeds 1 and 2 can only meet in the final. Also checked: byes are exactly seeds 1..(size-n) and never two byes in one match.
- Next task: 1.6 single elimination.

## 2026-10-21 05:55: Task 1.4: Tiebreaker chain with recursive head-to-head

- `rankTeams` in `src/engine/tiebreakers.ts` walks the configurable chain (`points`, `headToHead`, `goalDifference`, `goalsFor`, `wins`, `seed`, `alphabetical`). Each criterion splits a tied group into tiers.
  - When `headToHead` splits a group, it is re-applied to each smaller tier using only that tier's matches (the recursive mini-table).
  - Any tie left after the chain is broken by team id, so the order is always total.
- `computeStandings` now uses `rankTeams`.
- Assumption: `headToHead` compares the mini-table on points, then mini goal difference, then mini goals scored (UEFA-style), rather than points alone. With points alone, many realistic ties are never separated by head-to-head.
- Tests: 9 new, 36 total.
  - Two-way head-to-head beating goal difference.
  - A 3-way cycle with identical scores falling through to overall goal difference.
  - A 3-way tie separated by mini goal difference when overall goal difference disagrees.
  - A 4-way tie that needs the recursive re-application. This case was found by a randomised search and pinned as a regression test.
  - Seed and alphabetical fallbacks.
  - Property tests: ranks form a permutation, the order is independent of input order, and points never increase down the table.
- Coverage: engine at 100% lines, 94% branches.
- Next task: 1.5 seeding.

## 2026-10-21 05:35: Task 1.3: Standings

- `tallyStandings(teams, matches, config)` tallies played, W/D/L, goals for/against, difference and points (points per result are configurable). Only FINISHED matches with both scores count, so byes and live matches are ignored, as are matches against teams outside the table.
- `computeStandings` returns ranked `StandingRow[]`. For now it orders by points, then seed. Task 1.4 replaces this with the full tiebreaker chain.
- Tests: 6 new, 27 total, including a property test that totals stay consistent (W = L overall, GF = GA, GD sums to 0, points = 3W + D).
- Next task: 1.4 tiebreaker chain.

## 2026-10-21 05:20: Task 1.2: Round-robin generator

- `generateRoundRobin(teamIds, { legs, seed })` returns `{ fixtures, byes, rounds }`.
  - Circle method: the last slot is fixed and the rest rotate.
  - Odd counts get a null bye slot. Pairings against it become `Bye` records.
  - The second leg mirrors the first with home and away swapped.
- Home/away orientation: the fixed slot alternates each round, and pair i is flipped when i is odd. This gives the minimum n-2 breaks: every team has at most 2 consecutive home or away games, and home/away counts differ by at most 1 per leg.
- `src/engine/random.ts`: a mulberry32 PRNG plus a seeded Fisher-Yates `shuffle`, so the engine never uses `Math.random`.
- Assumption: the architecture signature says `-> Fixture[]`. It returns `{ fixtures, byes, rounds }` instead, because the docs also require byes to be recorded.
- Tests: 14 new, 21 total. Property tests cover every pair meeting `legs` times, no double booking (including byes), round counts, home/away balance and leg mirroring.
- Next task: 1.3 standings.

## 2026-10-21 05:00: Task 1.1: Engine types

- `src/engine/types.ts` defines Team, Match, Source (team, winner, loser, groupRank, bye), Fixture, Bye, Stage, StandingRow, StandingsConfig and Tiebreaker, plus `DEFAULT_TIEBREAKERS` and `DEFAULT_STANDINGS_CONFIG` (3/1/0 points).
- `src/engine/match.ts` adds small helpers: `createMatch`, `hasResult`, `isBye` and `loserOf`.
- Decision (bye representation): byes need no extra column. A FINISHED match with exactly one team and no scores is a bye. A FINISHED match with no teams means "not needed" (a double bye in a losers bracket, or an unplayed grand-final reset). This keeps the DB schema and the engine model identical.
- Tests: 7 passing. Removed the toolchain smoke test now that real engine tests exist.
- Next task: 1.2 round-robin generator.

## 2026-10-21 04:45: Task 0.5: PROGRESS, BLOCKERS, initial README

- PROGRESS.md and BLOCKERS.md already existed with their templates, so they were kept. Added README.md with an overview, setup steps, the script table and the project layout.

## 2026-10-21 04:45: Gate 0: passed

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:cov` all pass locally, as does `prisma migrate deploy` on a fresh database (the CI-equivalent sequence).
- Next task: 1.1 engine types.

## 2026-10-21 04:40: Task 0.4: GitHub Actions CI

- `.github/workflows/ci.yml` runs on every push and pull request: `npm ci` (its postinstall runs `prisma generate`), `prisma migrate deploy`, lint, typecheck and `test:cov`, which enforces the engine coverage threshold. Node 22 LTS on ubuntu-latest.
- E2E (Playwright) joins CI in Phase 4, once there are flows to test.
- Verified locally: the same commands pass. The workflow itself cannot run until the repo is pushed to GitHub.
- Next task: 0.5 README, PROGRESS and BLOCKERS.

## 2026-10-21 04:35: Task 0.3: Prisma with SQLite, schema, initial migration

- `prisma/schema.prisma` models Tournament, Team, Stage, Match and Venue as described in ARCHITECTURE.md. Initial migration is `prisma/migrations/*_init`.
- Decisions:
  - Enum-like fields (status, stage type, bracket) are `String` columns validated in TypeScript, because Prisma enums are not portable to SQLite and the schema must later be mirrored for PostgreSQL.
  - `config`, `homeSource` and `awaySource` use Prisma `Json` (supported on SQLite since Prisma 6.2).
  - `Team.nameKey` (lower-cased name) has a unique index per tournament, so case-insensitive duplicates are rejected at the database level as well.
  - `Match.version` was added now, not in 2.7, to avoid a second migration. Task 2.7 adds the behaviour.
  - Stage and Match ids are supplied by the engine (prefixed per tournament) so source references (`winner of match X`) can be stored verbatim.
  - Default tournament status is REGISTRATION. A tournament is created with its format already chosen in the wizard, so DRAFT is kept in the state machine but is not the default. Assumption, recorded here.
- Scripts: `db:migrate`, `db:seed` (tsx `prisma/seed.ts`, a stub until 6.1), `db:generate`, and `postinstall: prisma generate`.
- Dependencies: prisma and @prisma/client (TECHSTACK); tsx (runs the TypeScript seed script).
- Next task: 0.4 GitHub Actions CI.

## 2026-10-21 04:20: Task 0.2: Vitest, coverage, fast-check

- Added `vitest.config.ts` (node environment, `@/` alias via vite-tsconfig-paths). V8 coverage covers engine, server and lib code, and enforces a 90% threshold on `src/engine/**`, so Gate 1 is checked automatically by `npm run test:cov`.
- Scripts: `test`, `test:watch`, `test:cov`. The `db:*` scripts come with Prisma in 0.3.
- Added `.gitattributes` (`eol=lf`) to stop CRLF churn on Windows.
- Tests: toolchain smoke test (fast-check property plus the path alias). 2 passing.
- Dependencies: vitest, @vitest/coverage-v8, fast-check (TECHSTACK); vite-tsconfig-paths (one line, so tests resolve the same `@/` alias as Next).
- Next task: 0.3 Prisma schema and initial migration.

## 2026-10-21 04:10: Task 0.1: Scaffold Next.js, ESLint, Prettier

- Hand-scaffolded Next.js 15.5 (App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`) and Tailwind CSS v4 via `@tailwindcss/postcss`. `create-next-app` refuses non-empty directories, so the files were written directly.
- ESLint 9 flat config extends `next/core-web-vitals` and `next/typescript`, plus `eslint-config-prettier`. Added an engine-purity rule: `src/engine/**` cannot import Next, React, Prisma, server code or Node I/O, and cannot call `Date.now` or `Math.random`.
- Decision: Next 15 rather than 16, because it is stable and still ships `eslint-config-next` for flat config.
- Tests: none yet (Vitest arrives in 0.2). `npm run lint`, `npm run typecheck` and `next build` pass.
- Dependencies: next, react, react-dom, tailwindcss, @tailwindcss/postcss, eslint, eslint-config-next, @eslint/eslintrc (FlatCompat loader for the Next config), prettier, eslint-config-prettier (stops ESLint and Prettier fighting over formatting). All are in TECHSTACK or are standard Next tooling.
- Next task: 0.2 Vitest + coverage + fast-check.
