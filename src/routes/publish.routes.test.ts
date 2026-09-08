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

// Upload de bytes não toca no disco no teste.
jest.mock('../services/asset-upload.service', () => ({
  __esModule: true,
  default: {
    save: jest.fn(async (_buf: unknown, mime: string, name?: string) => ({
      fileName: name?.replace(/\.[^.]*$/, '') ?? 'up',
    })),
  },
}));

import app from '../app';
import InstagramService from '../services/instagram.service';
import TikTokService from '../services/tiktok.service';

const igImage = InstagramService.publishImagePost as jest.Mock;
const igCarousel = InstagramService.publishCarouselPost as jest.Mock;
const igReel = InstagramService.publishReel as jest.Mock;
const ttVideo = TikTokService.publishVideo as jest.Mock;
const ttPhoto = TikTokService.publishPhoto as jest.Mock;

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

afterEach(() => {
  [igImage, igCarousel, igReel, ttVideo, ttPhoto].forEach((m) => m.mockReset());
});

describe('POST /publish — multipart (upload)', () => {
  it('1 imagem → publishImagePost + TikTok foto, post "published"', async () => {
    igImage.mockResolvedValueOnce('ig-1');
    ttPhoto.mockResolvedValueOnce('tt-1');

    const res = await request(app)
      .post('/publish')
      .field('caption', 'Legenda')
      .field('project', 'ironcrag-conquest')
      .attach('media', PNG, { filename: '01-home.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.instagramMediaId).toBe('ig-1');
    expect(res.body.data.project).toBe('ironcrag-conquest');
    expect(res.body.data.tiktokStatus).toBe('published');
    expect(igImage).toHaveBeenCalledWith(
      expect.stringMatching(/\/assets\/generated\/01-home$/),
      'Legenda',
    );
    expect(igCarousel).not.toHaveBeenCalled();
  });

  it('2+ imagens → publishCarouselPost', async () => {
    igCarousel.mockResolvedValueOnce('ig-carousel');
    ttPhoto.mockResolvedValueOnce('tt-2');

    const res = await request(app)
      .post('/publish')
      .field('caption', 'Carrossel')
      .attach('media', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('media', PNG, { filename: 'b.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(igCarousel).toHaveBeenCalledTimes(1);
    const [items, caption] = igCarousel.mock.calls[0];
    expect(items).toHaveLength(2);
    expect(items.every((i: { type: string }) => i.type === 'IMAGE')).toBe(true);
    expect(caption).toBe('Carrossel');
  });
});

describe('POST /publish — JSON (nomes/URLs)', () => {
  it('nome de asset local → resolve pra URL /assets/ e publica', async () => {
    igImage.mockResolvedValueOnce('ig-local');
    ttPhoto.mockResolvedValueOnce('tt-3');

    const res = await request(app)
      .post('/publish')
      .send({ caption: 'Local', media: ['profile.png'] });

    expect(res.status).toBe(201);
    expect(igImage).toHaveBeenCalledWith(expect.stringMatching(/\/assets\/profile\.png$/), 'Local');
  });

  it('URLs absolutas → carrossel direto', async () => {
    igCarousel.mockResolvedValueOnce('ig-urls');
    ttPhoto.mockResolvedValueOnce('tt-4');

    const res = await request(app)
      .post('/publish')
      .send({ caption: 'URLs', media: ['https://x.test/a.jpg', 'https://x.test/b.jpg'] });

    expect(res.status).toBe(201);
    expect(igCarousel).toHaveBeenCalledWith(
      [
        { type: 'IMAGE', url: 'https://x.test/a.jpg' },
        { type: 'IMAGE', url: 'https://x.test/b.jpg' },
      ],
      'URLs',
    );
  });

  it('URL de vídeo → publishReel + TikTok vídeo', async () => {
    igReel.mockResolvedValueOnce('ig-reel');
    ttVideo.mockResolvedValueOnce('tt-vid');

    const res = await request(app)
      .post('/publish')
      .send({ caption: 'Reel', media: ['https://x.test/v.mp4'] });

    expect(res.status).toBe(201);
    expect(igReel).toHaveBeenCalledWith('https://x.test/v.mp4', 'Reel');
    expect(ttVideo).toHaveBeenCalledWith('https://x.test/v.mp4', 'Reel');
  });

  it('nome inexistente → 400', async () => {
    const res = await request(app)
      .post('/publish')
      .send({ caption: 'x', media: ['nao-existe.png'] });
    expect(res.status).toBe(400);
    expect(igImage).not.toHaveBeenCalled();
  });
});

describe('POST /publish — validação e dryRun', () => {
  it('sem caption → 400', async () => {
    const res = await request(app)
      .post('/publish')
      .send({ media: ['profile.png'] });
    expect(res.status).toBe(400);
  });

  it('sem mídia → 400', async () => {
    const res = await request(app).post('/publish').send({ caption: 'só texto' });
    expect(res.status).toBe(400);
  });

  it('?dryRun=1 → wouldPublish, nada é publicado', async () => {
    const res = await request(app)
      .post('/publish?dryRun=1')
      .send({ caption: 'Ensaio', media: ['https://x.test/a.jpg', 'https://x.test/b.jpg'] });

    expect(res.status).toBe(200);
    expect(res.body.data.wouldPublish).toEqual({
      type: 'carousel',
      caption: 'Ensaio',
      project: undefined,
      mediaUrls: ['https://x.test/a.jpg', 'https://x.test/b.jpg'],
    });
    expect(igCarousel).not.toHaveBeenCalled();
    expect(ttPhoto).not.toHaveBeenCalled();
  });
});

describe('POST /publish — TikTok e falhas', () => {
  it('Instagram ok, TikTok falha → post segue "published"', async () => {
    igImage.mockResolvedValueOnce('ig-x');
    ttPhoto.mockRejectedValueOnce(new Error('TikTok caiu'));

    const res = await request(app)
      .post('/publish')
      .send({ caption: 'x', media: ['https://x.test/a.jpg'] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.tiktokStatus).toBe('failed');
    expect(res.body.data.tiktokError).toBe('TikTok caiu');
  });

  it('carrossel com vídeo → TikTok "skipped"', async () => {
    igCarousel.mockResolvedValueOnce('ig-mix');

    const res = await request(app)
      .post('/publish')
      .send({ caption: 'x', media: ['https://x.test/a.jpg', 'https://x.test/v.mp4'] });

    expect(res.status).toBe(201);
    expect(res.body.data.tiktokStatus).toBe('skipped');
    expect(ttPhoto).not.toHaveBeenCalled();
    expect(ttVideo).not.toHaveBeenCalled();
  });

  it('Instagram falha → 500 e o post fica "failed" no histórico', async () => {
    igImage.mockRejectedValueOnce(new Error('Graph API 400'));

    const res = await request(app)
      .post('/publish')
      .send({ caption: 'vai falhar', media: ['https://x.test/a.jpg'] });
    expect(res.status).toBe(500);

    const list = await request(app).get('/posts');
    expect(
      list.body.data.some((p: { status: string; error?: string }) => p.status === 'failed'),
    ).toBe(true);
  });
});

describe('GET /posts', () => {
  it('lista o que foi publicado e 404 pra id inexistente', async () => {
    igImage.mockResolvedValueOnce('ig-hist');
    ttPhoto.mockResolvedValueOnce('tt-hist');
    const pub = await request(app)
      .post('/publish')
      .send({ caption: 'histórico', media: ['https://x.test/a.jpg'] });

    const one = await request(app).get(`/posts/${pub.body.data.id}`);
    expect(one.status).toBe(200);
    expect(one.body.data.content).toBe('histórico');

    expect((await request(app).get('/posts/nao-existe')).status).toBe(404);
  });
});
