/** Espejo de backend/src/lib/loyalty.ts#computeRedeemablePoints - mismo calculo en cliente
 * (preview del checkout) y servidor (canje real). Canje todo-o-nada, capado por el saldo
 * disponible y por lo que quede del subtotal despues del cupon. */
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
