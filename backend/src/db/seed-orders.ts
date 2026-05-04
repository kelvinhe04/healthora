import { connectDB } from './connection';
import { Order } from './models/Order';
import { Product } from './models/Product';
import { recalculateBestsellers, recalculateNew } from '../lib/bestsellers';

const NAMES = [
  'Sofia Martinez', 'Diego Hernandez', 'Valentina Garcia', 'Mateo Rodriguez', 'Camila Lopez',
  'Lucas Fernandez', 'Isabella Gonzalez', 'Santiago Perez', 'Luna Sanchez', 'Benjamin Torres',
  'Olivia Diaz', 'Lucas Ruiz', 'Emma Vargas', 'Daniel Medina', 'Maria del Rosario Jimenez',
  'Andres Castro', 'Catalina Ortiz', 'Felipe Morales', 'Antonia Romero', 'Joaquin Herrera',
  'Gabriel Ramos', 'Natalia Aguilar', 'Ricardo Mendoza', 'Karina Herrera', 'Eduardo Cruz',
  'Renata Flores', 'Oscar Ortega', 'Paula Reyes', 'Arturo Vargas', 'Diana Estrada',
];

const CITIES = [
  { city: 'Ciudad de México', postal: '06600' },
  { city: 'Guadalajara', postal: '44100' },
  { city: 'Monterrey', postal: '64000' },
  { city: 'Puebla', postal: '72000' },
  { city: 'Tijuana', postal: '22000' },
  { city: 'León', postal: '37000' },
  { city: 'Juárez', postal: '32000' },
  { city: 'Zapopan', postal: '45100' },
  { city: 'Mérida', postal: '97000' },
  { city: 'San Luis Potosí', postal: '78000' },
  { city: 'Querétaro', postal: '76000' },
  { city: 'Aguascalientes', postal: '20000' },
];

const STREETS = [
  'Av. Insurgentes Sur 1234', 'Av. Paulista 567', 'Av. 9 de Julio 890', 'Av. Reforma 234',
  'Calle Mayor 345', 'Av. Libertadores 678', 'Calle Principal 901', 'Av. del Parque 234',
  'Blvd. del Sol 567', 'Av. del Centro 890', 'Calle Granada 123', 'Av.',
];

const FULFILLMENT_STATUSES = ['unfulfilled', 'processing', 'shipped', 'delivered'];
const STATUS_VALUES = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOrderData(index: number, products: { id: string; name: string; brand: string; category: string; price: number }[], today: Date) {
  const orderDate = new Date(today);
  const daysAgo = randomInt(0, 180);
  orderDate.setDate(orderDate.getDate() - daysAgo);
  orderDate.setHours(randomInt(8, 20), randomInt(0, 59), randomInt(0, 59));

  const numItems = randomInt(1, 4);
  const items: { productId: string; productName: string; qty: number; price: number; imageUrl?: string; category?: string }[] = [];
  const usedProducts = new Set<string>();

  for (let i = 0; i < numItems; i++) {
    const availableProducts = products.filter(p => !usedProducts.has(p.id));
    if (availableProducts.length === 0) break;
    const product = randomChoice(availableProducts);
    usedProducts.add(product.id);
    const qty = randomInt(1, 3);
    items.push({
      productId: product.id,
      productName: product.name,
      qty,
      price: product.price,
      category: product.category,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = parseFloat((subtotal * 0.07).toFixed(2));
  const shipping = subtotal >= 50 ? 0 : 6.90;
  const total = parseFloat((subtotal + tax + shipping).toFixed(2));

  const name = randomChoice(NAMES);
  const cityInfo = randomChoice(CITIES);

  const fulfillmentStatus = randomChoice(FULFILLMENT_STATUSES);
  const status = fulfillmentStatus === 'delivered' ? 'delivered' : fulfillmentStatus === 'processing' ? 'processing' : fulfillmentStatus === 'shipped' ? 'shipped' : 'paid';

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
    total,
    paymentStatus: 'paid',
    fulfillmentStatus,
    status,
    stripeSessionId: `cs_test_${Math.random().toString(36).substring(2, 18)}`,
    address: {
      name: name,
      phone: `+52 55 ${randomInt(1000, 9999)} ${randomInt(1000, 9999)}`,
      address: `${randomChoice(STREETS)}, ${randomInt(1, 999)}`,
      city: cityInfo.city,
      postal: cityInfo.postal,
    },
    createdAt: orderDate,
    updatedAt: orderDate,
  };
}

async function seedOrders() {
  await connectDB();

  const products = await Product.find({ price: { $gt: 0 } }).select('id name brand category price').lean();
  
  if (products.length === 0) {
    console.error('No products found in database. Run seed first.');
    process.exit(1);
  }

  console.log(`Found ${products.length} products in database`);

  await Order.deleteMany({});

  const orders = [];
  const ORDER_COUNT = 180;
  const today = new Date();

  for (let i = 0; i < ORDER_COUNT; i++) {
    orders.push(generateOrderData(i, products, today));
  }

  await Order.insertMany(orders);
  console.log(`Seeded ${ORDER_COUNT} historical orders (last 6 months with real products)`);

  // Stamp 4 random products with recent createdAt so recalculateNew() picks them up
  // Use the native collection to bypass Mongoose's createdAt immutability
  const shuffled = [...products].sort(() => Math.random() - 0.5).slice(0, 4);
  const now = Date.now();
  for (let i = 0; i < shuffled.length; i++) {
    const daysAgo = i; // 0, 1, 2, 3 days ago
    const recentDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    await Product.collection.updateOne({ id: shuffled[i].id }, { $set: { createdAt: recentDate } });
  }
  console.log(`Stamped ${shuffled.length} products with recent dates for "Nuevo" tag`);

  console.log('Recalculating bestsellers...');
  await recalculateBestsellers();
  console.log('Recalculating new products...');
  await recalculateNew();
  console.log('Done.');
  process.exit(0);
}

seedOrders().catch((e) => {
  console.error(e);
  process.exit(1);
});