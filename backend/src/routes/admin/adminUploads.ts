import { Hono } from 'hono';
import { requireAdmin } from '../../middleware/requireAdmin';
import { auditAdminMutations } from '../../middleware/auditAdminAction';
import type { AppEnv } from '../../types/hono';
import { saveImageFile } from '../../lib/imageStorage';

export const adminUploadsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .use('*', auditAdminMutations('uploads'))
  .post('/image', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'Se espera un archivo en el campo "file"' }, 400);
    }

    const folderField = body.folder;
    const folder = typeof folderField === 'string' ? folderField : 'general';

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const url = await saveImageFile(buffer, file.type, folder);
      return c.json({ url }, 201);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Error al subir imagen' }, 400);
    }
  });
