import { promises as fs } from 'fs';
import path from 'path';
import { AppError } from '../errors/app-error';

const GENERATED_DIR = path.resolve(__dirname, '../../assets/generated');

const createMock = jest.fn();

// Reflete a classe de erro interna real do SDK (não exportada publicamente),
// que expõe o status HTTP em `statusCode`, não `status`
class MockGeminiSdkError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    interactions: { create: createMock },
  })),
}));

import ImageGenerationService from './image-generation.service';

const originalEnv = process.env;
const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

beforeEach(() => {
  process.env = { ...originalEnv, GEMINI_API_KEY: 'chave-de-teste' };
});

afterEach(async () => {
  process.env = originalEnv;
  jest.clearAllMocks();
  await fs.rm(GENERATED_DIR, { recursive: true, force: true });
});

describe('ImageGenerationService.generateImage', () => {
  it('gera e salva a imagem retornada pela Gemini API', async () => {
    createMock.mockResolvedValueOnce({
      output_image: { data: tinyPngBase64, mime_type: 'image/png' },
    });

    const result = await ImageGenerationService.generateImage({ prompt: 'um gato astronauta' });

    expect(result.fileName).toMatch(/\.png$/);
    expect(result.mimeType).toBe('image/png');
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'um gato astronauta', model: expect.any(String) }),
    );

    const saved = await fs.readFile(path.join(GENERATED_DIR, result.fileName));
    expect(saved.length).toBeGreaterThan(0);
  });

  it('lança AppError quando a Gemini API não retorna imagem', async () => {
    createMock.mockResolvedValueOnce({});

    await expect(ImageGenerationService.generateImage({ prompt: 'sem imagem' })).rejects.toThrow(
      AppError,
    );
  });

  it('converte erro do SDK (ex.: quota excedida) em AppError com a mensagem e status reais', async () => {
    createMock.mockRejectedValueOnce(
      new MockGeminiSdkError('Quota exceeded for metric: generate_content', 429),
    );

    await expect(
      ImageGenerationService.generateImage({ prompt: 'qualquer coisa' }),
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining('Quota exceeded'),
    });
  });

  it('usa status 502 quando o erro do SDK não expõe um status HTTP', async () => {
    createMock.mockRejectedValueOnce(new Error('falha de rede'));

    await expect(
      ImageGenerationService.generateImage({ prompt: 'qualquer coisa' }),
    ).rejects.toMatchObject({ statusCode: 502 });
  });

  it('lança AppError quando falta GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(
      ImageGenerationService.generateImage({ prompt: 'qualquer coisa' }),
    ).rejects.toThrow(AppError);
  });
});
