type PromotionProduct = {
  category: string;
  price: number;
};

type PromotionItem = {
  product: PromotionProduct;
  qty: number;
};

export type PromotionResult = {
  code: string;
  label: string;
  discountAmount: number;
};

const PROMOTIONS = {
  BIENVENIDA: {
    label: '15% nuevos clientes',
    percent: 0.15,
    eligibleCategories: null,
    expiresAt: null,
  },
  PIEL25: {
    label: '25% rutina skincare',
    percent: 0.25,
    eligibleCategories: ['Salud de la piel', 'Hidratantes'],
    expiresAt: '2026-05-30T23:59:59Z',
  },
} as const;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizePromotionCode(code: string): string {
  return code.trim().toUpperCase();
}

export function getPromotion(code: string, items: PromotionItem[]): PromotionResult | null {
  const normalizedCode = normalizePromotionCode(code);
  const promotion = PROMOTIONS[normalizedCode as keyof typeof PROMOTIONS];
  if (!promotion) return null;

  if (promotion.expiresAt && new Date() > new Date(promotion.expiresAt)) {
    return null;
  }

  const eligibleSubtotal = items.reduce((sum, item) => {
    const eligibleCategories = promotion.eligibleCategories as readonly string[] | null;
    const isEligible = !eligibleCategories || eligibleCategories.includes(item.product.category);
    return isEligible ? sum + item.product.price * item.qty : sum;
  }, 0);

  const discountAmount = roundMoney(eligibleSubtotal * promotion.percent);
  if (discountAmount <= 0) return null;

  return {
    code: normalizedCode,
    label: promotion.label,
    discountAmount,
  };
}

export function canApplyPromotion(code: string, items: PromotionItem[]): boolean {
  return getPromotion(code, items) !== null;
}

export function getAvailablePromotionCodes(): string[] {
  return Object.keys(PROMOTIONS);
}
