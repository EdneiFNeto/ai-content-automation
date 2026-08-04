import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { AppError } from '../errors/app-error';
import { GenerateImageInput, GeneratedImage } from '../types/image-generation.types';

const GENERATED_DIR = path.resolve(__dirname, '../../assets/generated');

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

class ImageGenerationService {
  private get apiKey(): string {
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      throw new AppError('GEMINI_API_KEY não configurado no servidor', 500);
    }

    return key;
  }

  // "Nano Banana 2" por padrão — ver .env.example para trocar de modelo (ex.: Nano Banana Pro)
  private get model(): string {
    return process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  }

  public async generateImage({ prompt, aspectRatio }: GenerateImageInput): Promise<GeneratedImage> {
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const interaction = await ai.interactions.create({
      model: this.model,
      input: prompt,
      response_format: {
        type: 'image',
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      },
    });

    const image = interaction.output_image;

    if (!image?.data) {
      throw new AppError('Gemini não retornou uma imagem para o prompt enviado', 502);
    }

    const mimeType = image.mime_type ?? 'image/png';
    const extension = MIME_TO_EXTENSION[mimeType] ?? 'png';
    const fileName = `${randomUUID()}.${extension}`;
    const buffer = Buffer.from(image.data, 'base64');

    await fs.mkdir(GENERATED_DIR, { recursive: true });
    await fs.writeFile(path.join(GENERATED_DIR, fileName), buffer);

    return { fileName, mimeType };
  }
}

export default new ImageGenerationService();
