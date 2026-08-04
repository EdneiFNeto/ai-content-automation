export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  status: PostStatus;
  scheduledFor?: string;
  createdAt: string;
  instagramMediaId?: string;
}

export interface CreatePostInput {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  scheduledFor?: string;
}

export type UpdatePostInput = Partial<Pick<Post, 'status' | 'instagramMediaId'>>;
