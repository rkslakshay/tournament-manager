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
