# Progress Log

Append newest entries at the top. Format:

```
## YYYY-MM-DD HH:MM: Task X.Y: short title
- What changed
- Decisions made and why
- Tests added / results
- Dependencies added (with justification)
- Next task
```

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
