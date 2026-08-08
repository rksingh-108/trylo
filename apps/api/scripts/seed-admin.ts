/**
 * Idempotent bootstrap for the first admin account — admin accounts are not
 * self-service (no OTP signup), so someone has to create the first one.
 * Run with `pnpm --filter api seed:admin`. Reads ADMIN_EMAIL/ADMIN_PASSWORD/
 * ADMIN_NAME from the environment, falling back to dev defaults.
 */
import { db } from "../src/db";
import { hashPassword } from "../src/auth/password";

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@trylo.dev";
  const password = process.env.ADMIN_PASSWORD ?? "Admin123!";
  const name = process.env.ADMIN_NAME ?? "TRYLO Admin";

  const passwordHash = hashPassword(password);
  const admin = await db.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Admin account ready: ${admin.email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`(dev default password: ${password} — set ADMIN_PASSWORD to override)`);
  }
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
