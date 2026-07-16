import { Schema, model } from 'mongoose';

/** Ledger de puntos del Club Healthora (HU-060) - `User.loyaltyPoints` es el saldo denormalizado
 * para lectura rapida, esta coleccion es el historial/auditoria de cada movimiento. Una orden
 * pagada genera a lo sumo una entrada 'earn' y (si redimio puntos) a lo sumo una 'redeem' - el
 * indice unico evita doble acumulacion/canje si `settleLoyaltyForOrder` (lib/loyalty.ts) se
 * llamara mas de una vez para la misma orden. */
const LoyaltyTransactionSchema = new Schema(
  {
    customerId: { type: String, required: true, index: true },
    type: { type: String, enum: ['earn', 'redeem'], required: true },
    points: { type: Number, required: true, min: 1 },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

LoyaltyTransactionSchema.index({ orderId: 1, type: 1 }, { unique: true });

export const LoyaltyTransaction = model('LoyaltyTransaction', LoyaltyTransactionSchema);
