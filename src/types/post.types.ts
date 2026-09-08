import { CarouselItem } from './instagram.types';

export type { CarouselItem };

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

// Resultado da publicação no TikTok, sempre tentada junto do Instagram:
// "skipped" cobre casos sem equivalente na Content Posting API (ex.: carrossel
// misto de foto e vídeo), "failed" não derruba o post já publicado no Instagram.
export type TikTokPublishOutcome = 'published' | 'skipped' | 'failed';

export interface Post {
  id: string;
  content: string;
  /** Projeto de origem (ex.: "ironcrag-conquest"). Livre; só pra atribuição. */
  project?: string;
  imageUrl?: string;
  videoUrl?: string;
  carouselItems?: CarouselItem[];
  status: PostStatus;
  scheduledFor?: string;
  createdAt: string;
  instagramMediaId?: string;
  tiktokPublishId?: string;
  tiktokStatus?: TikTokPublishOutcome;
  tiktokError?: string;
}

export interface CreatePostInput {
  content: string;
  project?: string;
  imageUrl?: string;
  videoUrl?: string;
  carouselItems?: CarouselItem[];
  scheduledFor?: string;
}

export type UpdatePostInput = Partial<
  Pick<Post, 'status' | 'instagramMediaId' | 'tiktokPublishId' | 'tiktokStatus' | 'tiktokError'>
>;
