import { connectDB } from './connection';
import { Product } from './models/Product';
import mongoose from 'mongoose';

type Variant = {
  id: string;
  type: string;
  images?: string[];
  imageUrl?: string;
  imagesBySize?: Record<string, string[]>;
  availableFor?: string[];
};

// Backfills `imagesBySize` for sabor×tamaño combos that don't have a combo-specific override,
// using the sabor's own `images`/`imageUrl` - the exact fallback the storefront already resolves
// at read time (see resolveVariantImage / getDefaultComboImage). Purely additive: never touches a
// combo that already has its own images, only fills gaps so the admin "Combinaciones" editor shows
// what shoppers already see instead of an empty picker.
async function run() {
  const write = process.argv.includes('--write');
  await connectDB();

  const products = await Product.find({ 'variants.1': { $exists: true } }).lean();
  let productsChanged = 0;
  let combosBackfilled = 0;

  for (const product of products) {
    const variants = (product.variants ?? []) as Variant[];
    const sizes = variants.filter((v) => v.type === 'size');
    const primaries = variants.filter((v) => v.type !== 'size');
    if (!sizes.length || !primaries.length) continue;

    let changed = false;
    for (const p of primaries) {
      const fallback = p.images?.length ? p.images : p.imageUrl ? [p.imageUrl] : undefined;
      if (!fallback) continue;
      for (const s of sizes) {
        if (s.availableFor && !s.availableFor.includes(p.id)) continue;
        if (p.imagesBySize?.[s.id]?.length) continue;
        p.imagesBySize = { ...(p.imagesBySize ?? {}), [s.id]: fallback };
        changed = true;
        combosBackfilled++;
      }
    }

    if (changed) {
      productsChanged++;
      console.log(`${write ? 'Actualizando' : '[dry-run] Actualizaría'}: ${product.name}`);
      if (write) {
        await Product.updateOne({ id: product.id }, { $set: { variants } });
      }
    }
  }

  console.log(`\n${productsChanged} productos, ${combosBackfilled} combinaciones ${write ? 'actualizadas' : 'a actualizar'}.`);
  if (!write) console.log('Corre de nuevo con --write para aplicar los cambios.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
