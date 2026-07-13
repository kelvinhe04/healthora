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

  await connectDB();

  const user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
  if (!user) {
    console.error(`No se encontró ningún usuario con email "${email}". Debe iniciar sesión al menos una vez antes de correr este script.`);
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
