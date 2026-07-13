import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    name: String,
    email: String,
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
