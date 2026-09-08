import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { sendSuccess } from '../utils/api-response';
import { CarouselItem, Post, TikTokPublishOutcome } from '../types/post.types';
import InstagramService from '../services/instagram.service';
import TikTokService from '../services/tiktok.service';
import PostsService from '../services/posts.service';
import {
  UploadedFile,
  resolveMediaRef,
  resolveUploadedFile,
} from '../services/media-resolver.service';

interface TikTokResult {
  status: TikTokPublishOutcome;
  publishId?: string;
  error?: string;
}

// Publica no TikTok logo depois do Instagram. Nunca lança — uma falha aqui não
// pode derrubar um post que já foi ao ar no Instagram.
async function publishToTikTok(items: CarouselItem[], caption: string): Promise<TikTokResult> {
  try {
    const hasVideo = items.some((i) => i.type === 'VIDEO');
    if (hasVideo) {
      if (items.length === 1) {
        return {
          status: 'published',
          publishId: await TikTokService.publishVideo(items[0].url, caption),
        };
      }
      return { status: 'skipped', error: 'TikTok não suporta carrossel com vídeo' };
    }
    return {
      status: 'published',
      publishId: await TikTokService.publishPhoto(
        items.map((i) => i.url),
        caption,
      ),
    };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Erro desconhecido ao publicar no TikTok',
    };
  }
}

async function publishToInstagram(items: CarouselItem[], caption: string): Promise<string> {
  if (items.length > 1) return InstagramService.publishCarouselPost(items, caption);
  if (items[0].type === 'VIDEO') return InstagramService.publishReel(items[0].url, caption);
  return InstagramService.publishImagePost(items[0].url, caption);
}

function kind(items: CarouselItem[]): 'carousel' | 'reel' | 'image' {
  if (items.length > 1) return 'carousel';
  return items[0].type === 'VIDEO' ? 'reel' : 'image';
}

class PublishController {
  /**
   * `POST /publish` — um passo só. Recebe a mídia e a legenda, resolve tudo em
   * URLs públicas, publica no Instagram (imagem / Reel / carrossel, decidido
   * pela mídia) e depois no TikTok.
   *
   * Corpo aceito:
   *  - `multipart/form-data`: `caption`, `project?`, `media` (1+ arquivos)
   *  - `application/json`: `{ caption, project?, media: [<asset local>|<url>, ...] }`
   *
   * `?dryRun=1` resolve tudo e devolve o que *seria* publicado, sem chamar
   * Meta/TikTok.
   */
  public async publish(req: Request, res: Response): Promise<void> {
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    // multipart normaliza quebras de linha pra CRLF (RFC 7578) — desfaz, senão a
    // legenda no Instagram fica com \r sobrando.
    const caption =
      typeof req.body.caption === 'string' ? req.body.caption.replace(/\r\n?/g, '\n').trim() : '';
    const project =
      typeof req.body.project === 'string' && req.body.project.trim()
        ? req.body.project.trim()
        : undefined;

    if (!caption) throw new AppError('O campo "caption" é obrigatório', 400);

    const files = (req.files as UploadedFile[] | undefined) ?? [];
    const refs = normalizeRefs(req.body.media);

    if (files.length > 0 && refs.length > 0) {
      throw new AppError('Envie a mídia por upload OU por "media" (nomes/URLs), não os dois', 400);
    }

    let items: CarouselItem[];
    if (files.length > 0) {
      items = await Promise.all(files.map((f) => resolveUploadedFile(req, f)));
    } else if (refs.length > 0) {
      items = await Promise.all(refs.map((r) => resolveMediaRef(req, r)));
    } else {
      throw new AppError('Nenhuma mídia — envie arquivos em "media" ou uma lista "media"', 400);
    }

    if (items.length > 10) throw new AppError('Máximo de 10 itens de mídia', 400);

    if (dryRun) {
      sendSuccess(res, {
        wouldPublish: { type: kind(items), caption, project, mediaUrls: items.map((i) => i.url) },
      });
      return;
    }

    const base: Omit<Post, 'status'> = {
      id: randomUUID(),
      content: caption,
      project,
      items,
      createdAt: new Date().toISOString(),
    };

    try {
      const instagramMediaId = await publishToInstagram(items, caption);
      const tiktok = await publishToTikTok(items, caption);
      const post = PostsService.save({
        ...base,
        status: 'published',
        instagramMediaId,
        tiktokPublishId: tiktok.publishId,
        tiktokStatus: tiktok.status,
        tiktokError: tiktok.error,
      });
      sendSuccess(res, post, 201);
    } catch (err) {
      PostsService.save({
        ...base,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

function normalizeRefs(media: unknown): string[] {
  if (Array.isArray(media)) return media.map((m) => String(m)).filter(Boolean);
  if (typeof media === 'string' && media.trim()) return [media.trim()];
  return [];
}

export default new PublishController();
