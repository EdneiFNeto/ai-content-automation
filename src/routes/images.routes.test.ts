import request from 'supertest';

jest.mock('../services/image-generation.service', () => ({
  __esModule: true,
  default: { generateImage: jest.fn() },
}));

import app from '../app';
import ImageGenerationService from '../services/image-generation.service';

const generateImageMock = ImageGenerationService.generateImage as jest.Mock;

describe('POST /images/generate', () => {
  afterEach(() => {
    generateImageMock.mockReset();
  });

  it('gera a imagem e devolve a URL pública', async () => {
    generateImageMock.mockResolvedValueOnce({ fileName: 'abc123.png', mimeType: 'image/png' });

    const res = await request(app).post('/images/generate').send({ prompt: 'um pôr do sol' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imageUrl).toMatch(/\/assets\/generated\/abc123\.png$/);
    expect(generateImageMock).toHaveBeenCalledWith({
      prompt: 'um pôr do sol',
      aspectRatio: undefined,
    });
  });

  it('retorna 400 quando "prompt" está ausente', async () => {
    const res = await request(app).post('/images/generate').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(generateImageMock).not.toHaveBeenCalled();
  });
});

describe('GET /images/local', () => {
  it('lista as imagens disponíveis em assets/ com URL pública', async () => {
    const res = await request(app).get('/images/local');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toContainEqual(
      expect.objectContaining({
        fileName: 'profile.png',
        source: 'library',
        imageUrl: expect.stringMatching(/\/assets\/profile\.png$/),
      }),
    );
  });
});
