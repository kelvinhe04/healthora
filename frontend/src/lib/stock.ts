// Below this many units we show the exact count as an urgency cue ("Solo quedan 4"); above it we
// just say "En stock" - showing the real number for large quantities reads as odd/untrustworthy
// and isn't something real ecommerce sites do.
export const LOW_STOCK_DISPLAY_THRESHOLD = 10;

export function isLowStock(stock: number, threshold = LOW_STOCK_DISPLAY_THRESHOLD): boolean {
  return stock > 0 && stock <= threshold;
}
