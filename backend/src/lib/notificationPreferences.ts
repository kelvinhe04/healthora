import { User } from '../db/models/User';

export type NotificationCategory = 'orderUpdates' | 'promotions';

const DEFAULT_PREFERENCES = {
  orderUpdates: true,
  promotions: true,
  unsubscribedAll: false,
};

export type NotificationPreferences = typeof DEFAULT_PREFERENCES;

/**
 * Correos transaccionales criticos (confirmacion de pedido, confirmacion de suscripcion al
 * newsletter) no pasan por aqui - siguen siempre, igual que un recibo de compra no se puede
 * "desactivar". Esto solo cubre lo que HU-058 pide poder apagar: actualizaciones de pedidos/
 * devoluciones y recordatorios/promociones.
 */
export async function shouldSendEmail(customerId: string, category: NotificationCategory): Promise<boolean> {
  const user = await User.findOne({ clerkId: customerId }).select('notificationPreferences').lean();
  const prefs = user?.notificationPreferences;
  if (!prefs) return true;
  if (prefs.unsubscribedAll) return false;
  return prefs[category] !== false;
}

export async function getNotificationPreferences(customerId: string): Promise<NotificationPreferences> {
  const user = await User.findOne({ clerkId: customerId }).select('notificationPreferences').lean();
  return { ...DEFAULT_PREFERENCES, ...(user?.notificationPreferences ?? {}) };
}
