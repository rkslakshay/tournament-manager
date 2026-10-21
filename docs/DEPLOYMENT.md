# Deployment (Vercel + Neon)

The app deploys as one Next.js project on Vercel, with PostgreSQL on Neon. Both have free tiers.
Locally everything runs on SQLite; production uses the generated PostgreSQL schema in
`prisma/postgres/` (see "Two schemas" below).

## 1. Create the database (Neon)

1. Create a Neon project and a database.
2. Copy two connection strings from the Neon dashboard:
   - **Pooled** (host contains `-pooler`): add `&pgbouncer=true`. This is `DATABASE_URL`.
   - **Direct** (no pooler). This is `DIRECT_URL`, which Prisma uses for migrations.

## 2. Create the Vercel project

1. Import the GitHub repository in Vercel. `vercel.json` sets the framework and the build command
   `npm run build:prod`, which:
   1. generates the Prisma client from `prisma/postgres/schema.prisma`,
   2. applies pending migrations (`prisma migrate deploy`, over `DIRECT_URL`),
   3. runs `next build`.
2. Set the environment variables (Production and Preview):

| Variable                       | Required    | Example / notes                                          |
| ------------------------------ | ----------- | -------------------------------------------------------- |
| `DATABASE_URL`                 | yes         | Neon pooled URL, `...?sslmode=require&pgbouncer=true`    |
| `DIRECT_URL`                   | yes         | Neon direct URL, `...?sslmode=require`                   |
| `NEXT_PUBLIC_SITE_URL`         | recommended | `https://your-app.vercel.app`, used for Open Graph links |
| `RATE_LIMIT_CREATE_PER_HOUR`   | no          | default `10` per client IP                               |
| `RATE_LIMIT_WRITES_PER_MINUTE` | no          | default `120` per client IP                              |
| `REDIS_URL`                    | recommended | Redis for cross-instance live updates, `rediss://...`    |

3. Deploy. The first build creates the tables.

## 3. Load the demo tournaments

From your machine, pointing at the production database:

```bash
DATABASE_URL="<direct url>" npx prisma generate --schema prisma/postgres/schema.prisma
DATABASE_URL="<direct url>" npm run db:seed
```

The script prints the public and admin links of `demo-league`, `demo-cup` and `demo-world-cup`.
Run `npm run db:generate` afterwards to switch your local client back to SQLite.

## Two schemas

Prisma cannot pick its database provider from an environment variable, so:

- `prisma/schema.prisma` is the source of truth (SQLite, local development and tests);
- `prisma/postgres/schema.prisma` is generated from it by `npm run db:pg:schema`;
- PostgreSQL migrations live in `prisma/postgres/migrations/`.

After changing the schema:

1. `npm run db:migrate` (creates the SQLite migration),
2. `npm run db:pg:schema`,
3. create the matching PostgreSQL migration, for example against a scratch Postgres database with
   `npx prisma migrate dev --schema prisma/postgres/schema.prisma`, or offline with
   `prisma migrate diff`.

A unit test fails if the generated schema is stale.

## Real-time across instances: set `REDIS_URL`

Live updates use Server-Sent Events fed by a pub/sub hub (`src/server/events.ts`) with two
adapters behind one interface:

- **Redis** (used when `REDIS_URL` is set, for example an Upstash or Redis Cloud URL): each
  instance subscribes to a tournament's channel while it has viewers, and every result is published
  through Redis, so viewers on any instance get it immediately. The adapter is tested against a
  shared contract suite with `ioredis-mock` (two hubs standing in for two servers); it has not yet
  been run against a live Redis server.
- **In memory** (default): correct on a single long-running server. On Vercel without Redis, an
  event published by one function instance may not reach a viewer connected to another.

Either way, streams end after `maxDuration` (60 s) and `EventSource` reconnects by itself; the client
refetches the full view on every reconnect and re-syncs every 30 seconds while connected (polling
every 10 seconds if SSE fails entirely). So **without Redis** a viewer may see a result up to about
30 seconds late on serverless hosting; **with Redis** updates arrive immediately. Public GET
responses could also be cached at the edge with a short TTL.

## Rate limiting on serverless

The rate limiter is in memory too, so on Vercel limits apply per instance (looser than configured).
For strict limits, back it with Redis (for example Upstash) or use Vercel's firewall rules.

## Checklist

- [ ] `DATABASE_URL` and `DIRECT_URL` set for Production and Preview
- [ ] `NEXT_PUBLIC_SITE_URL` set to the deployed URL
- [ ] First deploy succeeded (migrations applied)
- [ ] Demo data seeded, and `/t/demo-league` loads
- [ ] Shared a public link in a chat app to check the preview card
