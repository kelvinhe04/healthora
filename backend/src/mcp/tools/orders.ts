import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Order } from '../../db/models/Order';
import { buildOrdersCsv } from '../../lib/ordersCsv';
import { combineOrderStatus, normalizeOrder } from '../../lib/orderStatus';
import { sendOrderStatusUpdateEmail } from '../../lib/email';
import { shouldSendEmail } from '../../lib/notificationPreferences';
import { emailField, objectIdSchema, textField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

const paymentStatusEnum = z.enum(['pending_payment', 'paid', 'cancelled', 'refunded']);
const fulfillmentStatusEnum = z.enum(['unfulfilled', 'processing', 'shipped', 'delivered', 'picked_up', 'cancelled']);

export function registerOrderTools(server: McpServer) {
  server.registerTool(
    'orders.listUserOrders',
    {
      title: 'Historial de órdenes de un usuario',
      description:
        'Lista las órdenes de un usuario, identificado por email o customerId. Equivalente a "Mis pedidos" / la vista de un cliente en el admin (HU-009).',
      inputSchema: {
        email: emailField().optional(),
        customerId: textField(120).optional(),
        limit: z.number().int().min(1).max(50).optional().default(10),
      },
    },
    async ({ email, customerId, limit }) => {
      if (!email && !customerId) return errorResult('Debe indicar email o customerId.');

      const filter: Record<string, unknown> = {};
      if (email) filter.customerEmail = email;
      if (customerId) filter.customerId = customerId;

      const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      return jsonResult({ count: orders.length, orders: orders.map((o) => normalizeOrder(o)) });
    },
  );

  server.registerTool(
    'orders.updateOrderStatus',
    {
      title: 'Actualizar estado de una orden',
      description:
        'Actualiza el estado de pago y/o de cumplimiento de una orden (envía el email de actualización al cliente si cambia el fulfillment). Requiere rol Admin. Equivalente a la sección Pedidos del admin (HU-018).',
      inputSchema: {
        orderId: objectIdSchema,
        paymentStatus: paymentStatusEnum.optional(),
        fulfillmentStatus: fulfillmentStatusEnum.optional(),
      },
    },
    async ({ orderId, paymentStatus, fulfillmentStatus }) => {
      if (!paymentStatus && !fulfillmentStatus) return errorResult('Debe indicar paymentStatus o fulfillmentStatus.');

      const currentOrder = await Order.findById(orderId).lean();
      if (!currentOrder) return errorResult(`Orden "${orderId}" no encontrada.`);
      const normalizedCurrent = normalizeOrder(currentOrder);

      const nextPaymentStatus = paymentStatus || normalizedCurrent.paymentStatus;
      const nextFulfillmentStatus = fulfillmentStatus || normalizedCurrent.fulfillmentStatus;
      const status = combineOrderStatus(nextPaymentStatus, nextFulfillmentStatus);

      const order = await Order.findByIdAndUpdate(
        orderId,
        { paymentStatus: nextPaymentStatus, fulfillmentStatus: nextFulfillmentStatus, status },
        { returnDocument: 'after' },
      ).lean();
      if (!order) return errorResult(`Orden "${orderId}" no encontrada.`);

      if (
        normalizedCurrent.fulfillmentStatus !== nextFulfillmentStatus &&
        order.customerEmail &&
        (await shouldSendEmail(order.customerId, 'orderUpdates'))
      ) {
        try {
          await sendOrderStatusUpdateEmail({
            customerName: order.customerName || 'cliente',
            customerEmail: order.customerEmail,
            orderId: order._id.toString(),
            fulfillmentStatus: nextFulfillmentStatus,
            items: order.items || [],
            total: order.total || 0,
            address: order.address,
          });
        } catch (emailError) {
          console.error('[MCP] Failed to send status update email:', emailError);
        }
      }

      return jsonResult(normalizeOrder(order));
    },
  );

  server.registerTool(
    'orders.getOrderItems',
    {
      title: 'Ítems de una orden',
      description:
        'Devuelve los ítems de una orden con su variante/combo comprado (variantId, variantLabel, precio, imagen). Requiere rol Admin. Equivalente al detalle de una orden en el admin (HU-036).',
      inputSchema: {
        orderId: objectIdSchema,
      },
    },
    async ({ orderId }) => {
      const order = await Order.findById(orderId).lean();
      if (!order) return errorResult(`Orden "${orderId}" no encontrada.`);
      return jsonResult({ orderId, customerName: order.customerName, items: order.items });
    },
  );

  server.registerTool(
    'orders.exportOrdersCsv',
    {
      title: 'Exportar pedidos a CSV',
      description:
        'Exporta pedidos a formato CSV con filtros opcionales de pago y cumplimiento. Equivalente al botón "Exportar CSV" en Pedidos del admin.',
      inputSchema: {
        paymentStatus: paymentStatusEnum.optional(),
        fulfillmentStatus: fulfillmentStatusEnum.optional(),
        limit: z.number().int().min(1).max(2000).optional().default(500),
      },
    },
    async ({ paymentStatus, fulfillmentStatus, limit }) => {
      const csv = await buildOrdersCsv({ paymentStatus, fulfillmentStatus, limit });
      return jsonResult({ format: 'csv', rowCount: Math.max(0, csv.split('\n').length - 1), csv });
    },
  );
}
