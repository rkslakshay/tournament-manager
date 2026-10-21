# Architecture

## 1. Layers

```
UI (React) ──► API routes (zod-validated) ──► Services ──► Engine (pure)
                                                 │
                                                 └──► Prisma ──► DB
                                                 └──► SSE hub ──► public viewers
```

- **Engine**: pure functions. Input: plain objects. Output: plain objects. No side effects.
- **Services**: load data from DB, call the engine, persist the result in a transaction, publish an SSE event.
- **API**: thin. Validate, authorize, call a service, return JSON.
- **UI**: renders state; optimistic updates only for result entry.

## 2. Domain model

### Tournament lifecycle (state machine)

```
DRAFT ──► REGISTRATION ──► IN_PROGRESS ──► COMPLETED
   └────────────────────────► ARCHIVED (any state)
```

- DRAFT: name, sport, and format being configured.
- REGISTRATION: teams can be added/removed/reseeded.
- IN_PROGRESS: fixtures generated and locked; teams can no longer change.
- COMPLETED: all matches finished (or organizer closes manually).

### Match lifecycle

```
PENDING ──► SCHEDULED ──► LIVE ──► FINISHED
```

- PENDING: one or both participants not yet decided (waiting on earlier matches).
- SCHEDULED: both participants known.
- A match can only move to LIVE or FINISHED when both participants are known.

### Entities (Prisma-style)

```
Tournament { id, slug, name, sport, status, adminTokenHash, config(JSON), createdAt }
Team       { id, tournamentId, name, seed, groupLabel? }
Stage      { id, tournamentId, order, type(ROUND_ROBIN|SINGLE_ELIM|DOUBLE_ELIM|GROUP|SWISS), config(JSON) }
Match      { id, stageId, round, position, bracket(WINNERS|LOSERS|GRAND_FINAL|null),
             homeTeamId?, awayTeamId?,
             homeSource(JSON)?, awaySource(JSON)?,    // e.g. {type:"winner", matchId:"m12"}
             status, homeScore?, awayScore?, winnerTeamId?, decidedBy?,
             scheduledAt?, venueId? }
Venue      { id, tournamentId, name }
```

`homeSource` / `awaySource` are the key to brackets: each match declares where its participants come from (`team`, `winner of match X`, `loser of match X`, `group rank N`). A bracket is therefore a directed acyclic graph of matches.

## 3. Engine modules

### 3.1 round-robin

`generateRoundRobin(teamIds, { legs: 1|2, seed? }) -> Fixture[]`

- Circle method: fix team 0, rotate the rest each round.
- Odd team count: add a `null` bye slot; matches against it are dropped and recorded as byes.
- Home/away balancing: alternate home advantage so no team has more than one consecutive home or away game where possible.
- Second leg mirrors the first with home/away swapped.
- Properties to test: every pair meets exactly `legs` times; no team plays twice in a round; rounds = n-1 (even n) or n (odd n).

### 3.2 seeding

`seedBracket(size) -> number[]` returns standard seed order (e.g. size 8: `[1,8,4,5,2,7,3,6]`) so top seeds are separated until late rounds.

- Bracket size = next power of two >= team count.
- Byes go to the highest seeds.
- Test: seeds 1 and 2 can only meet in the final; seed 1 vs 8 in round one for size 8.

### 3.3 single-elimination

`generateSingleElimination(teams, { thirdPlaceMatch? }) -> Match[]`

- Rounds = log2(size). Each non-first-round match has `homeSource`/`awaySource` pointing at feeder matches.
- Byes: the team auto-advances; the bye match is marked FINISHED with that winner.

### 3.4 double-elimination

`generateDoubleElimination(teams) -> Match[]`

- Winners bracket as above. Losers bracket alternates: a "drop-down" round (losers from the winners round join) then a "consolidation" round (losers-bracket survivors play each other).
- Grand final, with optional bracket reset if the losers-bracket champion wins the first grand final.
- Losers routed from winners round R to a defined losers round, with a reversal pattern to avoid immediate rematches.

### 3.5 group-knockout

`generateGroupKnockout(teams, { groups, advancePerGroup }) -> Stage[]`

- Snake-draft teams into groups by seed.
- Each group is a round-robin stage.
- Knockout stage participants use `{type:"groupRank", group:"A", rank:1}` sources, resolved once groups finish.
- Cross-group pairing rule so same-group teams do not meet in round one (A1 vs B2, B1 vs A2).

### 3.6 standings and tiebreakers

`computeStandings(teams, matches, config) -> StandingRow[]`

- Row: played, won, drawn, lost, for, against, diff, points.
- Tiebreaker chain is configurable, applied in order: `points -> headToHead -> goalDifference -> goalsFor -> wins -> seed -> alphabetical`.
- Head-to-head among 3+ tied teams is computed on a mini-table of only the tied teams' matches against each other, and re-applied recursively if still tied.
- Deterministic: the final fallback guarantees a total order.

### 3.7 propagation

`propagate(matches) -> { matches, invalidated: MatchId[] }`

- Walks the match DAG in topological order, resolving each `homeSource`/`awaySource` from finished upstream matches.
- If a result is **edited** and downstream participants change:
  - Downstream matches that have no result are simply re-resolved.
  - Downstream matches that already have results are reported in `invalidated`. The service layer applies the configured policy: `RESET_DOWNSTREAM` (default, requires organizer confirmation) or `BLOCK_EDIT`.
- Pure and idempotent: running it twice gives the same output.

### 3.8 scheduler

`scheduleMatches(matches, { venues, slots, minRestSlots }) -> Assignment[]`

- Constraint satisfaction: a team cannot play in two matches in the same slot, needs `minRestSlots` between its matches, and a venue hosts one match per slot.
- Matches must respect dependency order (a round cannot be scheduled before its feeders).
- Greedy algorithm with "most constrained match first" ordering; report unscheduled matches rather than failing silently.

## 4. Services layer

- `createTournament`, `addTeam`, `removeTeam`, `reseed`
- `startTournament`: runs the right generator, persists stages and matches in one transaction, sets status IN_PROGRESS
- `recordResult(matchId, scores)`: validates, persists, calls `propagate`, applies changes, publishes SSE event, all in one transaction
- `editResult`: same as above, with invalidation policy
- `getPublicView(slug)`: matches plus derived standings, safe for public exposure (no admin token)

## 5. Real-time

- In-memory SSE hub keyed by tournament slug. `recordResult` publishes `{type:"match_updated", matchId}` after commit.
- Public page opens `EventSource('/api/t/{slug}/events')`. On event, it refetches the view (simple and consistent), with polling fallback.
- Scaling note for docs and interviews: for multiple server instances, replace the in-memory hub with Redis pub/sub. Public GETs can be cached at the edge with short TTL and revalidated on write.

## 6. Security

- Admin token: 32 random bytes, shown once, stored as SHA-256 hash, compared in constant time.
- All write endpoints require the token. Public endpoints are read-only.
- Rate-limit write endpoints and tournament creation.
- Never expose admin token hash or internal IDs that are not needed.

## 7. Testing strategy

- **Engine**: unit tests plus property-based tests (fast-check) for invariants (every pair meets, no double-booking, seeds separated).
- **Services**: integration tests against a temporary SQLite database.
- **E2E (Playwright)**: create tournament, add teams, start, enter results, view public page.
