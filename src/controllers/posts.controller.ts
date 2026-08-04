import { Request, Response } from 'express';
import PostsService from '../services/posts.service';
import InstagramService from '../services/instagram.service';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../errors/app-error';

class PostsController {
  public async list(req: Request, res: Response): Promise<void> {
    sendSuccess(res, PostsService.list());
  }

  public async getById(req: Request, res: Response): Promise<void> {
    const post = PostsService.findById(req.params.id as string);

    if (!post) {
      throw new AppError('Post não encontrado', 404);
    }

    sendSuccess(res, post);
  }

  public async create(req: Request, res: Response): Promise<void> {
    const { content, imageUrl, scheduledFor } = req.body;

    if (!content) {
      throw new AppError('O campo "content" é obrigatório', 400);
    }

    const post = PostsService.create({ content, imageUrl, scheduledFor });
    sendSuccess(res, post, 201);
  }

  public async publish(req: Request, res: Response): Promise<void> {
    const post = PostsService.findById(req.params.id as string);

    if (!post) {
      throw new AppError('Post não encontrado', 404);
    }

    if (!post.imageUrl) {
      throw new AppError('Post não possui "imageUrl" para publicar no Instagram', 400);
    }

    try {
      const instagramMediaId = await InstagramService.publishImagePost(post.imageUrl, post.content);
      const updated = PostsService.update(post.id, { status: 'published', instagramMediaId });
      sendSuccess(res, updated);
    } catch (err) {
      PostsService.update(post.id, { status: 'failed' });
      throw err;
    }
  }
}

export default new PostsController();
