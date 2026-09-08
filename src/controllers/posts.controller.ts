import { Request, Response } from 'express';
import PostsService from '../services/posts.service';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../errors/app-error';

// Histórico de leitura. A publicação em si é o `POST /publish`
// (`publish.controller.ts`).
class PostsController {
  public async list(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, PostsService.list());
  }

  public async getById(req: Request, res: Response): Promise<void> {
    const post = PostsService.findById(req.params.id as string);

    if (!post) {
      throw new AppError('Post não encontrado', 404);
    }

    sendSuccess(res, post);
  }
}

export default new PostsController();
