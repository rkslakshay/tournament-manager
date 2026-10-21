# Tournament Manager

A full-stack app for running tournaments. Organizers create a tournament, add teams and pick a
format, and the app generates the fixtures. Entering a result updates standings and brackets
automatically. Every tournament also gets a public, read-only page that updates live.

> Status: early development. See [docs/ROADMAP.md](docs/ROADMAP.md) for what is done and
> [PROGRESS.md](PROGRESS.md) for the build log.

## Tech stack
Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Prisma (SQLite in dev) · zod ·
Vitest + fast-check · Playwright. See [docs/TECHSTACK.md](docs/TECHSTACK.md).

## Getting started
Requires Node.js 20 or later.

```bash
npm install            # also runs `prisma generate`
cp .env.example .env   # DATABASE_URL for the local SQLite file
npm run db:migrate     # create the local database
npm run dev            # http://localhost:3000
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run the unit and integration tests (Vitest) |
| `npm run test:cov` | Tests with a coverage report (engine must stay at 90% or above) |
| `npm run test:e2e` | Playwright walkthroughs (desktop and mobile) on an isolated production build; run `npx playwright install chromium` once first |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply Prisma migrations in development |
| `npm run db:seed` | Seed demo data |

## API
JSON over REST. Write endpoints need `Authorization: Bearer <adminToken>` (returned once when the
tournament is created). Errors look like `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/tournaments` | none (rate-limited) | Create; returns `{ slug, adminToken }` |
| GET | `/api/t/:slug` | none | Public view: teams, matches, derived standings |
| POST | `/api/t/:slug/teams` | admin | Add teams `{ names: [] }` |
| DELETE | `/api/t/:slug/teams/:teamId` | admin | Remove a team (before start) |
| PUT | `/api/t/:slug/teams/order` | admin | Reseed `{ teamIds: [] }` |
| POST | `/api/t/:slug/start` | admin | Generate fixtures and lock teams |
| PUT | `/api/t/:slug/matches/:matchId/result` | admin | Record/edit `{ homeScore, awayScore, expectedVersion?, confirmReset? }` |
| POST | `/api/t/:slug/schedule` | admin | Auto-schedule `{ venues, startTime, slotMinutes, minRestSlots }` |

## Project layout
- `src/engine/`: pure tournament logic (fixtures, standings, brackets, scheduling). No I/O.
- `src/server/`: database access, services, real-time hub.
- `src/app/`: Next.js pages and API routes.
- `docs/`: architecture, design, tech stack and roadmap.
