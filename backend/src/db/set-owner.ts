import { connectDB } from './connection';
import { User } from './models/User';

/**
 * One-off, manual-only script to grant the 'owner' role (HU-222) - never run automatically and
 * never exposed via any API/UI, by design (see resolveRole in clerkAuth.ts, which refuses to ever
 * downgrade an existing 'owner' back to 'admin'/'customer' on login).
 *
 * Usage: bun run set-owner -- <email>
 */
async function main() {
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error('Uso: bun run set-owner -- <email>');
    process.exit(1);
  }

  // Clerk tiene instancias separadas para dev (sk_test_/pk_test_) y produccion (sk_live_/pk_live_):
  // el mismo email crea usuarios (y clerkId) distintos en cada una. Este script escribe en la base
  // que apunte MONGODB_URI del entorno donde corre - correrlo con el .env local (dev/staging) NO
  // otorga owner en produccion. Verifica que MONGODB_URI/CLERK_SECRET_KEY sean los de produccion
  // antes de confirmar.
  await connectDB();
  console.log(`[set-owner] CLERK_SECRET_KEY: ${process.env.CLERK_SECRET_KEY?.startsWith('sk_live_') ? 'produccion (sk_live_)' : 'test/dev (sk_test_) - probablemente NO es produccion'}`);

  const user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
  if (!user) {
    console.error(`No se encontró ningún usuario con email "${email}". Debe iniciar sesión al menos una vez en ESTE entorno (mismo Clerk/DB que el conectado arriba) antes de correr este script.`);
    process.exit(1);
  }

  if (user.role === 'owner') {
    console.log(`${email} ya es owner.`);
    process.exit(0);
  }

  const previousRole = user.role;
  user.role = 'owner';
  await user.save();
  console.log(`✓ ${email} (${user.name || 'sin nombre'}) ahora es owner (antes: ${previousRole}).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[set-owner] error:', error);
  process.exit(1);
});
