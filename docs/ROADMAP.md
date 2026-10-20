# Roadmap

Work top to bottom. Mark `[x]` only when the task's tests pass and it is committed.
Each phase ends with a **gate**: all checks green, `PROGRESS.md` updated, README accurate.

## Phase 0: Setup

- [x] 0.1 Scaffold Next.js (TypeScript strict, App Router, Tailwind), ESLint, Prettier
- [x] 0.2 Add Vitest, coverage config, fast-check; add npm scripts from CLAUDE.md
- [x] 0.3 Prisma with SQLite; schema from ARCHITECTURE.md; initial migration
- [x] 0.4 GitHub Actions CI: lint, typecheck, test
- [x] 0.5 Create `PROGRESS.md` and `BLOCKERS.md`; write initial README
- **Gate 0**: CI-equivalent commands pass locally.

## Phase 1: Engine (pure, test-first)

- [x] 1.1 `types.ts`: Team, Match, Source, Fixture, StandingRow, configs
- [x] 1.2 Round-robin generator (circle method, byes, legs, home/away balance) + property tests
- [x] 1.3 Standings with points, diff, for/against + tests
- [x] 1.4 Tiebreaker chain incl. head-to-head mini-table (recursive) + tests with tricky 3-way ties
- [x] 1.5 Seeding function + tests
- [x] 1.6 Single-elimination generator with byes and optional third-place match + tests
- [x] 1.7 Propagation (resolve sources, report invalidated matches) + idempotence tests
- [ ] 1.8 Group + knockout generator, group rank resolution + tests
- [ ] 1.9 Scheduler (greedy, most-constrained-first, rest gaps, venue limits) + tests
- [ ] 1.10 Double-elimination generator (losers routing, grand final, reset) + tests
- **Gate 1**: engine coverage >= 90%, all property tests pass.

## Phase 2: Persistence and services

- [ ] 2.1 DB client, repositories, test DB helper
- [ ] 2.2 `createTournament` (slug generation, admin token hashing) + integration tests
- [ ] 2.3 Team management with lifecycle validation
- [ ] 2.4 `startTournament` (generate + persist in one transaction)
- [ ] 2.5 `recordResult` and `editResult` with propagation and invalidation policy
- [ ] 2.6 `getPublicView` (derived standings, no secrets)
- [ ] 2.7 Optimistic concurrency via match `version`
- **Gate 2**: service integration tests pass, state-transition tests cover illegal moves.

## Phase 3: API

- [ ] 3.1 zod schemas and error format
- [ ] 3.2 Routes from DESIGN.md; admin auth middleware
- [ ] 3.3 Rate limiting on writes
- [ ] 3.4 API tests (success and failure paths, auth)
- **Gate 3**: every route tested; no route lacks validation.

## Phase 4: UI

- [ ] 4.1 Landing page and create wizard
- [ ] 4.2 Admin: team management and seed reordering
- [ ] 4.3 Admin: fixtures preview, start, result entry, edit with invalidation confirmation
- [ ] 4.4 Public page: standings and fixtures tabs
- [ ] 4.5 Bracket visualization component
- [ ] 4.6 Mobile polish, dark mode, accessibility pass, OG metadata
- **Gate 4**: manual walkthrough scripted in Playwright passes.

## Phase 5: Real-time

- [ ] 5.1 SSE hub and `/events` endpoint
- [ ] 5.2 Public page subscribes, refetches on event, polling fallback
- [ ] 5.3 Live match status and "Live" indicators
- **Gate 5**: e2e test shows a result entered in admin appears on public page without reload.

## Phase 6: Polish and ship

- [ ] 6.1 Seed script with three demo tournaments
- [ ] 6.2 Switch Prisma to PostgreSQL for production; document env vars
- [ ] 6.3 Deployment config (Vercel + Neon) and deployment notes
- [ ] 6.4 README: screenshots placeholders, architecture diagram (mermaid), feature list, how to run, design decisions, what I'd improve
- [ ] 6.5 Add `docs/INTERVIEW_NOTES.md`: answers to the likely questions (byes, edited results, derived standings, scaling viewers) in plain language
- **Gate 6**: fresh clone can run with documented steps only.

## Stretch (only after Phase 6)

- [ ] S.1 Swiss system pairing
- [ ] S.2 Redis pub/sub for multi-instance SSE
- [ ] S.3 CSV export of standings and fixtures
- [ ] S.4 User accounts and "my tournaments"
