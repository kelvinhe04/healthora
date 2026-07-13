import { connectDB } from './connection';
import { Order } from './models/Order';
import { Product } from './models/Product';
import { Return } from './models/Return';
import { recalculateBestsellers, recalculateNew, recalculatePurchasesLastMonth, NEW_TOP_N } from '../lib/bestsellers';
import { resolveVariantPricing, resolveVariantImage } from '../lib/productVariants';

type SeedProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
  variants?: Array<{
    id: string;
    label: string;
    type: string;
    price: number;
    stock: number;
    imageUrl?: string;
    images?: string[];
    imagesBySize?: Record<string, string[]>;
    stockBySize?: Record<string, number>;
    availableFor?: string[];
  }>;
};

/** Picks a random purchasable option for a product, the same way a shopper would on the PDP:
 * a sabor/color x tamaño combo ("primaryId:sizeId") when the product is a two-dimension matrix
 * (respecting `availableFor`), or a single variant id otherwise. Undefined for products with no
 * variants at all. */
function pickVariantId(product: SeedProduct): string | undefined {
  const variants = product.variants;
  if (!variants?.length) return undefined;

  const sizes = variants.filter((v) => v.type === 'size');
  const primaries = variants.filter((v) => v.type !== 'size');

  if (sizes.length && primaries.length) {
    const primary = randomChoice(primaries);
    const availableSizes = sizes.filter((s) => !s.availableFor || s.availableFor.includes(primary.id));
    if (!availableSizes.length) return primary.id;
    return `${primary.id}:${randomChoice(availableSizes).id}`;
  }

  return randomChoice(variants).id;
}

// Mezcla nombres hispanos comunes en Panama con apellidos afroantillanos (herencia de la
// construccion del Canal) y chino-panamenos (una de las comunidades mas grandes del pais) -
// ambos igual de representativos que los apellidos espanoles.
const NAMES = [
  'Sofia Martinez', 'Diego Hernandez', 'Valentina Garcia', 'Mateo Rodriguez', 'Camila Lopez',
  'Lucas Fernandez', 'Isabella Gonzalez', 'Santiago Perez', 'Luna Sanchez', 'Benjamin Torres',
  'Olivia Diaz', 'Lucas Ruiz', 'Emma Vargas', 'Daniel Medina', 'Maria del Rosario Jimenez',
  'Andres Castro', 'Catalina Ortiz', 'Felipe Morales', 'Antonia Romero', 'Joaquin Herrera',
  'Gabriel Ramos', 'Natalia Aguilar', 'Ricardo Mendoza', 'Karina Herrera', 'Eduardo Cruz',
  'Renata Flores', 'Oscar Ortega', 'Paula Reyes', 'Arturo Vargas', 'Diana Estrada',
  'Kevin Chen', 'Ana Wong', 'Marcus Barrow', 'Denise Grant', 'Roberto Bernard',
  'Yariela Prescott', 'Steven Chin', 'Ingrid Stephenson', 'Alvin Wu', 'Yolanda Watson',
];

// Provincias/distritos de Panama - metro de Ciudad de Panama con mas peso (donde vive la mayoria
// de la poblacion) y algunas cabeceras del interior. Los codigos postales son representativos del
// formato panameno (4 digitos), no un listado oficial exacto.
const CITIES = [
  { city: 'Ciudad de Panamá', postal: '0801' },
  { city: 'Ciudad de Panamá', postal: '0819' },
  { city: 'San Miguelito', postal: '0824' },
  { city: 'Arraiján', postal: '0508' },
  { city: 'La Chorrera', postal: '0501' },
  { city: 'Tocumen', postal: '0834' },
  { city: 'Colón', postal: '0301' },
  { city: 'David', postal: '0427' },
  { city: 'Santiago', postal: '0601' },
  { city: 'Chitré', postal: '0701' },
  { city: 'Las Tablas', postal: '0710' },
  { city: 'Penonomé', postal: '0901' },
];

const STREETS = [
  'Calle 50, Bella Vista', 'Vía España, El Cangrejo', 'Av. Balboa, Punta Pacífica',
  'Vía Israel, San Francisco', 'Av. Central, Casco Antiguo', 'Calle 74, San Francisco',
  'Vía Cincuentenario, Costa del Este', 'Av. Ricardo J. Alfaro, Betania',
  'Calle Uruguay, Bella Vista', 'Vía Brasil, Bella Vista', 'Av. Ramón Arias, El Dorado',
  'Calle Primera, Obarrio', 'Av. Domingo Díaz, Juan Díaz', 'Calle José de Fábrega, Penonomé',
  'Av. Central, David', 'Calle 3ra, Santiago',
];

const FULFILLMENT_STATUSES = ['unfulfilled', 'processing', 'shipped', 'delivered'];
// Retiro en tienda nunca pasa por "shipped", y su ultimo paso real es "picked_up" (el cliente ya
// se lo llevo) - "delivered" ahi solo significa "listo para retirar" (ver pickupFulfillmentStatusSequence).
const PICKUP_FULFILLMENT_STATUSES = ['unfulfilled', 'processing', 'delivered', 'picked_up'];
const STATUS_VALUES = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 8-digit Panama local number formatted "XXXX-XXXX", same shape as formatPanamaPhone on the
 * frontend - mobile prefixes (6xxx) since that's what most customers give at checkout. */
function randomPanamaPhone(): string {
  return `6${randomInt(100, 999)}-${String(randomInt(0, 9999)).padStart(4, '0')}`;
}

function generateOrderData(index: number, products: SeedProduct[], today: Date) {
  const orderDate = new Date(today);
  // Starts at 1, not 0 - seed data should never date an order "today", so today stays empty for
  // whatever the person testing does live instead of blending in with generated history.
  const daysAgo = randomInt(1, 180);
  orderDate.setDate(orderDate.getDate() - daysAgo);
  orderDate.setHours(randomInt(8, 20), randomInt(0, 59), randomInt(0, 59));

  const numItems = randomInt(1, 4);
  const items: { productId: string; productName: string; qty: number; price: number; imageUrl?: string; category?: string; variantId?: string; variantLabel?: string }[] = [];
  const usedProducts = new Set<string>();

  for (let i = 0; i < numItems; i++) {
    const availableProducts = products.filter(p => !usedProducts.has(p.id));
    if (availableProducts.length === 0) break;
    const product = randomChoice(availableProducts);
    usedProducts.add(product.id);
    const qty = randomInt(1, 3);
    // Pick a sabor/color x tamaño combo (or a simple variant) the same way a real shopper would,
    // and resolve its price/image with the same helpers checkout uses - so fake historical orders
    // show the actual combo "bought" instead of always the generic product price/photo.
    const variantId = pickVariantId(product);
    const resolved = resolveVariantPricing(product, variantId);
    items.push({
      productId: product.id,
      productName: resolved.label ? `${product.name} · ${resolved.label}` : product.name,
      qty,
      price: resolved.price,
      imageUrl: resolveVariantImage(product, variantId) || undefined,
      category: product.category,
      variantId,
      variantLabel: resolved.label,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = parseFloat((subtotal * 0.07).toFixed(2));

  // ~1 in 4 orders is a store pickup, matching resolveShipping's real rules: free, "Retiro en
  // tienda", ready in 24h, no delivery address needed (see orderAddressSchema).
  const shippingMethod: 'delivery' | 'pickup' = Math.random() < 0.25 ? 'pickup' : 'delivery';
  const shipping = shippingMethod === 'pickup' ? 0 : subtotal >= 50 ? 0 : 6.90;
  const shippingLabel = shippingMethod === 'pickup' ? 'Retiro en tienda' : 'Envío a domicilio';
  const shippingEta = shippingMethod === 'pickup' ? 'Listo en 24h' : '24h - 48h';
  const total = parseFloat((subtotal + tax + shipping).toFixed(2));

  const name = randomChoice(NAMES);
  const cityInfo = randomChoice(CITIES);
  const phone = randomPanamaPhone();

  const fulfillmentStatus = randomChoice(shippingMethod === 'pickup' ? PICKUP_FULFILLMENT_STATUSES : FULFILLMENT_STATUSES);
  const status = fulfillmentStatus === 'delivered' || fulfillmentStatus === 'picked_up' ? 'delivered' : fulfillmentStatus === 'processing' ? 'processing' : fulfillmentStatus === 'shipped' ? 'shipped' : 'paid';

  const customerId = `user_${String(index + 1).padStart(4, '0')}`;
  const email = `${name.toLowerCase().replace(/ /g, '.').normalize("NFD").replace(/[\u0300-\u036f]/g, "")}@email.com`;

  return {
    customerId,
    customerName: name,
    customerEmail: email,
    items,
    subtotal,
    tax,
    shipping,
    shippingMethod,
    shippingLabel,
    shippingEta,
    total,
    paymentStatus: 'paid',
    fulfillmentStatus,
    status,
    stripeSessionId: `cs_test_${Math.random().toString(36).substring(2, 18)}`,
    address: shippingMethod === 'pickup'
      ? { name, phone }
      : {
          name,
          phone,
          address: `${randomChoice(STREETS)}, Casa ${randomInt(1, 199)}`,
          city: cityInfo.city,
          postal: cityInfo.postal,
        },
    createdAt: orderDate,
    updatedAt: orderDate,
  };
}

async function seedOrders() {
  await connectDB();

  const products = (await Product.find({ price: { $gt: 0 } })
    .select('id name brand category price stock imageUrl images variants')
    .lean()) as unknown as SeedProduct[];
  
  if (products.length === 0) {
    console.error('No products found in database. Run seed first.');
    process.exit(1);
  }

  console.log(`Found ${products.length} products in database`);

  await Order.deleteMany({});
  // Every Return points back at an Order (orderId) - reseeding orders orphans any existing
  // returns (they'd reference orders that no longer exist), so they have to go together.
  await Return.deleteMany({});

  const orders = [];
  const ORDER_COUNT = 180;
  const today = new Date();

  for (let i = 0; i < ORDER_COUNT; i++) {
    orders.push(generateOrderData(i, products, today));
  }

  await Order.insertMany(orders);
  console.log(`Seeded ${ORDER_COUNT} historical orders (last 6 months with real products)`);

  // Stamp NEW_TOP_N random products with recent createdAt so recalculateNew() picks them up
  // Use the native collection to bypass Mongoose's createdAt immutability
  const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, NEW_TOP_N);
  const now = Date.now();
  for (let i = 0; i < shuffled.length; i++) {
    const daysAgo = i + 1; // 1, 2, 3, ... days ago - same "never today" rule as the orders above.
    const recentDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    await Product.collection.updateOne({ id: shuffled[i].id }, { $set: { createdAt: recentDate } });
  }
  console.log(`Stamped ${shuffled.length} products with recent dates for "Nuevo" tag`);

  console.log('Recalculating bestsellers...');
  await recalculateBestsellers();
  console.log('Recalculating new products...');
  await recalculateNew();
  console.log('Recalculating purchases in the last month...');
  await recalculatePurchasesLastMonth();
  console.log('Done.');
  process.exit(0);
}

seedOrders().catch((e) => {
  console.error(e);
  process.exit(1);
});