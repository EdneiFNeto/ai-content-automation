import path from 'path';
import { Request } from 'express';
import { AppError } from '../errors/app-error';
import { buildAssetUrl } from '../utils/public-url';
import { CarouselItem } from '../types/instagram.types';
import LocalImagesService from './local-images.service';
import LocalVideosService from './local-videos.service';
import AssetUploadService from './asset-upload.service';

const VIDEO_URL_PREFIX: Record<string, string> = { generated: 'generated/', video: 'video/' };
const VIDEO_EXT = new Set(['.mp4', '.mov']);

/** Uploaded file shape from `multer` memoryStorage (only what we need). */
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

/**
 * Uma referência de mídia (nome de asset local **ou** URL absoluta) → um
 * `CarouselItem` com a URL pública que a Meta/TikTok conseguem baixar.
 */
export async function resolveMediaRef(req: Request, ref: string): Promise<CarouselItem> {
  if (/^https?:\/\//i.test(ref)) {
    return { type: guessType(ref), url: ref };
  }

  const img = await LocalImagesService.resolve(ref);
  if (img) {
    const rel = img.source === 'generated' ? `generated/${img.fileName}` : img.fileName;
    return { type: 'IMAGE', url: buildAssetUrl(req, rel) };
  }

  const vid = await LocalVideosService.resolve(ref);
  if (vid) {
    return {
      type: 'VIDEO',
      url: buildAssetUrl(req, `${VIDEO_URL_PREFIX[vid.source] ?? ''}${vid.fileName}`),
    };
  }

  throw new AppError(`Mídia "${ref}" não encontrada em assets/ e não é uma URL http(s)`, 400);
}

/** Bytes de um upload → salva em assets/generated/ → `CarouselItem`. */
export async function resolveUploadedFile(req: Request, file: UploadedFile): Promise<CarouselItem> {
  const { fileName } = await AssetUploadService.save(file.buffer, file.mimetype, file.originalname);
  const type: CarouselItem['type'] = file.mimetype.startsWith('video/') ? 'VIDEO' : 'IMAGE';
  return { type, url: buildAssetUrl(req, `generated/${fileName}`) };
}

function guessType(url: string): CarouselItem['type'] {
  let ext = '';
  try {
    ext = path.extname(new URL(url).pathname).toLowerCase();
  } catch {
    /* URL sem path — trata como imagem */
  }
  return VIDEO_EXT.has(ext) ? 'VIDEO' : 'IMAGE';
}
