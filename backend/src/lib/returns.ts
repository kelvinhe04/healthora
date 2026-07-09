export const RETURN_WINDOW_DAYS = 30;

export function isWithinReturnWindow(order: { createdAt: Date | string }, now: Date = new Date()): boolean {
  const orderDate = new Date(order.createdAt);
  const diffDays = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= RETURN_WINDOW_DAYS;
}
