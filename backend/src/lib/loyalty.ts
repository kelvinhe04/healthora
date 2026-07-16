import { User } from '../db/models/User';
import { LoyaltyTransaction } from '../db/models/LoyaltyTransaction';
import { getSettings } from '../db/models/Settings';

type OrderForLoyalty = {
  _id: unknown;
  customerId: string;
  loyaltyPointsRedeemed?: number;
  loyaltyPointsEarned?: number;
};

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 11000;
}

/** Los 2 documentos de Settings creados antes de agregar estos campos no los tienen guardados
 * (`setDefaultsOnInsert` solo aplica al crear, no a un documento ya existente) - mismo criterio de
 * fallback que `Product.lowStockThreshold ?? global` (HU-055). */
export function getLoyaltyRates(settings: { loyaltyPointsPerDollar?: number; loyaltyPointValueCents?: number }) {
  return {
    pointsPerDollar: settings.loyaltyPointsPerDollar ?? 1,
    pointValueCents: settings.loyaltyPointValueCents ?? 1,
  };
}

export function computePointsEarned(total: number, pointsPerDollar: number): number {
  return Math.max(0, Math.floor(total * pointsPerDollar));
}

/**
 * Canje todo-o-nada (issue simplifica el UX a un solo checkbox "usar mis puntos" en vez de un
 * input parcial): redime el maximo posible del saldo disponible, capado para no dejar el pedido
 * en negativo. Trabaja en centavos para no arrastrar redondeos de punto flotante.
 */
export function computeRedeemablePoints(opts: {
  availablePoints: number;
  maxDiscountCents: number;
  pointValueCents: number;
}): { pointsToRedeem: number; discountCents: number } {
  const { availablePoints, maxDiscountCents, pointValueCents } = opts;
  if (availablePoints <= 0 || maxDiscountCents <= 0 || pointValueCents <= 0) {
    return { pointsToRedeem: 0, discountCents: 0 };
  }

  const balanceValueCents = availablePoints * pointValueCents;
  const discountCents = Math.min(balanceValueCents, maxDiscountCents);
  const pointsToRedeem = Math.min(availablePoints, Math.ceil(discountCents / pointValueCents));
  return { pointsToRedeem, discountCents };
}

/**
 * Liquida los puntos de una orden ya creada/pagada: descuenta lo canjeado (si hubo) y acredita lo
 * ganado, cada uno con su entrada en el ledger `LoyaltyTransaction`. Se llama una sola vez por
 * orden (createPaidOrder / createSubscriptionOrder) - el indice unico `{orderId, type}` es la red
 * de seguridad si de todas formas se llamara dos veces. No revierte puntos en devoluciones/
 * reembolsos (fuera de alcance de HU-060, ver seguimiento-hu.md).
 */
export async function settleLoyaltyForOrder(order: OrderForLoyalty): Promise<void> {
  const orderId = order._id;
  const { customerId } = order;

  // Chequeo previo (no atomico bajo concurrencia real, pero esta funcion solo se llama una vez por
  // orden, sincronicamente, justo despues de crearla - nunca en paralelo para la misma orden) para
  // no descontar/acreditar el saldo dos veces si se llamara de nuevo para la misma orden. El
  // indice unico de LoyaltyTransaction sigue siendo la red de seguridad final.
  const existingTypes = new Set(
    (await LoyaltyTransaction.find({ orderId }).select('type').lean()).map((t) => t.type),
  );

  const pointsRedeemed = order.loyaltyPointsRedeemed ?? 0;
  if (pointsRedeemed > 0 && !existingTypes.has('redeem')) {
    const afterRedeem = await User.findOneAndUpdate(
      { clerkId: customerId, loyaltyPoints: { $gte: pointsRedeemed } },
      { $inc: { loyaltyPoints: -pointsRedeemed } },
      { returnDocument: 'after' },
    ).lean();

    if (!afterRedeem) {
      // El saldo cambio entre que se armo el checkout (el descuento ya se le cobro de menos al
      // cliente) y que la orden se confirma como pagada - caso extremo, ya que en la practica un
      // cliente no tiene dos checkouts canjeando puntos a la vez. Se deja constancia en logs en
      // vez de fallar la creacion de la orden por esto.
      console.error('[LOYALTY] No se pudo descontar el canje (saldo insuficiente al liquidar):', { customerId, orderId, pointsRedeemed });
    } else {
      try {
        await LoyaltyTransaction.create({
          customerId,
          type: 'redeem',
          points: pointsRedeemed,
          orderId,
          balanceAfter: afterRedeem.loyaltyPoints,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
  }

  const pointsEarned = order.loyaltyPointsEarned ?? 0;
  if (pointsEarned > 0 && !existingTypes.has('earn')) {
    const afterEarn = await User.findOneAndUpdate(
      { clerkId: customerId },
      { $inc: { loyaltyPoints: pointsEarned } },
      { returnDocument: 'after' },
    ).lean();

    if (afterEarn) {
      try {
        await LoyaltyTransaction.create({
          customerId,
          type: 'earn',
          points: pointsEarned,
          orderId,
          balanceAfter: afterEarn.loyaltyPoints,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
      }
    }
  }
}

export async function getLoyaltyAccount(customerId: string) {
  const [user, settings, transactions] = await Promise.all([
    User.findOne({ clerkId: customerId }).select('loyaltyPoints').lean(),
    getSettings(),
    LoyaltyTransaction.find({ customerId }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  return {
    balance: user?.loyaltyPoints ?? 0,
    ...getLoyaltyRates(settings),
    transactions: transactions.map((t) => ({
      type: t.type as 'earn' | 'redeem',
      points: t.points,
      orderId: String(t.orderId),
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt,
    })),
  };
}
