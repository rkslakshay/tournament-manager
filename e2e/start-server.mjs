// Starts a fresh, isolated production build for the E2E suite: a new SQLite file with
// migrations applied, a separate Next build directory, and relaxed rate limits.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const port = process.argv[2] ?? "3100";
const env = {
  ...process.env,
  DATABASE_URL: "file:./e2e.db",
  NEXT_DIST_DIR: ".next-e2e",
  RATE_LIMIT_CREATE_PER_HOUR: "1000",
  RATE_LIMIT_WRITES_PER_MINUTE: "10000",
  NEXT_TELEMETRY_DISABLED: "1",
};

rmSync("prisma/e2e.db", { force: true });
rmSync("prisma/e2e.db-journal", { force: true });
const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env,
  stdio: "inherit",
  shell: true,
});
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const build = spawnSync("npx", ["next", "build"], { env, stdio: "inherit", shell: true });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn("npx", ["next", "start", "-p", port], { env, stdio: "inherit", shell: true });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => process.exit(code ?? 0));
