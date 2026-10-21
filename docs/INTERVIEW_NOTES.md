# Interview notes

Likely questions with short, honest answers, and where to point in the code. Numbers come from the
last verified run: **304 unit and integration tests, 144 of them engine tests, 10/10 Playwright
runs, engine coverage 99.9% of lines and 96.3% of branches.**

## Architecture and design

**1. Walk me through the architecture.**

- Four layers, with dependencies pointing inward.
  - **Engine** (`src/engine/`): pure TypeScript: fixtures, brackets, standings, Swiss, scheduling.
  - **Services** (`src/server/services/`): load, call the engine, save in one transaction, notify viewers.
  - **API** (`src/app/api/`): validate with zod, check the admin token, call a service.
  - **UI**: Next.js pages.
- The engine has no database, network, clock or unseeded randomness, so the hard logic is tested
  with plain function calls.

**2. Why keep the engine pure?**

- It makes the hardest code the easiest to test. Property-based tests can run thousands of random
  tournaments in seconds with no database.
- It also runs in the browser: the admin page previews fixtures with the same code the server uses
  (`src/lib/plan-stages.ts`).

**3. How do you model a bracket?**

- As a directed acyclic graph. Each match has a home and an away _source_: a team, "winner of match
  X", "loser of match X", "group A, 1st", or a bye.
- One function, `propagate`, resolves every source in dependency order. Byes, losers brackets,
  group qualifiers and the grand-final reset all follow from that one rule.

**4. Why derive standings instead of storing them?**

- A stored table is a cache that can go stale: edit a result, forget the table, and they disagree
  forever.
- Recomputing on every read costs microseconds at this size and can never be wrong in a way the
  results aren't. Changing a tiebreaker setting is also free.

**5. What does the tournament lifecycle look like?**

- A small state machine: DRAFT → REGISTRATION → IN_PROGRESS → COMPLETED, plus ARCHIVED from any
  state. COMPLETED → IN_PROGRESS is allowed when an edit re-opens matches.
- Illegal moves throw `INVALID_STATE` (409). The full transition table is tested (`src/server/lifecycle.ts`).

**6. Why SQLite in development and PostgreSQL in production?**

- SQLite needs zero setup, so tests get a fresh database file each and run in parallel.
- Production needs a real server, and Prisma can't switch providers by environment variable. So a
  script generates the Postgres schema from the SQLite one, and a test fails if they drift.
- `npm run test:pg` runs every server integration test against a real PostgreSQL 17
  (embedded-postgres), using the production migrations.

## Algorithms

**7. How do you handle byes?**

- A bracket's size is the next power of two, and the empty slots go to the top seeds.
- A bye match is finished immediately with the real team as the winner.
- In double elimination, the _loser_ of a bye is itself a bye, so it flows into the losers bracket
  with no special code.
- Round robins add a phantom "bye" seat; everyone rests exactly once per leg.

**8. How does the round robin work?**

- The circle method: fix one team, rotate the others each round.
- Home advantage alternates, giving the minimum n−2 "breaks" (two home or two away games in a
  row). Property tests check that every pair meets exactly once per leg.

**9. How does seeding keep the best teams apart?**

- Start with `[1, 2]`, then replace each seed `s` with `s, 2m+1−s` as the bracket doubles. That
  gives 1,8,4,5,2,7,3,6.
- A property test checks that the top 2ᵏ seeds always land in different blocks, so seeds 1 and 2
  can only meet in the final.

**10. Explain double elimination.**

- A winners bracket, and a losers bracket that alternates "drop-down" rounds (new losers come in)
  with "consolidation" rounds (survivors play each other).
- In the grand final, if the losers-bracket champion wins, a reset match is played.
- Losers drop in with a rotating pattern, chosen by simulating 1,200 brackets and counting rematches.
- A property test checks that every non-champion is eliminated after exactly two losses.

**11. What happens when someone edits a result that already advanced a team?**

- `propagate` re-resolves every later slot. Unplayed matches simply get the new team.
- Matches that were _already played_ by the old winner are reset and reported as `invalidated`.
- The service then applies the tournament's policy: ask the organizer to confirm (409
  `CONFIRMATION_REQUIRED`, listing the matches) or block the edit.
- `propagate` is idempotent; that is tested on thousands of random brackets.

**12. How are ties broken in the table?**

- A configurable chain: points, head-to-head, goal difference, goals scored, wins, seed, name, and
  finally team id, so the order is always total.
- Head-to-head builds a mini table of only the tied teams' games. If that splits them, it is
  re-applied within each smaller group. A randomized search found the 4-way tie that proves the
  recursion matters; it is pinned as a test.

**13. How does the Swiss system pair players?**

- Rank by points, then Buchholz (the sum of opponents' points), then seed. Pair neighbours
  (Monrad style).
- A depth-first search with backtracking avoids every rematch whenever one is possible; otherwise
  it reports the fewest rematches instead of failing.
- With an odd count, the lowest-ranked player without a bye sits out with a win.
- Each round is paired in the same transaction that completes the previous one.

**14. How does the scheduler work, and is it optimal?**

- A greedy, _most-constrained-first_ heuristic. Take the match with the fewest (slot, venue)
  options among those whose feeders are placed; break ties by the busiest team. Never break the
  rest, venue or bracket-order rules; report what doesn't fit.
- It is **not** optimal. An exact solver (constraint programming) could fit more in tight
  schedules.

## State, concurrency and data

**15. How is state managed in the UI?**

- The database is the source of truth. Pages render a server-built view.
- On any change the client refetches the _whole_ view rather than patching it, so it can't drift.
- Only result entry is optimistic: the score shows immediately and is replaced by the server's
  view (or rolled back on error).

**16. Two organizers edit the same match at once. What happens?**

- Every match has a `version`. The client sends the version it saw; a stale one gets 409
  `VERSION_CONFLICT` and nothing changes.
- The write itself is `UPDATE … WHERE id = ? AND version = ?`, so even two simultaneous requests
  can't both win. A test fires two at once and checks that exactly one succeeds.

**17. Why publish live events after the transaction commits?**

- If you publish inside the transaction and it rolls back, viewers are told about a change that
  never happened.
- Publishing after commit can at worst _miss_ an event, and the client re-syncs anyway.

**18. Forfeits and knockout draws?**

- A forfeit is stored as an ordinary result (3–0 by default, 1–0 for sports like chess) marked
  `WALKOVER`, so standings and brackets need no special case.
- A level knockout score is accepted only as "won on penalties" with the shoot-out winner. The rules
  live in one pure function shared by the server and the form (`src/lib/result-rules.ts`).

## Real-time and scaling

**19. Why Server-Sent Events rather than WebSockets?**

- Viewers only receive; they never send. SSE is plain HTTP, reconnects automatically, passes
  through proxies, and needs no extra protocol. WebSockets would add two-way complexity for nothing.

**20. What if a viewer misses an event?**

- Events carry no data, only "something changed", and the client refetches the full view. It also
  refetches after every reconnect, when the tab becomes visible, and every 30 seconds.
- If SSE keeps failing, it falls back to polling every 10 seconds.

**21. How would this scale to thousands of viewers?**

- (1) **Fan-out across servers:** set `REDIS_URL` so events go through Redis pub/sub and reach
  viewers on every instance. The adapter exists, tested with `ioredis-mock`.
- (2) **Read load:** each event makes every viewer refetch. Cache `GET /api/t/:slug` at the edge for
  a second or two, keyed by a version, so thousands of refetches hit the cache, not the database.
- (3) **Payload:** send the new version in the event, so up-to-date clients skip the refetch.
- (4) **Connections:** SSE holds one connection per viewer. Very large events would move streams to
  a dedicated service or a managed pub/sub. I have **not** load-tested any of this.

**22. What happens on serverless hosting like Vercel?**

- Without Redis, an event published by one function instance doesn't reach a viewer connected to
  another. Streams also end after 60 seconds.
- The client's reconnect and 30-second re-sync bound the delay to about 30 seconds; with Redis,
  updates are immediate.

## Security

**23. How does the admin token work?**

- Creating a tournament returns 32 random bytes (base64url) once. Only its SHA-256 hash is stored.
- Requests send `Authorization: Bearer <token>`, compared with `timingSafeEqual` on the digests.
- A missing or wrong token gets the same 401, and the public view never exposes the hash.

**24. Why hash a random token rather than bcrypt it?**

- Bcrypt slows down guessing of _low-entropy_ passwords. A 256-bit random token can't be guessed,
  so a fast hash suffices, and the hash still means a database leak doesn't leak working tokens.

**25. Isn't a token in the URL risky?**

- Somewhat: URLs land in history and logs. The admin page moves the token from `?token=` into
  localStorage and strips it from the address bar. It also covers it in the demo GIF.
- A real product would use accounts or a short-lived exchange code instead.

**26. How do you protect against abuse and bad input?**

- Every request body is validated with zod. Services re-check state transitions (for example, no
  team changes after the start). Write endpoints are rate-limited per IP, _before_ the token check,
  so guessing is throttled too.
- CSV export neutralises spreadsheet formula injection, since team names are user input.

## Testing and quality

**27. What's your testing strategy?**

- The engine is tested first and heavily, including property-based tests (fast-check) of the
  invariants above.
- Services and routes run against real databases (SQLite per test file, and PostgreSQL via
  `test:pg`). Every route is tested for success, bad input, auth and conflicts, and a test fails if
  a route is added without tests.
- Playwright runs the full organizer flow on desktop and mobile, including a two-browser test of
  live updates.

**28. Did the tests find real bugs?**

- Yes, several.
  - Brackets accepted duplicate team ids.
  - Equal seeds made brackets depend on input order.
  - A Swiss round 4 match was labelled "Final".
  - The public page stayed on "Fixtures" after a tournament went live.
  - The admin token reappeared in the URL because Next.js re-wrote history after my effect ran.
  - A scheduler case needed a tie-break.
- Each now has a regression test or a documented check.

**29. How did you make sure the Postgres path actually works?**

- `npm run test:pg` starts a real PostgreSQL 17 (embedded-postgres), applies the production
  migrations with `prisma migrate deploy`, and runs all server tests against it. It also runs in CI.

**30. What would you do differently?**

- Start with accounts instead of admin links, if the product needed dashboards.
- Pick a dedicated real-time service earlier, if the main goal were huge audiences.
- Store richer match data (penalty scores, live scores) from day one.
- Treat the scheduler as a constraint problem from the start.

## Honest limitations

Say these before someone else finds them:

- **Not deployed.** The Vercel and Neon configuration exists, but the app has never run in
  production. I can't quote real-world performance.
- **No load testing.** The scaling answers are designs, not measurements.
- **The Redis adapter is tested only with `ioredis-mock`**, never against a live Redis server.
- **The rate limiter is in memory**, so it is per instance on serverless hosting.
- **The Swiss pairing is Monrad-style**, not the official FIDE Dutch system; colour balance only
  counts home games.
- **The scheduler is a greedy heuristic** and can miss schedules an exact solver would find.
- **No accounts.** Losing the admin link means losing control. There is no audit log of who changed
  what.
- `npm audit` reports advisories in build-time tooling (Next's bundled PostCSS, the Prisma CLI);
  fixing them needs a major upgrade to Next 16.
- **How it was built:** with an AI coding assistant, under a written spec and roadmap I directed.
  Be ready to say so, and know the code well enough to explain any line ([CODE_TOUR.md](CODE_TOUR.md)
  and [STUDY_GUIDE.md](STUDY_GUIDE.md) are for exactly that).
