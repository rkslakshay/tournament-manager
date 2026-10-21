// `npm run test:pg`: runs the server integration tests against a real PostgreSQL server.
//
// 1. Starts a throwaway PostgreSQL (embedded-postgres, real binaries) on a free local port with a
//    random password, in .tmp/pg-data.
// 2. Generates the Prisma client from prisma/postgres/schema.prisma.
// 3. Runs `prisma migrate deploy` for real against an empty database.
// 4. Runs the database-backed test suites with TEST_POSTGRES_URL set, so each test file gets its
//    own PostgreSQL database built from the production migrations.
// 5. Always: stops PostgreSQL, deletes its data and regenerates the SQLite client for development.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { rmSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const port = Number(process.env.TEST_PG_PORT ?? 54329);
const password = randomBytes(16).toString("hex");
const dataDir = ".tmp/pg-data";
const base = `postgresql://postgres:${password}@localhost:${port}`;

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  return result.status ?? 1;
}

rmSync(dataDir, { recursive: true, force: true });
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password,
  port,
  persistent: false,
  onLog: () => {},
});

let status = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("migrate_check");
  const pgEnv = { DATABASE_URL: `${base}/migrate_check`, DIRECT_URL: `${base}/migrate_check` };

  status = run("npx", ["prisma", "generate", "--schema", "prisma/postgres/schema.prisma"], pgEnv);
  if (status === 0) {
    status = run(
      "npx",
      ["prisma", "migrate", "deploy", "--schema", "prisma/postgres/schema.prisma"],
      pgEnv,
    );
  }
  if (status === 0) {
    status = run("npx", ["vitest", "run", "src/server"], {
      ...pgEnv,
      TEST_POSTGRES_URL: `${base}/postgres`,
    });
  }
} catch (error) {
  console.error(error);
  status = 1;
} finally {
  await pg.stop().catch(() => {});
  rmSync(dataDir, { recursive: true, force: true });
  run("npx", ["prisma", "generate"]);
}
process.exit(status);
