# Interview notes

Plain-language answers to the questions this project tends to raise. Each points at the code
that backs it up.

## "Walk me through the architecture."

Four layers, with dependencies pointing inwards:

1. **Engine** (`src/engine/`): pure TypeScript functions. Given teams and results, they generate
   fixtures, resolve brackets, compute standings and build schedules. There is no database, no
   network, no clock, and no randomness without a seed. It could be published as its own package.
2. **Services** (`src/server/services/`): load from the database, call the engine, write the
   outcome in one transaction, then tell live viewers something changed.
3. **API** (`src/app/api/`): thin. Validate input with zod, check the admin token, call a
   service, map errors to `{ error: { code, message } }`.
4. **UI**: server-rendered pages that become live client components.

Keeping the engine pure is the decision I'd defend first. All the hard logic is testable with
plain function calls, including property-based tests that generate thousands of random
tournaments.

## "How do you handle byes?"

- A bracket's size is the next power of two at or above the team count. With 12 teams that's 16
  slots and therefore 4 byes.
- Standard seeding (`seedBracket`) places seeds so the top seeds are kept apart. The empty slots
  fall to the highest seeds: seed 1 gets a bye, seed 16 doesn't exist.
- A bye is just a match where one slot is "bye". It is finished immediately with the real team as
  winner, so the next round fills in automatically.
- In **round robins** an odd count gets a phantom "bye" team. Whoever is drawn against it rests
  that round, and every team rests exactly once per leg.
- **Double elimination** is where it gets interesting: the loser of a bye match is itself a bye.
  That ghost drops into the losers bracket and gives its opponent a free pass. If two ghosts
  meet, the match is simply "not needed". One rule in `propagate` handles all of this, with no
  special cases in the generators.

## "What happens when someone edits a result that already advanced a team?"

- Every match says where its teams come from ("winner of semi-final 1"), so the bracket is a
  graph. After any result changes, `propagate` walks the graph in dependency order and
  re-resolves every slot.
- Later matches that haven't been played just get the new team.
- If a later match **was already played** by the old winner, that result is now meaningless.
  `propagate` lists those matches as _invalidated_ and returns them reset. It never silently
  deletes anything; it reports.
- The service then applies the tournament's policy:
  - **Reset downstream** (default): the API answers `409 CONFIRMATION_REQUIRED` with the affected
    matches. The organizer sees "these results will be cleared" and confirms.
  - **Block edit**: the change is refused.
- Score-only edits that keep the same winner change nothing downstream.
- Separately, every match has a `version`. If two organizers edit the same match, the second
  write gets `VERSION_CONFLICT` instead of silently overwriting the first.
- `propagate` is idempotent (running it twice changes nothing), which is checked with property
  tests over randomly played brackets.

## "Why are standings derived instead of stored?"

- Stored standings are a cache that can go stale: edit one result, forget to update the table,
  and the two disagree forever.
- Computing the table from the results on every read takes microseconds for a tournament this
  size, and it can't be wrong in a way the results aren't.
- It also makes tiebreaker changes free. Change the config and every table is instantly
  recomputed.
- The tiebreaker chain is configurable. The subtle part is **head-to-head among three or more
  teams**: build a mini-table of only the tied teams' games against each other. If that splits
  them into smaller groups, re-apply head-to-head inside each group using only _their_ games.
  A test case found by a random search pins down why the recursion matters.
- The chain ends with alphabetical order and finally the team id, so the order is always total
  and stable.

## "How do viewers get live updates? How would it scale?"

- When a service commits a change, it publishes a tiny event ("match X changed") to an in-memory
  hub. Each viewer holds a Server-Sent Events connection. On an event, the page **refetches the
  whole view** rather than patching itself, so a missed event can never leave it wrong.
- SSE fits because viewers only listen. It's plain HTTP and reconnects automatically. If it fails
  the client falls back to polling every 10 seconds, and it refetches when the tab becomes
  visible again.
- To scale to many viewers and several server instances:
  1. Replace the in-memory hub with **Redis pub/sub**, so an event published by any instance
     reaches viewers connected to every instance.
  2. Cache the public view at the **edge** with a short TTL and revalidate on write. Thousands of
     viewers refetching after an event then mostly hit the cache, not the database.
  3. Optionally include the new version in the event, so a client already up to date skips the
     refetch.
- Today on serverless hosting, the app bounds staleness instead: streams recycle every 60
  seconds, and clients re-sync every 30 seconds (see `docs/DEPLOYMENT.md`).

## "How does the scheduler work?"

- It's a constraint problem: a venue hosts one match per slot, a team plays at most once per slot
  with a configurable rest gap, and a match can't start before the matches that feed it.
- It uses a greedy heuristic: repeatedly pick the ready match with the fewest possible slots
  ("most constrained first"), breaking ties by the busiest team, and put it in its earliest
  option.
- The tie-break exists because of a concrete failure: with a team that must play in every slot,
  naive ordering leaves its last game nowhere to go.
- Matches that don't fit are reported, never dropped silently.

## "How do you know it works?"

- 230+ unit and integration tests. Engine coverage is about 100% of lines and 97% of branches, and
  CI enforces a 90% minimum.
- Property-based tests check invariants rather than examples:
  - every pair meets exactly once per leg;
  - seeds 1 and 2 can only meet in the final;
  - in double elimination every non-champion loses exactly twice;
  - the scheduler never double-books.
- Every API route is tested for success, bad input, missing or wrong token, and state conflicts.
  A test fails if someone adds a route without tests.
- Playwright runs the full organizer flow on desktop and mobile, and a two-browser test shows a
  result entered by the organizer appearing on a viewer's open page without a reload.

## "What would you do differently or next?"

- Redis for the event hub and rate limiter (above).
- Accounts, so organizers have a dashboard instead of a single secret link.
- A forfeit action, penalty scores for knockout draws, and live in-match scores.
- Swiss-system pairing.
