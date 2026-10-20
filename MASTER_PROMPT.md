# Master Prompt

Paste everything inside the block below into Claude Code from the project root.

---

```
You are the lead engineer building "Tournament Manager" autonomously while I am away. I will not be available to answer questions, so make reasonable decisions yourself and document them.

## Setup
1. Read CLAUDE.md, then docs/ARCHITECTURE.md, docs/DESIGN.md, docs/TECHSTACK.md, docs/ROADMAP.md, PROGRESS.md and BLOCKERS.md in full before writing any code.
2. If the project is not yet scaffolded, start at Phase 0 of the roadmap. Otherwise resume at the first unchecked task.

## Work loop (repeat until a stop condition is met)
1. Pick the first unchecked task in docs/ROADMAP.md.
2. For engine tasks: write failing tests first (include property-based tests where the roadmap says so), then implement until they pass.
3. For other tasks: implement, then add tests appropriate to the layer.
4. Run `npm test`, `npm run lint` and `npm run typecheck`. Fix every failure. A task is not done until all three pass.
5. Check the task off in docs/ROADMAP.md.
6. Add an entry to PROGRESS.md (what changed, decisions, tests, dependencies, next task).
7. Commit with a clear message, e.g. `feat(engine): round-robin generator with bye handling (task 1.2)`.
8. Continue to the next task.

## Phase gates
At the end of each phase, verify the gate condition listed in the roadmap. Run the full test suite and coverage. If the gate fails, fix it before starting the next phase.

## Rules
- Follow the principles in CLAUDE.md strictly. The engine must stay pure; standings must be derived, never stored.
- Do not ask me questions. If something is ambiguous, choose the simplest option that matches the docs, and record the assumption in PROGRESS.md.
- If you are stuck on the same problem after 3 genuine attempts, write it up in BLOCKERS.md, make the smallest safe workaround or skip the task, and move on. Do not loop on one problem.
- Never weaken, delete or skip a test just to make it pass. If a test is wrong, fix it and explain why in PROGRESS.md.
- Do not add dependencies beyond TECHSTACK.md without a one-line justification in PROGRESS.md.
- No destructive commands outside the project directory. Never run `rm -rf` on anything except build or cache folders inside the project. Do not touch git history (no force push, no rebase of existing commits).
- Do not invent features outside the roadmap until Phase 6 is complete.
- Keep code readable: small functions, clear names, brief JSDoc on every exported engine function with an example.
- Keep the README accurate as features land.

## Stop conditions
Stop and write a final summary in PROGRESS.md when any of these is true:
- All of Phases 0 to 6 are complete (then you may begin Stretch tasks in order).
- A phase gate cannot be passed after serious effort (record why in BLOCKERS.md).
- You are about to run out of budget or context. Before that happens, make sure everything is committed and PROGRESS.md states exactly where to resume.

## Final summary format
When stopping, add to the top of PROGRESS.md:
- Phases completed
- Test count and engine coverage percentage
- List of assumptions made
- Anything in BLOCKERS.md that needs my attention
- Exact next step to resume

Begin now.
```

---

## Tips for running overnight

- **Use a safe environment.** Letting Claude Code run unattended usually means skipping permission prompts. Only do that inside a container, a VM, or a throwaway folder with no sensitive files. Otherwise, pre-approve specific commands (`npm`, `npx`, `git`, `prisma`) in Claude Code's permission settings instead.
- **Initialize git first** (`git init`, first commit) so every task becomes a commit you can inspect or roll back.
- **Check usage limits.** Long sessions can hit plan limits. The prompt tells Claude to commit and log its resume point, so you can continue with: `Read PROGRESS.md and BLOCKERS.md, then continue from where you left off using the work loop in MASTER_PROMPT.md.`
- **Review in the morning.** Read PROGRESS.md top to bottom, then skim the engine code and tests. Ask Claude to explain any module you could not describe in an interview.
