import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { AppError } from '../errors/app-error';

const GENERATED_DIR = path.resolve(__dirname, '../../assets/generated');

// Só o que a Meta/TikTok conseguem consumir por PULL_FROM_URL.
const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

const MAX_BYTES = 64 * 1024 * 1024; // 64 MB

function safeName(raw: string | undefined, ext: string): string {
  const base = raw ? path.basename(raw).replace(/[^A-Za-z0-9._-]/g, '-') : '';
  if (base && path.extname(base).toLowerCase() === ext) return base;
  if (base) return `${base.replace(/\.[^.]*$/, '')}${ext}`;
  return `${randomUUID()}${ext}`;
}

class AssetUploadService {
  /**
   * Persist an uploaded image/video into `assets/generated/` so it can be
   * referenced by `imageFileName` / `videoFileName` (or served directly) and
   * pulled by the Instagram/TikTok APIs.
   */
  public async save(
    buffer: unknown,
    contentType: string | undefined,
    name?: string,
  ): Promise<{ fileName: string }> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new AppError('Corpo da requisição vazio — envie os bytes do arquivo', 400);
    }
    if (buffer.length > MAX_BYTES) {
      throw new AppError(`Arquivo maior que ${MAX_BYTES / 1024 / 1024} MB`, 413);
    }

    const mime = (contentType ?? '').split(';')[0].trim().toLowerCase();
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      throw new AppError(
        `Content-Type "${mime || 'ausente'}" não suportado — use ${Object.keys(EXT_BY_MIME).join(', ')}`,
        415,
      );
    }

    const fileName = safeName(name, ext);
    await fs.mkdir(GENERATED_DIR, { recursive: true });
    await fs.writeFile(path.join(GENERATED_DIR, fileName), buffer);
    return { fileName };
  }
}

export default new AssetUploadService();
