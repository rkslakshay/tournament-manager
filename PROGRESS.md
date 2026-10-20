# Progress Log

Append newest entries at the top. Format:

```
## YYYY-MM-DD HH:MM: Task X.Y: short title
- What changed
- Decisions made and why
- Tests added / results
- Dependencies added (with justification)
- Next task
```

## 2026-10-21 04:10: Task 0.1: Scaffold Next.js, ESLint, Prettier
- Hand-scaffolded Next.js 15.5 (App Router, React 19, TypeScript strict + `noUncheckedIndexedAccess`) and Tailwind CSS v4 via `@tailwindcss/postcss`. `create-next-app` refuses non-empty directories, so the files were written directly.
- ESLint 9 flat config extends `next/core-web-vitals` and `next/typescript`, plus `eslint-config-prettier`. Added an engine-purity rule: `src/engine/**` cannot import Next, React, Prisma, server code or Node I/O, and cannot call `Date.now` or `Math.random`.
- Decision: Next 15 rather than 16, because it is stable and still ships `eslint-config-next` for flat config.
- Tests: none yet (Vitest arrives in 0.2). `npm run lint`, `npm run typecheck` and `next build` pass.
- Dependencies: next, react, react-dom, tailwindcss, @tailwindcss/postcss, eslint, eslint-config-next, @eslint/eslintrc (FlatCompat loader for the Next config), prettier, eslint-config-prettier (stops ESLint and Prettier fighting over formatting). All are in TECHSTACK or are standard Next tooling.
- Next task: 0.2 Vitest + coverage + fast-check.

