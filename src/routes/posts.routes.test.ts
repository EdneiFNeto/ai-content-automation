import request from 'supertest';

jest.mock('../services/instagram.service', () => ({
  __esModule: true,
  default: {
    publishImagePost: jest.fn(),
    publishCarouselPost: jest.fn(),
    publishReel: jest.fn(),
  },
}));

jest.mock('../services/tiktok.service', () => ({
  __esModule: true,
  default: { publishVideo: jest.fn(), publishPhoto: jest.fn() },
}));

import app from '../app';
import InstagramService from '../services/instagram.service';
import TikTokService from '../services/tiktok.service';

const publishImagePostMock = InstagramService.publishImagePost as jest.Mock;
const publishCarouselPostMock = InstagramService.publishCarouselPost as jest.Mock;
const publishReelMock = InstagramService.publishReel as jest.Mock;
const tiktokPublishVideoMock = TikTokService.publishVideo as jest.Mock;
const tiktokPublishPhotoMock = TikTokService.publishPhoto as jest.Mock;

describe('POST /posts', () => {
  it('cria um post com sucesso', async () => {
    const res = await request(app).post('/posts').send({ content: 'Post de teste' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('Post de teste');
    expect(res.body.data.status).toBe('draft');
  });

  it('retorna erro 400 quando "content" está ausente', async () => {
    const res = await request(app).post('/posts').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('cria um post referenciando uma imagem local por "imageFileName"', async () => {
    const res = await request(app)
      .post('/posts')
      .send({ content: 'Post com imagem local', imageFileName: 'profile.png' });

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toMatch(/\/assets\/profile\.png$/);
  });

  it('retorna 400 quando "imageFileName" não existe', async () => {
    const res = await request(app)
      .post('/posts')
      .send({ content: 'Post com imagem inexistente', imageFileName: 'nao-existe.png' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 quando "imageUrl" e "imageFileName" são enviados juntos', async () => {
    const res = await request(app).post('/posts').send({
      content: 'Post ambíguo',
      imageUrl: 'https://example.com/foto.jpg',
      imageFileName: 'profile.png',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('cria um post com carouselItems (imageUrl e videoFileName)', async () => {
    const res = await request(app)
      .post('/posts')
      .send({
        content: 'Post em carrossel',
        carouselItems: [
          { type: 'IMAGE', imageUrl: 'https://example.com/foto.jpg' },
          { type: 'VIDEO', videoFileName: 'video-01.mp4' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.carouselItems).toEqual([
      { type: 'IMAGE', url: 'https://example.com/foto.jpg' },
      { type: 'VIDEO', url: expect.stringMatching(/\/assets\/video\/video-01\.mp4$/) },
    ]);
  });

  it('retorna 400 quando "carouselItems" tem menos de 2 itens', async () => {
    const res = await request(app)
      .post('/posts')
      .send({
        content: 'Carrossel curto demais',
        carouselItems: [{ type: 'IMAGE', imageUrl: 'https://example.com/foto.jpg' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 quando um item de "carouselItems" não tem "type" válido', async () => {
    const res = await request(app)
      .post('/posts')
      .send({
        content: 'Carrossel com item inválido',
        carouselItems: [
          { imageUrl: 'https://example.com/foto.jpg' },
          { type: 'IMAGE', imageUrl: 'https://example.com/foto2.jpg' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 quando "carouselItems" é enviado junto com "imageUrl"', async () => {
    const res = await request(app)
      .post('/posts')
      .send({
        content: 'Post ambíguo',
        imageUrl: 'https://example.com/foto.jpg',
        carouselItems: [
          { type: 'IMAGE', imageUrl: 'https://example.com/foto.jpg' },
          { type: 'IMAGE', imageUrl: 'https://example.com/foto2.jpg' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /posts/:id', () => {
  it('retorna 404 para post inexistente', async () => {
    const res = await request(app).get('/posts/nao-existe');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('retorna o post criado anteriormente', async () => {
    const created = await request(app).post('/posts').send({ content: 'Outro post' });

    const res = await request(app).get(`/posts/${created.body.data.id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });
});

describe('POST /posts/:id/publish', () => {
  afterEach(() => {
    publishImagePostMock.mockReset();
    publishCarouselPostMock.mockReset();
    publishReelMock.mockReset();
    tiktokPublishVideoMock.mockReset();
    tiktokPublishPhotoMock.mockReset();
  });

  it('publica carrossel no Instagram e marca o post como "published"', async () => {
    publishCarouselPostMock.mockResolvedValueOnce('media-carousel-1');

    const created = await request(app)
      .post('/posts')
      .send({
        content: 'Post em carrossel',
        carouselItems: [
          { type: 'IMAGE', imageUrl: 'https://example.com/foto.jpg' },
          { type: 'IMAGE', imageUrl: 'https://example.com/foto2.jpg' },
        ],
      });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.instagramMediaId).toBe('media-carousel-1');
    expect(publishCarouselPostMock).toHaveBeenCalledWith(
      [
        { type: 'IMAGE', url: 'https://example.com/foto.jpg' },
        { type: 'IMAGE', url: 'https://example.com/foto2.jpg' },
      ],
      'Post em carrossel',
    );
    expect(publishImagePostMock).not.toHaveBeenCalled();
  });

  it('publica no Instagram e marca o post como "published"', async () => {
    publishImagePostMock.mockResolvedValueOnce('media-123');

    const created = await request(app)
      .post('/posts')
      .send({ content: 'Post com imagem', imageUrl: 'https://example.com/foto.jpg' });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.instagramMediaId).toBe('media-123');
    expect(publishImagePostMock).toHaveBeenCalledWith(
      'https://example.com/foto.jpg',
      'Post com imagem',
    );
  });

  it('retorna 400 quando o post não tem imageUrl', async () => {
    const created = await request(app).post('/posts').send({ content: 'Sem imagem' });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(publishImagePostMock).not.toHaveBeenCalled();
  });

  it('retorna 404 para post inexistente', async () => {
    const res = await request(app).post('/posts/nao-existe/publish');

    expect(res.status).toBe(404);
  });

  it('marca o post como "failed" quando a publicação falha', async () => {
    publishImagePostMock.mockRejectedValueOnce(new Error('Falha ao publicar mídia no Instagram'));

    const created = await request(app)
      .post('/posts')
      .send({ content: 'Post que vai falhar', imageUrl: 'https://example.com/foto.jpg' });

    const publishRes = await request(app).post(`/posts/${created.body.data.id}/publish`);
    expect(publishRes.status).toBe(500);

    const getRes = await request(app).get(`/posts/${created.body.data.id}`);
    expect(getRes.body.data.status).toBe('failed');
  });

  it('publica no Instagram e no TikTok quando o post tem imagem', async () => {
    publishImagePostMock.mockResolvedValueOnce('media-123');
    tiktokPublishPhotoMock.mockResolvedValueOnce('tiktok-photo-1');

    const created = await request(app)
      .post('/posts')
      .send({ content: 'Post com imagem', imageUrl: 'https://example.com/foto.jpg' });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.tiktokStatus).toBe('published');
    expect(res.body.data.tiktokPublishId).toBe('tiktok-photo-1');
    expect(tiktokPublishPhotoMock).toHaveBeenCalledWith(
      ['https://example.com/foto.jpg'],
      'Post com imagem',
    );
  });

  it('publica vídeo no Instagram (Reels) e no TikTok', async () => {
    publishReelMock.mockResolvedValueOnce('media-reel-1');
    tiktokPublishVideoMock.mockResolvedValueOnce('tiktok-video-1');

    const created = await request(app)
      .post('/posts')
      .send({ content: 'Post em vídeo', videoUrl: 'https://example.com/video.mp4' });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.tiktokStatus).toBe('published');
    expect(res.body.data.tiktokPublishId).toBe('tiktok-video-1');
    expect(tiktokPublishVideoMock).toHaveBeenCalledWith(
      'https://example.com/video.mp4',
      'Post em vídeo',
    );
  });

  it('mantém o post "published" quando o Instagram funciona mas o TikTok falha', async () => {
    publishImagePostMock.mockResolvedValueOnce('media-123');
    tiktokPublishPhotoMock.mockRejectedValueOnce(new Error('Falha ao publicar foto no TikTok'));

    const created = await request(app)
      .post('/posts')
      .send({ content: 'Post com imagem', imageUrl: 'https://example.com/foto.jpg' });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.tiktokStatus).toBe('failed');
    expect(res.body.data.tiktokError).toBe('Falha ao publicar foto no TikTok');
  });

  it('pula o TikTok quando o carrossel mistura foto e vídeo', async () => {
    publishCarouselPostMock.mockResolvedValueOnce('media-carousel-1');

    const created = await request(app)
      .post('/posts')
      .send({
        content: 'Post em carrossel',
        carouselItems: [
          { type: 'IMAGE', imageUrl: 'https://example.com/foto.jpg' },
          { type: 'VIDEO', videoUrl: 'https://example.com/video.mp4' },
        ],
      });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.tiktokStatus).toBe('skipped');
    expect(tiktokPublishPhotoMock).not.toHaveBeenCalled();
    expect(tiktokPublishVideoMock).not.toHaveBeenCalled();
  });

  it('publica carrossel de fotos no TikTok quando todos os itens são imagem', async () => {
    publishCarouselPostMock.mockResolvedValueOnce('media-carousel-2');
    tiktokPublishPhotoMock.mockResolvedValueOnce('tiktok-photo-carousel-1');

    const created = await request(app)
      .post('/posts')
      .send({
        content: 'Post em carrossel',
        carouselItems: [
          { type: 'IMAGE', imageUrl: 'https://example.com/foto.jpg' },
          { type: 'IMAGE', imageUrl: 'https://example.com/foto2.jpg' },
        ],
      });

    const res = await request(app).post(`/posts/${created.body.data.id}/publish`);

    expect(res.status).toBe(200);
    expect(res.body.data.tiktokStatus).toBe('published');
    expect(tiktokPublishPhotoMock).toHaveBeenCalledWith(
      ['https://example.com/foto.jpg', 'https://example.com/foto2.jpg'],
      'Post em carrossel',
    );
  });
});
