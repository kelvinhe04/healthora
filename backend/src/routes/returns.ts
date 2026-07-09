import { Hono } from 'hono';
import { z } from 'zod';
import { clerkAuth } from '../middleware/clerkAuth';
import type { AppEnv } from '../types/hono';
import { Order } from '../db/models/Order';
import { Return } from '../db/models/Return';
import { objectIdSchema, parseJson, productIdSchema, textField } from '../lib/validation';
import { isWithinReturnWindow } from '../lib/returns';
import { sendReturnStatusEmail } from '../lib/email';

const returnItemSchema = z.object({
  productId: productIdSchema,
  qty: z.coerce.number().int().min(1).max(999),
});

const createReturnSchema = z.object({
  orderId: objectIdSchema,
  reason: textField(1000),
  items: z.array(returnItemSchema).min(1).max(100),
});

export const returnsRouter = new Hono<AppEnv>()
  .use('*', clerkAuth)
  .get('/', async (c) => {
    const user = c.get('user');
    const returns = await Return.find({ customerId: user.clerkId }).sort({ createdAt: -1 }).lean();
    return c.json(returns);
  })
  .post('/', async (c) => {
    const user = c.get('user');
    const parsed = await parseJson(c, createReturnSchema);
    if (!parsed.success) return parsed.response;

    const { orderId, reason, items } = parsed.data;
    const order = await Order.findOne({ _id: orderId, customerId: user.clerkId }).lean();
    if (!order) return c.json({ error: 'Orden no encontrada' }, 404);
    if (order.paymentStatus !== 'paid') {
      return c.json({ error: 'Solo se pueden devolver órdenes pagadas' }, 400);
    }
    if (!isWithinReturnWindow(order)) {
      return c.json({ error: 'La ventana para solicitar una devolución de este pedido ya venció' }, 400);
    }

    const existing = await Return.findOne({ orderId, status: { $nin: ['rejected'] } }).lean();
    if (existing) {
      return c.json({ error: 'Ya existe una solicitud de devolución para esta orden' }, 409);
    }

    const orderItems = order.items as Array<{ productId: string; productName: string; qty: number; price: number }>;
    let refundAmount = 0;
    let resolvedItems: { productId: string; productName: string; qty: number }[];
    try {
      resolvedItems = items.map((item) => {
        const orderItem = orderItems.find((oi) => oi.productId === item.productId);
        if (!orderItem) throw new Error(`El producto ${item.productId} no pertenece a esta orden`);
        if (item.qty > orderItem.qty) throw new Error(`Cantidad invalida para ${orderItem.productName}`);
        refundAmount += orderItem.price * item.qty;
        return { productId: item.productId, productName: orderItem.productName, qty: item.qty };
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Items invalidos' }, 400);
    }

    const returnDoc = await Return.create({
      orderId,
      customerId: user.clerkId,
      customerName: user.name,
      customerEmail: user.email,
      reason,
      items: resolvedItems,
      refundAmount: Math.round(refundAmount * 100) / 100,
      status: 'requested',
    });

    sendReturnStatusEmail({
      customerName: user.name || 'cliente',
      customerEmail: user.email || '',
      orderId: String(orderId),
      status: 'requested',
      refundAmount: returnDoc.refundAmount,
    }).catch((err) => console.error('[RETURNS] Failed to send requested email:', err));

    return c.json(returnDoc.toObject(), 201);
  });
