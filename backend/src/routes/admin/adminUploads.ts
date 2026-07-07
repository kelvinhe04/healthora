import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { requireAdmin } from '../../middleware/requireAdmin';
import type { AppEnv } from '../../types/hono';
import { getPublicBackendUrl } from '../../lib/appEnv';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function slugifyFolder(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'misc';
}

export const adminUploadsRouter = new Hono<AppEnv>()
  .use('*', requireAdmin)
  .post('/image', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.json({ error: 'Se espera un archivo en el campo "file"' }, 400);
    }

    const ext = ALLOWED_MIME_TO_EXT[file.type];
    if (!ext) {
      return c.json({ error: 'Formato no soportado. Usa JPEG, PNG o WEBP.' }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'La imagen no puede pesar más de 5MB.' }, 400);
    }

    const folderField = body.folder;
    const folder = slugifyFolder(typeof folderField === 'string' ? folderField : 'general');
    const filename = `${randomUUID()}.${ext}`;
    const relativePath = `products/${folder}/${filename}`;
    const diskPath = `./uploads/${relativePath}`;

    await Bun.write(diskPath, file);

    return c.json({ url: `${getPublicBackendUrl()}/uploads/${relativePath}` }, 201);
  });
