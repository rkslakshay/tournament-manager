import { createTestDb, type TestDb } from "@/server/__tests__/test-db";

/**
 * Point `getDb()` at a fresh test database by filling the global client slot it reads
 * (the same slot that caches the client across hot reloads in development).
 */
export async function useApiTestDb(): Promise<TestDb> {
  const testDb = await createTestDb();
  (globalThis as { prisma?: unknown }).prisma = testDb.db;
  return {
    db: testDb.db,
    cleanup: async () => {
      delete (globalThis as { prisma?: unknown }).prisma;
      await testDb.cleanup();
    },
  };
}

type Params = Record<string, string>;

/** Route context in the shape Next.js passes to handlers. */
export function ctx<P extends Params>(params: P): { params: Promise<P> } {
  return { params: Promise.resolve(params) };
}

/** Build a request with an optional JSON body and admin token. */
export function request(
  method: string,
  options: { body?: unknown; rawBody?: string; token?: string; ip?: string } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.ip !== undefined) headers["x-forwarded-for"] = options.ip;
  const body =
    options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body));
  return new Request("http://localhost/api/test", { method, headers, body });
}
