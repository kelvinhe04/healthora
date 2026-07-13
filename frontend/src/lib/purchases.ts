// Below this many units we hide the indicator entirely - "3 compraron el ultimo mes" reads as a
// red flag (low demand), not reassurance, the same reasoning behind LOW_STOCK_DISPLAY_THRESHOLD
// in lib/stock.ts.
export const PURCHASES_LAST_MONTH_DISPLAY_THRESHOLD = 10;

/** Rounds down to a round-number range (10+, 50+, 100+, 1K+...), mirroring the Amazon-style
 * "bought in past month" indicator - never shows the exact figure. Returns null when the count
 * doesn't clear the display threshold, meaning the badge shouldn't render at all. */
export function formatPurchasesLastMonth(count: number): string | null {
  if (count < PURCHASES_LAST_MONTH_DISPLAY_THRESHOLD) return null;
  if (count >= 1000) return `${Math.floor(count / 1000)}K+`;
  if (count >= 100) return `${Math.floor(count / 100) * 100}+`;
  return `${Math.floor(count / 10) * 10}+`;
}
