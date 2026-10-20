/**
 * Demo data seed. Demo tournaments are added in roadmap task 6.1; until then this only
 * confirms the database is reachable.
 */
import { PrismaClient } from "@prisma/client";

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const count = await db.tournament.count();
    console.log(`Database reachable, ${count} tournament(s). Demo data arrives in task 6.1.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
