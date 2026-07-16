import { Order } from '../db/models/Order';
import { Product } from '../db/models/Product';
import { RepurchaseReminder } from '../db/models/RepurchaseReminder';
import { sendRepurchaseReminderEmail } from './email';
import { shouldSendEmail } from './notificationPreferences';
import { logger } from './logger';

/** Cuantos dias le dura en promedio a un cliente un producto de esta categoria, usado como
 * fallback cuando el producto no tiene `reorderCycleDays` propio. Criterio: consumibles de uso
 * diario (vitaminas, suplementos, fitness) duran menos que productos de uso ocasional o que no se
 * "consumen" en el mismo sentido (fragancias, maquillaje). Ajustable por el admin por producto. */
export const CATEGORY_REORDER_CYCLE_DAYS: Record<string, number> = {
  Vitaminas: 30,
  'Cuidado personal': 45,
  'Cuidado del bebé': 30,
  'Suplementos de Bienestar': 30,
  'Salud de la piel': 45,
  Fitness: 25,
  Medicamentos: 30,
  Hidratantes: 45,
  Fragancias: 90,
  Maquillaje: 60,
};

export const DEFAULT_REORDER_CYCLE_DAYS = 30;
/** Ventana de anticipacion: se manda el recordatorio si la fecha estimada de agotamiento cae
 * dentro de los proximos N dias (no antes, no despues). */
export const DEFAULT_LEAD_DAYS = 3;

export function getReorderCycleDays(product: { category?: string; reorderCycleDays?: number }): number {
  return product.reorderCycleDays ?? CATEGORY_REORDER_CYCLE_DAYS[product.category ?? ''] ?? DEFAULT_REORDER_CYCLE_DAYS;
}

type PurchaseCycleRow = {
  _id: { customerId: string; productId: string };
  customerName?: string;
  customerEmail?: string;
  productName?: string;
  lastPurchaseDate: Date;
};

/** Ultima compra pagada de cada producto, por cliente - una fila por (cliente, producto), no por
 * orden (un mismo producto comprado varias veces solo cuenta la mas reciente, que es la que
 * importa para estimar cuando se le acaba). Excluye muestras gratis (no representan un ciclo de
 * consumo real). */
async function getLastPurchaseCycles(): Promise<PurchaseCycleRow[]> {
  return Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $unwind: '$items' },
    { $match: { 'items.isSample': { $ne: true } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { customerId: '$customerId', productId: '$items.productId' },
        customerName: { $first: '$customerName' },
        customerEmail: { $first: '$customerEmail' },
        productName: { $first: '$items.productName' },
        lastPurchaseDate: { $first: '$createdAt' },
      },
    },
  ]);
}

export type RepurchaseScanResult = { scanned: number; sent: number };

/** Corre el escaneo completo: para cada (cliente, producto) con compra pagada, estima la fecha de
 * agotamiento y manda un recordatorio si cae dentro de la ventana de anticipacion y no se le mandó
 * ya uno para ese mismo ciclo de compra. La deduplicación es a nivel de base de datos (índice
 * único en RepurchaseReminder) para no depender de una consulta previa + condición de carrera. */
export async function scanAndSendRepurchaseReminders(leadDays = DEFAULT_LEAD_DAYS): Promise<RepurchaseScanResult> {
  const cycles = await getLastPurchaseCycles();
  if (!cycles.length) return { scanned: 0, sent: 0 };

  const productIds = [...new Set(cycles.map((row) => row._id.productId))];
  const products = await Product.find({ id: { $in: productIds } }).lean();
  const productById = new Map(products.map((product) => [product.id, product]));

  const now = Date.now();
  const windowEnd = now + leadDays * 24 * 60 * 60 * 1000;

  let sent = 0;
  for (const row of cycles) {
    const product = productById.get(row._id.productId);
    if (!product || product.active === false || !row.customerEmail) continue;

    const cycleDays = getReorderCycleDays(product);
    const lastPurchaseDate = new Date(row.lastPurchaseDate);
    const estimatedRunOutDate = new Date(lastPurchaseDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);
    const runOutTime = estimatedRunOutDate.getTime();
    if (runOutTime < now || runOutTime > windowEnd) continue;

    try {
      await RepurchaseReminder.create({
        customerId: row._id.customerId,
        customerEmail: row.customerEmail,
        productId: row._id.productId,
        productName: row.productName,
        lastPurchaseDate,
        estimatedRunOutDate,
        reorderCycleDays: cycleDays,
      });
    } catch (err) {
      // Duplicate key (E11000) = ya se mandó un recordatorio para este mismo ciclo de compra - no
      // es un error real, solo la dedupe haciendo su trabajo.
      if ((err as { code?: number }).code === 11000) continue;
      logger.error({ err, productId: row._id.productId, customerId: row._id.customerId }, '[REPURCHASE] Error guardando recordatorio');
      continue;
    }

    if (!(await shouldSendEmail(row._id.customerId, 'promotions'))) continue;

    try {
      await sendRepurchaseReminderEmail({
        customerName: row.customerName || 'cliente',
        customerEmail: row.customerEmail,
        productId: row._id.productId,
        productName: row.productName || 'tu producto',
      });
      sent++;
    } catch (err) {
      logger.error({ err, productId: row._id.productId, customerId: row._id.customerId }, '[REPURCHASE] Error enviando email de recordatorio');
    }
  }

  return { scanned: cycles.length, sent };
}
