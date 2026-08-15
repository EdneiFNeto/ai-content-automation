import { CarouselItem } from './instagram.types';

export type { CarouselItem };

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  carouselItems?: CarouselItem[];
  status: PostStatus;
  scheduledFor?: string;
  createdAt: string;
  instagramMediaId?: string;
}

export interface CreatePostInput {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  carouselItems?: CarouselItem[];
  scheduledFor?: string;
}

export type UpdatePostInput = Partial<Pick<Post, 'status' | 'instagramMediaId'>>;
