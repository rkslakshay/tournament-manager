# Code tour

A guided walk through the engine, the heart of the app, for someone who did not write it. Every
worked example below was produced by running the real code.

## Before you start: three ideas that explain everything

1. **The engine is pure.** Everything in `src/engine/` is plain TypeScript: give a function
   teams and matches, get matches or tables back. No database, no network, no clock, no
   unseeded randomness. That is why the engine's 145 tests run in a few seconds.
2. **A match says where its players come from.** Instead of storing "Lions play Sharks in the
   final", a final stores `homeSource: { type: "winner", matchId: "sf1" }`. A tournament is a
   graph of matches. One function (`propagate`) fills in the names whenever results change.
3. **Standings are never saved.** A league table is recalculated from the results every time
   someone looks at it, so it can never disagree with them.

Types live in `src/engine/types.ts` (`Team`, `Match`, `Source`, `StandingRow`). Helpers for one
match (`hasResult`, `isBye`, `loserOf`) live in `src/engine/match.ts`. Run all engine tests with
`npx vitest run src/engine`.

---

## 1. Round robin: `round-robin.ts`

**Problem.** Everyone must play everyone, nobody plays twice in a round, and home games should be
shared fairly.

**Algorithm: the circle method.** Put the teams round a table. Fix one seat; everyone else
rotates one seat per round. The pairs facing each other play. With an odd number of teams, add
an empty "bye" seat; whoever faces it rests.

_Worked example, 4 teams A B C D_ (`generateRoundRobin(["A","B","C","D"])`):

| Round | Matches (home–away) |
| ----- | ------------------- |
| 1     | D–A, C–B            |
| 2     | B–D, A–C            |
| 3     | D–C, B–A            |

With three teams A B C, a bye seat is added: A rests in round 1, B in round 2, C in round 3.

**Home and away.** The fixed seat alternates home and away every round, and every second pair is
flipped. This gives the smallest possible number of "breaks" (two home or two away games in a
row): n−2.

**Design decision.** Return `{ fixtures, byes, rounds }`, not just fixtures, because the docs ask
for byes to be recorded. _Tradeoff:_ a slightly bigger return type, but nobody has to work out
who rested.

**Look at:** `generateRoundRobin`, `pairingsForRound` · tests `round-robin.test.ts` (property
tests: every pair meets exactly once per leg, at most two home games in a row).

---

## 2. Seeding: `seeding.ts`

**Problem.** In a knockout, the two best teams should only be able to meet in the final.

**Algorithm.** Start with `[1, 2]`. To double the bracket, replace each seed `s` with the pair
`s, (new size + 1 − s)`. So `[1,2]` becomes `[1,4,2,3]`, then `[1,8,4,5,2,7,3,6]`. Neighbours
play in round one. The bracket size is the next power of two; empty seats are byes, and because
the empty seats are the highest numbers, the top seeds get the byes.

_Worked example._ 8 slots: `1,8,4,5,2,7,3,6`. With 6 teams, round one is
`1 v bye, 4 v 5, 2 v bye, 3 v 6`.

**Design decision.** `orderBySeed` sorts by seed and then by team id, and rejects duplicate ids.
_Tradeoff:_ one extra rule. It exists because the review in task 7.3 found that equal seeds made
the bracket depend on the order the teams arrived in.

**Look at:** `seedBracket`, `firstRoundPairs`, `orderBySeed` · tests `seeding.test.ts` (the top 2ᵏ
seeds always land in different blocks).

---

## 3. Single elimination: `single-elimination.ts`

**Problem.** Build the bracket tree and handle byes.

**Algorithm.** Round one comes from the seeding. Every later match has two sources: "winner of
match 2p−1" and "winner of match 2p" from the round before. A team facing a bye gets a match that
is already FINISHED with itself as the winner. An optional third-place match is fed by the two
semi-final _losers_.

_Worked example, 6 teams A–F (seeds 1–6), after `propagate`:_

| Match | Players                          | Status               |
| ----- | -------------------------------- | -------------------- |
| r1m1  | A vs bye                         | finished: A advances |
| r1m2  | D vs E                           | scheduled            |
| r1m3  | B vs bye                         | finished: B advances |
| r1m4  | C vs F                           | scheduled            |
| r2m1  | A vs winner of r1m2              | pending              |
| r2m2  | B vs winner of r1m4              | pending              |
| r3m1  | winner of r2m1 vs winner of r2m2 | pending              |

**Design decision.** The generator does not fill in later rounds itself; `propagate` always does.
_Tradeoff:_ you must remember to call `propagate`, but there is exactly one piece of code that
decides who plays whom.

**Look at:** `generateSingleElimination`, `buildBracketRounds` · tests
`single-elimination.test.ts`, `edge-cases.test.ts` (2 to 128 teams).

---

## 4. Double elimination: `double-elimination.ts`

**Problem.** Teams are out only after two losses. Losers drop into a second bracket, and the two
bracket champions meet in a grand final.

**Algorithm.** The winners bracket is a normal knockout. The losers bracket alternates two kinds
of round:

- **drop-down**: survivors play the teams who have just lost in the winners bracket;
- **consolidation**: survivors play each other.

The grand final pits the winners champion (home) against the losers champion. If the losers
champion wins, a reset match is played, because both now have one loss.

_Worked example, 4 teams A–D:_

| Match                | Home           | Away           |
| -------------------- | -------------- | -------------- |
| w1m1                 | A              | D              |
| w1m2                 | B              | C              |
| w2m1 (winners final) | winner of w1m1 | winner of w1m2 |
| l1m1                 | loser of w1m1  | loser of w1m2  |
| l2m1 (losers final)  | winner of l1m1 | loser of w2m1  |
| gf1 (grand final)    | winner of w2m1 | winner of l2m1 |
| gf2 (reset)          | loser of gf1   | winner of gf1  |

**The clever bit.** Byes need no special code. The loser of a bye match is itself a "bye", so it
flows into the losers bracket and gives someone a free pass there. The grand-final reset is marked
"not needed" automatically when the winners champion wins `gf1`.

**Design decision.** Losers drop in with a rotating pattern (reverse, swap halves, identity,
reverse halves). Simulations of 1,200 brackets gave the fewest rematches for this pattern.
_Tradeoff:_ some rematches are mathematically unavoidable in double elimination; the pattern
only reduces them.

**Look at:** `generateDoubleElimination`, `losersDropPosition` · tests
`double-elimination.test.ts` (with random results, every non-champion loses exactly twice).

---

## 5. Groups + knockout: `group-knockout.ts`

**Problem.** Round-robin groups first, then the best teams of each group play a knockout, without
two teams from the same group meeting straight away.

**Algorithm.**

- **Snake draft** into groups by seed: A, B, B, A, A, B…
- Each group is a round robin.
- Knockout slots use sources like "group A, 1st". These fill in once a group's last match is played.
- Group winners take the top knockout seeds. Runners-up are placed with the first rotation of the
  group order that avoids same-group pairs.

_Worked example, 8 teams in 2 groups, top 2 advance:_ group A = seeds 1, 4, 5, 8; group B =
seeds 2, 3, 6, 7. The knockout's first round is **A1 v B2** and **B1 v A2**.

**Design decision.** A search over rotations rather than a hand-written table of pairings.
_Tradeoff:_ it is guaranteed for one or two qualifiers per group (tested for 2 to 8 groups); with
more qualifiers it does its best.

**Look at:** `assignGroups`, `generateGroupKnockout`, `resolveGroupRankings` · tests
`group-knockout.test.ts`.

---

## 6. Swiss: `swiss.ts`

**Problem.** Many players, few rounds, nobody eliminated. Each round, players should meet others
on a similar score, never the same opponent twice.

**Algorithm.** Rounds are paired one at a time, after the previous round finishes:

1. Rank everyone by points, then **Buchholz** (the sum of your opponents' points: beating strong
   players counts for more), then seed.
2. With an odd count, the lowest-ranked player who has not had a bye sits out and gets a win.
3. Pair neighbours in the ranking (1 v 2, 3 v 4…). This is the Monrad method. If a pair has
   already met, a depth-first search backtracks and tries the next candidate.

_Worked example, 6 players A–F._ Round 1 pairs A–B, C–D, E–F. Results: A beats B, D beats C, and
E–F is a draw. The ranking is A 3, D 3, E 1, F 1, B 0, C 0. Naive neighbours would be A–D, E–F,
B–C, but E and F have already met. So the search gives **D–A, B–E, F–C**. D is at home because A
already had a home game.

**Design decision.** Monrad pairing with backtracking instead of the official FIDE Dutch system.
_Tradeoff:_ much simpler and provably free of rematches whenever possible, but not identical to
official chess pairings.

**Look at:** `pairSwissRound`, `swissStandings`, `defaultSwissRounds` · tests `swiss.test.ts`
(property tests: nobody meets twice, one game per round, at most one bye each), and the service
that pairs the next round, `src/server/services/swiss-rounds.ts`.

---

## 7. Standings and tiebreakers: `standings.ts`, `tiebreakers.ts`

**Problem.** Turn results into a league table, and break ties fairly and predictably.

**Algorithm.** `tallyStandings` adds up played, won, drawn, lost, goals and points. `rankTeams`
then applies the tiebreaker chain in order: points, **head-to-head**, goal difference, goals
scored, wins, seed, name, and finally team id, so there is always a full order.

**Head-to-head, recursively.** When several teams are level, build a mini table from only their
games against each other (points, then goal difference, then goals). If that splits them into
smaller groups, apply head-to-head again inside each group, using only _those_ teams' games.

_Worked example_ (pinned in `tiebreakers.test.ts`). Four teams all finish on 4 points with goal
difference 0. In the mini table, B and C scored 2 and A and D scored 1, so {B, C} rank above
{A, D}. Re-applying head-to-head inside each pair: C beat B, and A beat D. The final order is
**C, B, A, D**. Without the recursion, it would have been B, C, A, D.

**Design decision.** Head-to-head compares mini-table points, then goal difference, then goals
(UEFA style). _Tradeoff:_ more rules to explain, but ties get settled by the games between the
tied teams, which is what players expect.

**Look at:** `tallyStandings`, `computeStandings`, `rankTeams` · tests `standings.test.ts`,
`tiebreakers.test.ts`, `edge-cases.test.ts` (perfect 4-way cycles, all draws).

---

## 8. Propagation: `propagation.ts`

**Problem.** After any result, or any _edit_, every match's players must be correct, and results
that are no longer valid must be found.

**Algorithm.**

1. Sort the matches so every match comes after the ones that feed it (Kahn's topological sort).
2. Walk them in order, resolving each source: a team, a winner, a loser, a group rank, or a bye.
3. Players unchanged: keep the match. Players changed: if the match had no result, just update
   it; if it **already had a result** (or was live), reset it and add it to `invalidated`.

_Worked example, 4-team knockout._ A beats D, B beats C, and A wins the final. Now the organizer
edits the first semi-final so D won. `propagate` puts D into the final, clears the final's score,
and returns `invalidated: ["r2m1"]`. The service then asks the organizer to confirm the reset,
or blocks the edit, depending on the tournament's policy.

**Design decision.** `propagate` only _reports_ invalidated matches; it never decides what to do
about them. _Tradeoff:_ the caller has more work, but the policy lives where the organizer's
settings live, and the function stays pure and **idempotent**: running it twice changes nothing,
a property tested on thousands of random brackets.

**Look at:** `propagate`, `topologicalOrder` · tests `propagation.test.ts`, the deep-edit cases in
`edge-cases.test.ts`.

---

## 9. Scheduler: `scheduler.ts`

**Problem.** Give each match a time slot and a venue. A venue hosts one match per slot, a team
needs rest between games, and a semi-final cannot start before its quarter-finals.

**Algorithm.** Greedy, _most constrained first_. Repeatedly take the ready matches (all their
feeders are placed), count how many (slot, venue) options each still has, and place the one with
the fewest options in its earliest option. Ties go to the match whose team has the most games
left. Options are only counted up to 32: a match with that many choices is not
constrained, and counting them all made a 496-match league take two minutes. Matches that cannot fit are reported in `unscheduled`, never dropped silently.

_Worked example, 4-team knockout, one court, one rest slot between games:_ semi 1 → slot 0,
semi 2 → slot 1, final → slot 3 (it must wait one slot after semi 2).

**Design decision.** A greedy heuristic, not an exact solver. _Tradeoff:_ fast and predictable,
but it can occasionally leave a match unscheduled that a cleverer search could fit. The busiest-team
tie-break exists because a test found a case where plain "fewest options" failed.

**Look at:** `scheduleMatches` · tests `scheduler.test.ts` (property: never double-books a team or
venue, always respects rest and bracket order).

---

## Where the engine meets the rest of the app

- `src/lib/plan-stages.ts` picks the right generator for a tournament's format. It runs in the
  server _and_ in the browser (fixture preview).
- `src/server/services/results.ts` (`applyResult`) is the main write path: validate → apply score →
  `propagate` → enforce the edit policy → save → maybe pair the next Swiss round → notify viewers.
- `src/lib/result-rules.ts` decides who won a match (extra time, penalties, league draws). It is
  shared by the server and the admin form.
- `src/server/services/public-view.ts` builds what viewers see, computing standings on the spot.
