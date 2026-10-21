// Shared by `npm run screenshots` and `npm run demo-gif`: a production build of the app on its own
// port and SQLite file, with the demo tournaments seeded. `stop()` kills it and deletes the data.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * @param {{ port: number, dbName: string }} options
 * @returns {Promise<{ base: string, adminUrls: Record<string, string>, stop: () => void }>}
 */
export async function startDemoServer({ port, dbName }) {
  const base = `http://localhost:${port}`;
  const env = {
    ...process.env,
    DATABASE_URL: `file:./${dbName}`,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_PUBLIC_SITE_URL: base,
    RATE_LIMIT_CREATE_PER_HOUR: "1000",
    RATE_LIMIT_WRITES_PER_MINUTE: "10000",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const run = (command, args, options = {}) => {
    const result = spawnSync(command, args, { env, shell: true, encoding: "utf8", ...options });
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      throw new Error(`${command} ${args.join(" ")} failed`);
    }
    return result.stdout ?? "";
  };
  const cleanDb = () => {
    rmSync(`prisma/${dbName}`, { force: true });
    rmSync(`prisma/${dbName}-journal`, { force: true });
  };

  cleanDb();
  run("npx", ["prisma", "migrate", "deploy"]);
  const seedOutput = run("npx", ["tsx", "prisma/seed.ts"]);
  // Admin links are kept in memory only; they are never printed.
  const adminUrls = Object.fromEntries(
    [...seedOutput.matchAll(/^(demo-[\w-]+)\s[\s\S]*?admin:\s+(\S+)/gm)].map((m) => [m[1], m[2]]),
  );
  run("npx", ["next", "build"], { stdio: "ignore" });

  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    env,
    shell: true,
    stdio: "ignore",
  });
  const stop = () => {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      server.kill();
    }
    cleanDb();
  };
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base)).ok) return { base, adminUrls, stop };
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  stop();
  throw new Error("Server did not start");
}

/** JSON API call with an optional admin token. */
export function api(base, path, { method = "POST", body, token } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json());
}
