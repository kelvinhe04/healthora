import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { User } from '../../db/models/User';
import { clerk } from '../../lib/clerk';
import { emailField, objectIdSchema } from '../../lib/validation';
import { errorResult, jsonResult } from '../toolHelpers';

export function registerUserTools(server: McpServer) {
  server.registerTool(
    'users.updateUserRole',
    {
      title: 'Promover o degradar un usuario',
      description:
        'Cambia el rol de un usuario (customer/admin), identificado por userId (Mongo _id) o email, y sincroniza el rol con Clerk. Requiere rol Admin. Equivalente a la sección Usuarios del admin (HU-017).',
      inputSchema: {
        userId: objectIdSchema.optional(),
        email: emailField().optional(),
        role: z.enum(['customer', 'admin']),
      },
    },
    async ({ userId, email, role }) => {
      if (!userId && !email) return errorResult('Debe indicar userId o email.');

      const user = userId ? await User.findById(userId) : await User.findOne({ email });
      if (!user) return errorResult('Usuario no encontrado.');

      const previousRole = user.role;
      user.role = role;
      await user.save();

      try {
        const clerkUser = await clerk.users.getUser(user.clerkId);
        await clerk.users.updateUserMetadata(user.clerkId, {
          publicMetadata: { ...clerkUser.publicMetadata, role },
        });
      } catch (error) {
        console.error('[MCP] Failed to sync Clerk role:', error);
      }

      return jsonResult({ userId: user._id, email: user.email, previousRole, role });
    },
  );
}
