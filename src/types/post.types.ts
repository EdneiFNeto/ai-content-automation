import { CarouselItem } from './instagram.types';

export type { CarouselItem };

export type PostStatus = 'published' | 'failed';

// Resultado da publicação no TikTok, sempre tentada junto do Instagram:
// "skipped" cobre casos sem equivalente na Content Posting API (ex.: carrossel
// com vídeo), "failed" não derruba o post já publicado no Instagram.
export type TikTokPublishOutcome = 'published' | 'skipped' | 'failed';

/** Um post publicado (ou que falhou). Histórico em memória — ver PostsService. */
export interface Post {
  id: string;
  content: string;
  /** Projeto de origem (ex.: "ironcrag-conquest"). Livre; só pra atribuição. */
  project?: string;
  /** Mídia resolvida em URLs públicas, na ordem do carrossel. */
  items: CarouselItem[];
  status: PostStatus;
  createdAt: string;
  instagramMediaId?: string;
  tiktokPublishId?: string;
  tiktokStatus?: TikTokPublishOutcome;
  tiktokError?: string;
  error?: string;
}
