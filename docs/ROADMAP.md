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
- [x] 1.8 Group + knockout generator, group rank resolution + tests
- [x] 1.9 Scheduler (greedy, most-constrained-first, rest gaps, venue limits) + tests
- [x] 1.10 Double-elimination generator (losers routing, grand final, reset) + tests
- **Gate 1**: engine coverage >= 90%, all property tests pass.

## Phase 2: Persistence and services

- [x] 2.1 DB client, repositories, test DB helper
- [x] 2.2 `createTournament` (slug generation, admin token hashing) + integration tests
- [x] 2.3 Team management with lifecycle validation
- [x] 2.4 `startTournament` (generate + persist in one transaction)
- [x] 2.5 `recordResult` and `editResult` with propagation and invalidation policy
- [x] 2.6 `getPublicView` (derived standings, no secrets)
- [x] 2.7 Optimistic concurrency via match `version`
- **Gate 2**: service integration tests pass, state-transition tests cover illegal moves.

## Phase 3: API

- [x] 3.1 zod schemas and error format
- [x] 3.2 Routes from DESIGN.md; admin auth middleware
- [x] 3.3 Rate limiting on writes
- [x] 3.4 API tests (success and failure paths, auth)
- **Gate 3**: every route tested; no route lacks validation.

## Phase 4: UI

- [x] 4.1 Landing page and create wizard
- [x] 4.2 Admin: team management and seed reordering
- [x] 4.3 Admin: fixtures preview, start, result entry, edit with invalidation confirmation
- [x] 4.4 Public page: standings and fixtures tabs
- [x] 4.5 Bracket visualization component
- [x] 4.6 Mobile polish, dark mode, accessibility pass, OG metadata
- **Gate 4**: manual walkthrough scripted in Playwright passes.

## Phase 5: Real-time

- [x] 5.1 SSE hub and `/events` endpoint
- [x] 5.2 Public page subscribes, refetches on event, polling fallback
- [x] 5.3 Live match status and "Live" indicators
- **Gate 5**: e2e test shows a result entered in admin appears on public page without reload.

## Phase 6: Polish and ship

- [x] 6.1 Seed script with three demo tournaments
- [x] 6.2 Switch Prisma to PostgreSQL for production; document env vars
- [x] 6.3 Deployment config (Vercel + Neon) and deployment notes
- [x] 6.4 README: screenshots placeholders, architecture diagram (mermaid), feature list, how to run, design decisions, what I'd improve
- [x] 6.5 Add `docs/INTERVIEW_NOTES.md`: answers to the likely questions (byes, edited results, derived standings, scaling viewers) in plain language
- **Gate 6**: fresh clone can run with documented steps only.

## Stretch (only after Phase 6)

- [x] S.1 Swiss system pairing (done as task 7.7)
- [ ] S.2 Redis pub/sub for multi-instance SSE
- [ ] S.3 CSV export of standings and fixtures
- [ ] S.4 User accounts and "my tournaments"

## Phase 7: Verification, gaps, stretch, presentation, publishing

### 7A. Independent verification

- [x] 7.1 Clean-state run: install, lint, typecheck, unit tests, coverage, full Playwright suite; record real numbers
- [x] 7.2 Secrets and junk audit (gitignore, no tokens or personal data, no large or generated files)
- [x] 7.3 Skeptical engine review: edge cases (2/3/5/17/128 teams, duplicate seeds, all draws, 3- and 4-way cycles, deep double-elimination edits)

### 7B. Close known gaps

- [x] 7.4 Verify PostgreSQL for real (Docker, else embedded-postgres) and run integration tests against it
- [x] 7.5 Forfeit / walkover action (service, route, UI, schema, tests, DESIGN.md)
- [x] 7.6 Knockout draws via extra-time/penalties winner (decidedBy: REGULAR | EXTRA_TIME | PENALTIES)

### 7C. Stretch features

- [x] 7.7 Swiss system (pairing, no rematches, byes, Buchholz) with service, UI and demo
- [ ] 7.8 Pub/sub adapter: in-memory and Redis (REDIS_URL), contract tests
- [ ] 7.9 CSV export of standings and fixtures

### 7D. Presentation assets

- [ ] 7.10 Playwright screenshots into docs/screenshots and README
- [ ] 7.11 Demo GIF or frame sequence (if practical)
- [ ] 7.12 README polish, accurate against the final code

### 7E. Deployment and publishing

- [ ] 7.13 Check available tooling (git remote, gh, vercel, docker)
- [ ] 7.14 Publish to GitHub (if gh is authenticated), after re-running the secrets audit
- [ ] 7.15 Deploy to Vercel (if authenticated and a Postgres URL is available)
- [ ] 7.16 NEEDS_YOU.md with remaining manual steps

### 7F. Interview and resume preparation

- [ ] 7.17 docs/CODE_TOUR.md
- [ ] 7.18 docs/INTERVIEW_NOTES.md expanded to 25+ questions with honest limitations
- [ ] 7.19 docs/RESUME.md
- [ ] 7.20 docs/STUDY_GUIDE.md
