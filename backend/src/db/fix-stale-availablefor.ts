import { connectDB } from './connection';
import { Product } from './models/Product';
import mongoose from 'mongoose';

// Before `default: undefined` was added to the `availableFor` schema path (see
// backend/src/db/models/Product.ts), Mongoose auto-defaulted the array to `[]` on any variant
// that didn't set it explicitly - which is nearly every tamaño, since seed.ts only sets
// `availableFor` on the few tamaños that ARE restricted to specific sabores. sizesFor/
// composeFromMatrix correctly distinguish "missing" (available for everyone) from "explicit []"
// (available for no one) - so those stale, pre-fix `[]` values now read as "this tamaño is
// active for zero sabores", breaking the variant picker for any combo affected. This unsets the
// field wherever it's an empty array on a size variant, restoring "no restriction". Purely
// corrective: never touches a size that has a real (non-empty) `availableFor` list.
async function run() {
  const write = process.argv.includes('--write');
  await connectDB();

  const products = await Product.find({ 'variants.type': 'size' }).select('id name variants').lean();
  let productsChanged = 0;
  let sizesFixed = 0;

  for (const product of products) {
    const variants = product.variants ?? [];
    let changed = false;
    for (const v of variants) {
      if (v.type === 'size' && Array.isArray(v.availableFor) && v.availableFor.length === 0) {
        delete v.availableFor;
        changed = true;
        sizesFixed++;
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

  console.log(`\n${productsChanged} productos, ${sizesFixed} tamaños ${write ? 'corregidos' : 'a corregir'}.`);
  if (!write) console.log('Corre de nuevo con --write para aplicar los cambios.');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
