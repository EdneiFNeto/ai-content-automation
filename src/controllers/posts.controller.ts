import { Request, Response } from 'express';
import PostsService from '../services/posts.service';
import InstagramService from '../services/instagram.service';
import LocalImagesService from '../services/local-images.service';
import { sendSuccess } from '../utils/api-response';
import { buildAssetUrl } from '../utils/public-url';
import { AppError } from '../errors/app-error';

// Referencia um arquivo já existente em assets/ ou assets/generated/ pelo nome,
// sem precisar montar a URL pública na mão a cada post. Função solta (não método de
// classe) porque os métodos do controller são passados por referência ao Express
// (asyncHandler(PostsController.create)) e perderiam o "this" se dependessem dele.
async function resolveLocalImageUrl(req: Request, imageFileName: string): Promise<string> {
  const match = await LocalImagesService.resolve(imageFileName);

  if (!match) {
    throw new AppError(`Imagem local "${imageFileName}" não encontrada`, 400);
  }

  return buildAssetUrl(
    req,
    match.source === 'generated' ? `generated/${match.fileName}` : match.fileName,
  );
}

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
    const { content, imageUrl, imageFileName, scheduledFor } = req.body;

    if (!content) {
      throw new AppError('O campo "content" é obrigatório', 400);
    }

    if (imageUrl && imageFileName) {
      throw new AppError('Envie apenas um: "imageUrl" ou "imageFileName"', 400);
    }

    const resolvedImageUrl = imageFileName
      ? await resolveLocalImageUrl(req, imageFileName)
      : imageUrl;

    const post = PostsService.create({ content, imageUrl: resolvedImageUrl, scheduledFor });
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
