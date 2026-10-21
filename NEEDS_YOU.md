# Needs you

The code is published at https://github.com/rkslakshay/tournament-manager. Everything left needs
your accounts, so it could not be done automatically. Total time: about 15 minutes.

## 1. Create the database (Neon, free)
Go to https://console.neon.tech, create a project, and copy two connection strings from
**Connect**:
- **pooled**: host contains `-pooler`; add `&pgbouncer=true` at the end. This is `DATABASE_URL`.
- **direct**: pooling switched off. This is `DIRECT_URL`.

## 2. (Optional) Create Redis for instant live updates (Upstash, free)
Go to https://console.upstash.com, create a Redis database, and copy its `rediss://` URL as
`REDIS_URL`. Without it, viewers on another server instance catch up within about 30 seconds.

## 3. Deploy on Vercel
From the project folder:

```bash
npx vercel login
```

```bash
npx vercel link
```

Add the variables (paste each value when asked; repeat for `preview` if you want preview deploys):

```bash
npx vercel env add DATABASE_URL production
```

```bash
npx vercel env add DIRECT_URL production
```

```bash
npx vercel env add REDIS_URL production
```

```bash
npx vercel deploy --prod
```

The build runs the database migrations itself. Note the URL it prints.

## 4. Point the app at its own URL, and seed the demos
Use the URL from step 3 (for example `https://tournament-manager.vercel.app`):

```bash
npx vercel env add NEXT_PUBLIC_SITE_URL production
```

```bash
npx vercel deploy --prod
```

Then load the demo tournaments into the production database. In PowerShell, using the
**direct** URL from step 1:

```powershell
$env:DATABASE_URL="<direct url>"; npx prisma generate --schema prisma/postgres/schema.prisma; npx tsx prisma/seed.ts; npx prisma generate
```

## 5. Show it off
Replace "not deployed yet" at the top of `README.md` with your URL, then commit and push.
