import type { Product } from '../types';

function scoreRelated(source: Product, candidate: Product): number {
  let score = 0;
  if (candidate.category === source.category) score += 3;
  if (candidate.need === source.need) score += 2;
  if (candidate.brand === source.brand) score += 1;
  if (candidate.tag === source.tag && candidate.tag) score += 1;
  return score;
}

export function getRelatedProducts(source: Product, catalog: Product[], limit = 4): Product[] {
  const pool = catalog.filter((p) => p.id !== source.id && p.active !== false);

  const ranked = pool
    .map((product) => ({ product, score: scoreRelated(source, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating);

  if (ranked.length >= limit) {
    return ranked.slice(0, limit).map((entry) => entry.product);
  }

  const picked = new Set(ranked.map((entry) => entry.product.id));
  const sameCategory = pool
    .filter((p) => p.category === source.category && !picked.has(p.id))
    .slice(0, limit - ranked.length);

  for (const product of sameCategory) picked.add(product.id);

  return [...ranked.map((entry) => entry.product), ...sameCategory].slice(0, limit);
}

export function getCatalogRecommendations(catalog: Product[], context?: { category?: string; need?: string }, limit = 4): Product[] {
  const pool = catalog.filter((p) => p.active !== false);
  if (pool.length === 0) return [];

  const anchor = pool.find((p) => (context?.category ? p.category === context.category : false))
    ?? pool.find((p) => (context?.need ? p.need === context.need : false))
    ?? pool[0];

  return getRelatedProducts(anchor, pool, limit);
}
