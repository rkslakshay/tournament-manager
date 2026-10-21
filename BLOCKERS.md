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
