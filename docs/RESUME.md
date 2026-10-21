# Resume and pitch material

Every number here was measured on the final code. Re-check with `npm run test:cov` and
`npm run test:e2e` before quoting them if the code changes.

- Repository: https://github.com/rkslakshay/tournament-manager
- Not deployed yet (see `NEEDS_YOU.md`), so don't claim users or traffic.

## Resume bullets (pick one style)

**Concise**

- Built a full-stack tournament manager (Next.js, TypeScript, Prisma, PostgreSQL) that generates
  fixtures for 5 formats, derives live standings and brackets, and pushes updates to viewers over
  Server-Sent Events. 305 automated tests.

**Technical**

- Designed a pure TypeScript engine modelling brackets as a DAG of match "sources". One idempotent
  propagation pass resolves byes, double-elimination losers brackets, group qualifiers and
  retroactive edits.
- Tested it with 145 engine tests, including property-based tests (fast-check), at 99.9% line
  coverage. Built a backtracking Swiss pairer that never repeats an opponent when avoidable.

**Impact-focused**

- Shipped an organizer-to-spectator workflow where a result entered by an organizer appears on
  every open public page without a reload. Proved it with a two-browser Playwright test.
- Made it safe under concurrent edits with per-match optimistic versioning. Verified the
  production PostgreSQL path by running the full integration suite against a real PostgreSQL 17
  in CI.

## 30-second pitch

"Tournament Manager lets anyone run a tournament from a single link: paste in teams, pick round
robin, knockout, double elimination, groups or Swiss, and it draws the fixtures. Each result
instantly updates the standings and brackets, and fans see it live on a public page. The core is a
pure TypeScript engine that treats a bracket as a graph. Every match says where its players come
from, so a single function handles byes, losers brackets and even editing a result after later
rounds were played. It has about three hundred tests, including property-based tests that play
thousands of random tournaments."

## 2-minute demo script

1. **Landing page (10 s).** "Five formats, no sign-up. I'll create one." Click _Create a
   tournament_.
2. **Wizard (20 s).** Name it, pick _Single elimination_, show the review step, create. Point at
   the admin link warning: "only a hash of this token is stored."
3. **Admin: teams (15 s).** Paste six teams, then reorder one with the arrow buttons. "The fixture
   preview on the right is the real engine running in the browser; two top seeds get byes."
4. **Start (10 s).** Confirm the dialog. "Teams are now locked."
5. **Live (30 s).** Open the public page in a second window, side by side. Enter a quarter-final
   score in admin, and the bracket updates on the right without a reload. Mark a match live: it
   appears under "Live now".
6. **Edit after the fact (20 s).** Play a semi-final, then flip the quarter-final result. "The app
   tells me the semi-final was played by the wrong team and asks before resetting it."
7. **Other formats (15 s).** Open `/t/demo-swiss`: "Swiss pairing never repeats opponents; ties
   broken by Buchholz." Download the standings CSV.
8. **Close (10 s).** "Over 300 tests, including property-based tests of the bracket rules, and
   it's checked against a real PostgreSQL in CI."

## LinkedIn project description

I built Tournament Manager, a full-stack web app for running sports and esports tournaments.
Organizers create an event from one link, add teams and choose round robin, single or double
elimination, groups + knockout, or Swiss. The app draws the fixtures, keeps standings and brackets
up to date as results come in, and streams changes live to a public page for players and fans. It
handles real-world mess too: byes, forfeits, penalty shoot-outs, two organizers editing at once,
and correcting a result after later rounds were already played. Under the hood, a pure TypeScript
engine models each bracket as a graph and is covered by property-based tests. It runs on Next.js,
Prisma and PostgreSQL, with Playwright end-to-end tests in CI. Code:
https://github.com/rkslakshay/tournament-manager
