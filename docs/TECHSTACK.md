# Tech Stack

## Summary
| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | One language across engine, API, UI; strong types model brackets well |
| Framework | Next.js 14+ (App Router) | Frontend and API routes in one deployable; easy public pages with SSR |
| UI | Tailwind CSS + shadcn/ui | Fast, consistent, accessible components |
| ORM | Prisma | Typed queries, painless migrations |
| Database | SQLite (dev) / PostgreSQL (prod) | Zero-setup locally, robust in production (Neon or Supabase free tier) |
| Validation | zod | Runtime validation shared between client and server |
| Testing | Vitest (unit), Playwright (a few e2e flows) | Fast unit tests for the engine; e2e for critical paths |
| Real-time | Server-Sent Events (SSE) | One-way updates are all we need; simpler than WebSockets |
| Deploy | Vercel (app) + Neon (Postgres) | Free tier, click-to-demo link for the resume |
| CI | GitHub Actions | Runs lint, typecheck, tests on every push |

## Key decisions and tradeoffs

**No user accounts in v1.** Organizers get a secret *admin link* (`/t/{slug}/admin?token=...`) when they create a tournament. The token is stored hashed. This removes auth complexity while still protecting edits. Tradeoff: no "my tournaments" dashboard. Accounts can be a later stretch.

**SSE over WebSockets.** Viewers only receive updates; they never send. SSE works over plain HTTP, reconnects automatically, and is trivial to deploy. Tradeoff: on serverless platforms long-lived connections have limits, so the client falls back to polling every 10s if SSE fails.

**Engine separated from framework.** `src/engine/` has zero imports from Next.js or Prisma. It could be published as its own package. This is the main thing to highlight in interviews.

**JSON columns for config.** Format-specific settings (tiebreaker order, points for win/draw/loss, legs per tie) live in a validated JSON `config` field to avoid a table per format.

## Dependencies policy
Prefer few, well-known dependencies. Any new dependency needs a one-line justification in `PROGRESS.md`.

## Folder structure
```
tournament-manager/
├── CLAUDE.md
├── PROGRESS.md
├── BLOCKERS.md
├── docs/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── engine/                 # PURE logic, no I/O
│   │   ├── types.ts
│   │   ├── round-robin.ts
│   │   ├── seeding.ts
│   │   ├── single-elimination.ts
│   │   ├── double-elimination.ts
│   │   ├── group-knockout.ts
│   │   ├── standings.ts
│   │   ├── tiebreakers.ts
│   │   ├── propagation.ts
│   │   ├── scheduler.ts
│   │   └── __tests__/
│   ├── server/                 # DB access, services, SSE hub
│   │   ├── db.ts
│   │   ├── services/
│   │   └── events.ts
│   ├── app/                    # Next.js routes and pages
│   │   ├── api/
│   │   ├── t/[slug]/           # public page
│   │   └── t/[slug]/admin/     # organizer view
│   ├── components/
│   └── lib/
├── e2e/
└── .github/workflows/ci.yml
```
