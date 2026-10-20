# Tournament Manager: Project Context for Claude Code

This file is read automatically at the start of every session. Keep it accurate.

## What this is
A full-stack tournament management app. Organizers create tournaments, add teams, pick a format, and the app generates fixtures. Entering results updates standings and brackets automatically. Every tournament has a public, read-only, live-updating page.

## Read these first
- `docs/ARCHITECTURE.md`: system structure, data model, algorithms
- `docs/DESIGN.md`: UX, pages, API contract, edge cases
- `docs/TECHSTACK.md`: chosen tools and conventions
- `docs/ROADMAP.md`: ordered task checklist (source of truth for what to do next)
- `PROGRESS.md`: running log of what has been done
- `BLOCKERS.md`: problems that need a human

## Non-negotiable principles
1. **The engine is pure.** Everything in `src/engine/` is pure TypeScript functions: no database, no network, no `Date.now()`, no randomness without an injected seed. This makes it fully unit-testable.
2. **Derive, don't store.** Standings are always computed from match results. Never persist standings.
3. **Database is the source of truth** for tournaments, teams, and matches. UI state is a view of it.
4. **Test first for engine code.** Write failing tests, then implement. Aim for 90%+ coverage on `src/engine/`.
5. **Validate at the boundary.** All API input is validated with zod. State transitions are validated server-side.
6. **Small, reviewable commits.** One roadmap task per commit, with a clear message.

## Commands
```
npm run dev          # start dev server
npm test             # run vitest
npm run test:cov     # coverage report
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run db:migrate   # prisma migrate dev
npm run db:seed      # seed demo data
```
A task is only "done" when `npm test`, `npm run lint`, and `npm run typecheck` all pass.

## Code conventions
- TypeScript strict mode. No `any` without a comment explaining why.
- Engine functions: small, named, documented with a short JSDoc including an example.
- File names: kebab-case. Types/interfaces: PascalCase. Functions: camelCase.
- No dead code, no commented-out code, no TODOs without a matching roadmap or BLOCKERS entry.
