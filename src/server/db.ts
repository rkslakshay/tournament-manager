import { PrismaClient } from "@prisma/client";

/** The Prisma client, or a transaction client inside `db.$transaction`. */
export type Db = PrismaClient;
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared Prisma client. Reused across hot reloads in development so we do not exhaust
 * connections.
 */
export function getDb(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  return globalForPrisma.prisma;
}
