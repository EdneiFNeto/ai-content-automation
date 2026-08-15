import { Request, Response } from 'express';
import PostsService from '../services/posts.service';
import InstagramService from '../services/instagram.service';
import LocalImagesService from '../services/local-images.service';
import LocalVideosService from '../services/local-videos.service';
import { sendSuccess } from '../utils/api-response';
import { buildAssetUrl } from '../utils/public-url';
import { AppError } from '../errors/app-error';
import { CarouselItem } from '../types/post.types';

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

async function resolveLocalVideoUrl(req: Request, videoFileName: string): Promise<string> {
  const match = await LocalVideosService.resolve(videoFileName);

  if (!match) {
    throw new AppError(`Vídeo local "${videoFileName}" não encontrado`, 400);
  }

  return buildAssetUrl(
    req,
    match.source === 'generated' ? `generated/${match.fileName}` : match.fileName,
  );
}

interface RawCarouselItem {
  type?: string;
  imageUrl?: string;
  imageFileName?: string;
  videoUrl?: string;
  videoFileName?: string;
}

// Cada item do carrossel segue a mesma regra de imageUrl/imageFileName ou
// videoUrl/videoFileName do post "simples", só que declarando o "type" explicitamente
// (a Graph API trata item de imagem e de vídeo de forma diferente dentro do carrossel)
async function resolveCarouselItem(
  req: Request,
  item: RawCarouselItem,
  index: number,
): Promise<CarouselItem> {
  if (item.type !== 'IMAGE' && item.type !== 'VIDEO') {
    throw new AppError(`Item ${index} de "carouselItems" precisa de "type": "IMAGE" ou "VIDEO"`, 400);
  }

  if (item.type === 'IMAGE') {
    if (Boolean(item.imageUrl) === Boolean(item.imageFileName)) {
      throw new AppError(
        `Item ${index} de "carouselItems" precisa de exatamente um: "imageUrl" ou "imageFileName"`,
        400,
      );
    }

    const url = item.imageFileName
      ? await resolveLocalImageUrl(req, item.imageFileName)
      : (item.imageUrl as string);
    return { type: 'IMAGE', url };
  }

  if (Boolean(item.videoUrl) === Boolean(item.videoFileName)) {
    throw new AppError(
      `Item ${index} de "carouselItems" precisa de exatamente um: "videoUrl" ou "videoFileName"`,
      400,
    );
  }

  const url = item.videoFileName
    ? await resolveLocalVideoUrl(req, item.videoFileName)
    : (item.videoUrl as string);
  return { type: 'VIDEO', url };
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
    const { content, imageUrl, imageFileName, videoUrl, videoFileName, carouselItems, scheduledFor } =
      req.body;

    if (!content) {
      throw new AppError('O campo "content" é obrigatório', 400);
    }

    const mediaFieldsProvided = [imageUrl, imageFileName, videoUrl, videoFileName, carouselItems].filter(
      Boolean,
    ).length;

    if (mediaFieldsProvided > 1) {
      throw new AppError(
        'Envie apenas um: "imageUrl", "imageFileName", "videoUrl", "videoFileName" ou "carouselItems"',
        400,
      );
    }

    const resolvedImageUrl = imageFileName
      ? await resolveLocalImageUrl(req, imageFileName)
      : imageUrl;

    const resolvedVideoUrl = videoFileName
      ? await resolveLocalVideoUrl(req, videoFileName)
      : videoUrl;

    let resolvedCarouselItems: CarouselItem[] | undefined;

    if (carouselItems) {
      if (!Array.isArray(carouselItems) || carouselItems.length < 2 || carouselItems.length > 10) {
        throw new AppError('"carouselItems" precisa ser uma lista com 2 a 10 itens', 400);
      }

      resolvedCarouselItems = await Promise.all(
        carouselItems.map((item: RawCarouselItem, index: number) =>
          resolveCarouselItem(req, item, index),
        ),
      );
    }

    const post = PostsService.create({
      content,
      imageUrl: resolvedImageUrl,
      videoUrl: resolvedVideoUrl,
      carouselItems: resolvedCarouselItems,
      scheduledFor,
    });
    sendSuccess(res, post, 201);
  }

  public async publish(req: Request, res: Response): Promise<void> {
    const post = PostsService.findById(req.params.id as string);

    if (!post) {
      throw new AppError('Post não encontrado', 404);
    }

    if (!post.imageUrl && !post.videoUrl && !post.carouselItems) {
      throw new AppError(
        'Post não possui "imageUrl", "videoUrl" nem "carouselItems" para publicar no Instagram',
        400,
      );
    }

    try {
      const instagramMediaId = post.carouselItems
        ? await InstagramService.publishCarouselPost(post.carouselItems, post.content)
        : post.videoUrl
          ? await InstagramService.publishReel(post.videoUrl, post.content)
          : await InstagramService.publishImagePost(post.imageUrl as string, post.content);
      const updated = PostsService.update(post.id, { status: 'published', instagramMediaId });
      sendSuccess(res, updated);
    } catch (err) {
      PostsService.update(post.id, { status: 'failed' });
      throw err;
    }
  }
}

export default new PostsController();
