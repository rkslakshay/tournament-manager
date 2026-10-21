// Generates prisma/postgres/schema.prisma from the SQLite development schema.
// Prisma cannot switch providers through an environment variable, so production uses a
// generated copy: same models, PostgreSQL datasource, and DIRECT_URL for migrations (Neon's
// pooled connection cannot run them). Run `npm run db:pg:schema` after editing the schema;
// a unit test fails if the copy is stale.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const SQLITE_DATASOURCE = `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`;

export const POSTGRES_DATASOURCE = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

const HEADER =
  "// GENERATED from prisma/schema.prisma by scripts/postgres-schema.mjs. Do not edit.\n\n";

/** The PostgreSQL schema text for a given SQLite schema text. */
export function toPostgresSchema(sqliteSchema) {
  if (!sqliteSchema.includes(SQLITE_DATASOURCE))
    throw new Error("Unexpected datasource block in schema.prisma");
  return HEADER + sqliteSchema.replace(SQLITE_DATASOURCE, POSTGRES_DATASOURCE);
}

// Run as a script (not when imported by the sync test).
if (process.argv[1]?.endsWith("postgres-schema.mjs")) {
  const source = readFileSync("prisma/schema.prisma", "utf8").replace(/\r\n/g, "\n");
  mkdirSync("prisma/postgres", { recursive: true });
  writeFileSync("prisma/postgres/schema.prisma", toPostgresSchema(source));
  console.log("Wrote prisma/postgres/schema.prisma");
}
