import { connectDB } from './connection';
import { Order } from './models/Order';

const SEED_PRODUCTS = [
  { productId: 'nars-radiant-creamy-concealer', name: 'Radiant Creamy Concealer - Vanilla', brand: 'NARS', category: 'Maquillaje', price: 25.22 },
  { productId: 'cerave-moisturizing-cream', name: 'Moisturizing Cream 340 g', brand: 'CeraVe', category: 'Skincare', price: 16.99 },
];

const NAMES = [
  'Sofia Martinez', 'Diego Hernandez', 'Valentina Garcia', 'Mateo Rodriguez', 'Camila Lopez',
  'Lucas Fernandez', 'Isabella Gonzalez', 'Santiago Perez', 'Luna Sanchez', 'Benjamin Torres',
  'Olivia Diaz', 'Lucas Ruiz', 'Emma Vargas', 'Daniel Medina', 'Maria del Rosario Jimenez',
  'Andres Castro', 'Catalina Ortiz', 'Felipe Morales', 'Antonia Romero', 'Joaquin Herrera',
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
];

const STREETS = [
  'Av. Insurgentes Sur 1234', 'Av. Paulista 567', 'Av. 9 de Julio 890', 'Av. Reforma 234',
  'Calle Mayor 345', 'Av. Libertadores 678', 'Calle Principal 901', 'Av. del Parque 234',
  'Blvd. del Sol 567', 'Av. del Centro 890',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function generateOrderData(index) {
  const orderDate = new Date();
  orderDate.setDate(orderDate.getDate() - index);
  orderDate.setHours(8, randomInt(0, 59), randomInt(0, 59));

  const qty = 1;
  const items = SEED_PRODUCTS.map(p => ({
    productId: p.productId,
    productName: p.name,
    qty,
    price: p.price,
  }));

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = parseFloat((subtotal * 0.16).toFixed(2));
  const shipping = subtotal > 500 ? 0 : 99;
  const total = parseFloat((subtotal + tax + shipping).toFixed(2));

  const name = randomChoice(NAMES);
  const cityInfo = randomChoice(CITIES);

  const paymentStatus = 'paid';
  const fulfillmentStatus = 'delivered';

  const customerId = `user_${String(index + 1).padStart(4, '0')}`;
  const email = `${name.toLowerCase().replace(' ', '.').replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u')}@email.com`;

  return {
    customerId,
    customerName: name,
    customerEmail: email,
    items,
    subtotal: subtotal,
    tax,
    shipping,
    total,
    paymentStatus,
    fulfillmentStatus,
    status: 'delivered',
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
  await Order.deleteMany({});

  const orders = [];
  const ORDER_COUNT = 30;

  for (let i = 0; i < ORDER_COUNT; i++) {
    orders.push(generateOrderData(i));
  }

  await Order.insertMany(orders);

  console.log(`Seeded ${ORDER_COUNT} historical orders`);
  process.exit(0);
}

seedOrders().catch((e) => {
  console.error(e);
  process.exit(1);
});