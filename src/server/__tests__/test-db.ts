import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const root = process.cwd();
const dir = path.join(root, ".tmp", "test-db");

/** Every statement of every migration, in order. */
function migrationStatements(): string[] {
  const migrations = path.join(root, "prisma", "migrations");
  return readdirSync(migrations, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .flatMap((name) =>
      readFileSync(path.join(migrations, name, "migration.sql"), "utf8").split(/;\s*(?:\r?\n|$)/),
    )
    .map((sql) => sql.replace(/^\s*--.*$/gm, "").trim())
    .filter((sql) => sql.length > 0);
}

export interface TestDb {
  db: PrismaClient;
  cleanup: () => Promise<void>;
}

/** A fresh, migrated SQLite database in `.tmp/test-db`, deleted by `cleanup`. */
export async function createTestDb(): Promise<TestDb> {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${randomUUID()}.db`);
  const db = new PrismaClient({ datasourceUrl: `file:${file.split(path.sep).join("/")}` });
  for (const sql of migrationStatements()) await db.$executeRawUnsafe(sql);
  return {
    db,
    cleanup: async () => {
      await db.$disconnect();
      rmSync(file, { force: true });
      rmSync(`${file}-journal`, { force: true });
    },
  };
}
