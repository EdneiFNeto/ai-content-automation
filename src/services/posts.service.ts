import { randomUUID } from 'crypto';
import { Post, CreatePostInput, UpdatePostInput } from '../types/post.types';

class PostsService {
  private posts: Post[] = [];

  public list(): Post[] {
    return this.posts;
  }

  public findById(id: string): Post | undefined {
    return this.posts.find((post) => post.id === id);
  }

  public create(input: CreatePostInput): Post {
    const post: Post = {
      id: randomUUID(),
      content: input.content,
      imageUrl: input.imageUrl,
      videoUrl: input.videoUrl,
      status: input.scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: input.scheduledFor,
      createdAt: new Date().toISOString(),
    };

    this.posts.push(post);
    return post;
  }

  public update(id: string, patch: UpdatePostInput): Post {
    const post = this.findById(id);

    if (!post) {
      throw new Error(`Post ${id} não encontrado`);
    }

    Object.assign(post, patch);
    return post;
  }
}

export default new PostsService();
