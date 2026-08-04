import { Request, Response } from 'express';
import ImageGenerationService from '../services/image-generation.service';
import LocalImagesService from '../services/local-images.service';
import { sendSuccess } from '../utils/api-response';
import { buildAssetUrl } from '../utils/public-url';
import { AppError } from '../errors/app-error';
import { ImageAspectRatio } from '../types/image-generation.types';

class ImagesController {
  public async generate(req: Request, res: Response): Promise<void> {
    const { prompt, aspectRatio } = req.body as { prompt?: string; aspectRatio?: ImageAspectRatio };

    if (!prompt) {
      throw new AppError('O campo "prompt" é obrigatório', 400);
    }

    const { fileName, mimeType } = await ImageGenerationService.generateImage({
      prompt,
      aspectRatio,
    });

    sendSuccess(
      res,
      { imageUrl: buildAssetUrl(req, `generated/${fileName}`), fileName, mimeType },
      201,
    );
  }

  public async listLocal(req: Request, res: Response): Promise<void> {
    const images = await LocalImagesService.list();

    const data = images.map((image) => ({
      ...image,
      imageUrl: buildAssetUrl(
        req,
        image.source === 'generated' ? `generated/${image.fileName}` : image.fileName,
      ),
    }));

    sendSuccess(res, data);
  }
}

export default new ImagesController();
