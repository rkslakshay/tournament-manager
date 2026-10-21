import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = process.cwd();
const dir = path.join(root, ".tmp", "test-db");

/**
 * Set by `npm run test:pg` (scripts/test-postgres.mjs): the admin URL of a throwaway PostgreSQL
 * server. When present, every test file gets its own PostgreSQL database instead of a SQLite file.
 */
const postgresAdminUrl = process.env.TEST_POSTGRES_URL;

/** Every statement of every migration in a migrations folder, in order. */
function migrationStatements(migrationsDir: string): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .flatMap((name) =>
      readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8").split(
        /;\s*(?:\r?\n|$)/,
      ),
    )
    .map((sql) => sql.replace(/^\s*--.*$/gm, "").trim())
    .filter((sql) => sql.length > 0);
}

export interface TestDb {
  db: PrismaClient;
  cleanup: () => Promise<void>;
}

/** A fresh, migrated database (SQLite file, or PostgreSQL under `test:pg`), dropped by `cleanup`. */
export async function createTestDb(): Promise<TestDb> {
  return postgresAdminUrl ? createPostgresDb(postgresAdminUrl) : createSqliteDb();
}

async function createSqliteDb(): Promise<TestDb> {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${randomUUID()}.db`);
  const db = new PrismaClient({ datasourceUrl: `file:${file.split(path.sep).join("/")}` });
  for (const sql of migrationStatements(path.join(root, "prisma", "migrations"))) {
    await db.$executeRawUnsafe(sql);
  }
  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(file, { force: true });
      rmSync(`${file}-journal`, { force: true });
    },
  };
}

async function createPostgresDb(adminUrl: string): Promise<TestDb> {
  const name = `t_${randomUUID().replace(/-/g, "")}`;
  const admin = new PrismaClient({ datasourceUrl: adminUrl });
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = new PrismaClient({ datasourceUrl: url.toString() });
  for (const sql of migrationStatements(path.join(root, "prisma", "postgres", "migrations"))) {
    await db.$executeRawUnsafe(sql);
  }
  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    },
  };
}
