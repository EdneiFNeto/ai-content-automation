import { Request, Response } from 'express';
import ImageGenerationService from '../services/image-generation.service';
import { sendSuccess } from '../utils/api-response';
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

    const baseUrl = `${req.protocol}://${req.get('host')}/assets/generated`;
    sendSuccess(res, { imageUrl: `${baseUrl}/${fileName}`, fileName, mimeType }, 201);
  }
}

export default new ImagesController();
