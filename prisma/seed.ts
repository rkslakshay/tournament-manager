/**
 * `npm run db:seed`: creates the three demo tournaments linked from the landing page and prints
 * their admin links. Safe to re-run: earlier demo copies are replaced.
 */
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/server/seed";

async function main(): Promise<void> {
  const db = new PrismaClient();
  try {
    const demos = await seedDemo(db);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    for (const demo of demos) {
      console.log(`${demo.slug}`);
      console.log(`  public: ${site}/t/${demo.slug}`);
      console.log(
        `  admin:  ${site}/t/${demo.slug}/admin?token=${encodeURIComponent(demo.adminToken)}`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
