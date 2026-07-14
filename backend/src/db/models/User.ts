import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    // Un solo Stripe Customer por usuario, creado la primera vez que hace falta (agregar una
    // tarjeta guardada, pagar, o suscribirse a reposición automática, HU-101) - ver
    // lib/stripeCustomer.ts. No se crea al registrarse.
    stripeCustomerId: { type: String, default: null },
    // 'owner' es un tercer nivel por encima de 'admin' (admin supremo, HU-222): una sola cuenta,
    // no asignable desde la UI/API (ver rolePayloadSchema en adminUsers.ts) - solo por acceso
    // directo a la base de datos (bun run set-owner). Nunca se degrada automaticamente aunque
    // Clerk/ADMIN_EMAILS diga otra cosa (ver resolveRole en clerkAuth.ts).
    role: { type: String, enum: ['customer', 'admin', 'owner'], default: 'customer' },
    cart: [
      {
        productId: { type: String, required: true },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    wishlist: [{ type: String }],
    addresses: [
      {
        label: { type: String, default: '' },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        postal: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

export const User = model('User', UserSchema);
