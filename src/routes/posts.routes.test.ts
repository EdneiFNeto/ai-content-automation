import request from 'supertest';

jest.mock('../services/instagram.service', () => ({
  __esModule: true,
  default: { publishImagePost: jest.fn() },
}));

import app from '../app';
import InstagramService from '../services/instagram.service';

const publishImagePostMock = InstagramService.publishImagePost as jest.Mock;

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
});
