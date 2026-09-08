import { Post } from '../types/post.types';

/**
 * Histórico em memória do que foi publicado (some quando o servidor reinicia).
 * Só leitura pra fora; quem publica é o PublishController via `save`.
 */
class PostsService {
  private posts: Post[] = [];

  public list(): Post[] {
    return this.posts;
  }

  public findById(id: string): Post | undefined {
    return this.posts.find((post) => post.id === id);
  }

  public save(post: Post): Post {
    this.posts.push(post);
    return post;
  }
}

export default new PostsService();
