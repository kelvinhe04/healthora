import { Schema, model } from 'mongoose';

const UserSchema = new Schema(
  {
    clerkId: { type: String, required: true, unique: true },
    name: String,
    email: String,
    // Snapshot del avatar de Clerk, resincronizado en cada login (ver clerkAuth.ts) - antes de
    // #314 nunca se persistia, asi que cualquier lector de este campo directo desde Mongo (en vez
    // de pedirselo a Clerk en vivo) siempre recibia undefined.
    imageUrl: { type: String, default: null },
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
        // Variante/combo elegido para esta linea (HU-035) - "primario:tamano" para un combo, id
        // simple si no. Opcional: un producto sin variantes no lo necesita.
        variantId: { type: String, default: undefined },
      },
    ],
    wishlist: [{ type: String }],
    // Preferencias de notificacion (HU-058): que categorias de correo quiere seguir recibiendo el
    // cliente, y una baja total que las anula a todas. No cubre correos transaccionales criticos
    // (confirmacion de pedido) - esos no dependen de esto, ver lib/notificationPreferences.ts.
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      unsubscribedAll: { type: Boolean, default: false },
    },
    // Saldo de puntos del Club Healthora (HU-060), denormalizado para lectura rapida - el
    // historial/auditoria vive en LoyaltyTransaction (lib/loyalty.ts es la unica fuente que lo
    // modifica, siempre junto con una entrada del ledger).
    loyaltyPoints: { type: Number, default: 0, min: 0 },
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
