# Blockers

Log anything that needs a human decision or that failed after 3 serious attempts.

```
## Task X.Y: title
- What was attempted
- Error or ambiguity
- What was done instead (skipped, simplified, assumption made)
```

## Task 2.3: Forfeit after start (product decision, non-blocking)
- DESIGN.md says removing a team after start is not allowed and suggests offering a forfeit (the opponent gets a walkover). There is no roadmap task for a dedicated forfeit feature.
- Done instead: removal after start is refused with a message pointing to forfeits. Organizers can record a walkover as a normal result (for example 3-0). A dedicated "forfeit team" action, which would auto-lose all of a team's remaining matches, needs a decision on scoring (fixed walkover score per sport?) and is left for a human.

## Task 6.2: PostgreSQL not exercised against a live server (needs a human, low risk)
- What was done: the production schema is generated from the SQLite one, validated with `prisma validate`, and its initial migration was produced offline with `prisma migrate diff --from-empty`. A unit test keeps the two schemas in sync.
- Not done: no PostgreSQL server was available in this environment, so `migrate deploy` and the integration tests have not run against Postgres.
- To verify: create a Neon (or local) database, set `DATABASE_URL` and `DIRECT_URL`, run `npm run db:pg:generate && npm run db:pg:deploy && npm run db:seed`, then open a demo page. The only provider-specific feature used is `Json`, which maps to `JSONB` on both.

