import { CarouselItem } from './instagram.types';

export type { CarouselItem };

export type PostStatus = 'published' | 'failed';

// Resultado de uma publicação secundária (TikTok, Facebook), sempre tentada
// depois do Instagram. "skipped" = sem equivalente ou não configurado;
// "failed" nunca derruba o post que já foi ao ar no Instagram.
export type SecondaryPublishOutcome = 'published' | 'skipped' | 'failed';

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
  tiktokStatus?: SecondaryPublishOutcome;
  tiktokError?: string;
  facebookPostId?: string;
  facebookStatus?: SecondaryPublishOutcome;
  facebookError?: string;
  error?: string;
}
