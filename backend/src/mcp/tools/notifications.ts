import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { textField, optionalTextField } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';
import { notifyAdmins, notifyEveryone, notifyUser } from '../../lib/realtime';

export function registerNotificationTools(server: McpServer) {
  server.registerTool(
    'notifications.broadcast',
    {
      title: 'Enviar notificación en tiempo real',
      description:
        'Crea y difunde una notificación en tiempo real vía WebSockets, además de dejarla persistida en el centro de notificaciones (HU-061). ' +
        'Usa `audience` = "all" para todos los visitantes, "admins" para el equipo administrador, o "user" para un cliente concreto (requiere `userId`, el Clerk id del cliente). ' +
        'Ideal para avisos operativos, campañas o alertas manuales. Requiere rol Admin.',
      inputSchema: {
        audience: z.enum(['all', 'admins', 'user']),
        userId: optionalTextField(200),
        title: textField(120),
        body: textField(500),
        link: optionalTextField(400),
      },
    },
    async ({ audience, userId, title, body, link }) => {
      if (audience === 'user' && !userId) {
        return errorResult('Para audience "user" debes indicar `userId` (el Clerk id del cliente).');
      }

      const payload = { type: 'broadcast' as const, title, body, link: link ?? null };
      const result =
        audience === 'all'
          ? await notifyEveryone(payload)
          : audience === 'admins'
            ? await notifyAdmins(payload)
            : await notifyUser(userId!, payload);

      return jsonResult({
        audience,
        userId: audience === 'user' ? userId : null,
        deliveredSockets: result.delivered,
        notificationId: result.notification.id,
        persisted: true,
      });
    },
  );
}
