/** Tasa vigente de ITBMS (impuesto de transferencia de bienes muebles y servicios) en Panama. */
export const ITBMS_RATE = 0.07;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type TaxableLineItem = {
  price: number;
  qty: number;
  taxExempt?: boolean;
};

/** ITBMS sobre el subtotal gravado (excluye items `taxExempt`, ej. medicamentos), aplicando el
 * mismo descuento proporcional que ya se resta del subtotal completo antes de calcular el total. */
export function computeItbms(
  lineItems: TaxableLineItem[],
  discountAmount: number,
  subtotal: number,
): number {
  const taxableSubtotal = lineItems.reduce(
    (sum, item) => (item.taxExempt ? sum : sum + item.price * item.qty),
    0,
  );
  const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;
  const taxableAfterDiscount = Math.max(0, taxableSubtotal * (1 - discountRatio));
  return roundMoney(taxableAfterDiscount * ITBMS_RATE);
}
