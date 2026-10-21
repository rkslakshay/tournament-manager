import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toPostgresSchema } from "../../../scripts/postgres-schema.mjs";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("production PostgreSQL schema", () => {
  it("is up to date with the SQLite development schema (run `npm run db:pg:schema`)", () => {
    expect(read("prisma/postgres/schema.prisma")).toBe(
      toPostgresSchema(read("prisma/schema.prisma")),
    );
  });

  it("has a migration creating every model", () => {
    const models = [...read("prisma/schema.prisma").matchAll(/^model (\w+) \{/gm)].map((m) => m[1]);
    const migration = read("prisma/postgres/migrations/20261021000000_init/migration.sql");
    expect(models.length).toBeGreaterThan(0);
    for (const model of models) expect(migration).toContain(`CREATE TABLE "${model}"`);
  });

  it("refuses an unexpected datasource", () => {
    expect(() => toPostgresSchema("datasource db {}")).toThrow(/Unexpected datasource/);
  });
});
