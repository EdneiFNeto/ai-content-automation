import FacebookService from './facebook.service';

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    FACEBOOK_PAGE_ID: 'page-123',
    FACEBOOK_PAGE_ACCESS_TOKEN: 'tok-abc',
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe('FacebookService.isConfigured', () => {
  it('true com PAGE_ID + token, false sem', () => {
    expect(FacebookService.isConfigured).toBe(true);
    delete process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    expect(FacebookService.isConfigured).toBe(false);
  });
});

describe('FacebookService.publishPhoto', () => {
  it('POST /{page}/photos published=true → devolve post_id', async () => {
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok({ id: 'photo-1', post_id: 'page-123_post-1' }));

    const id = await FacebookService.publishPhoto('https://x.test/a.jpg', 'oi');

    expect(id).toBe('page-123_post-1');
    expect(f.mock.calls[0][0]).toContain('/page-123/photos');
    const body = String((f.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain('url=https');
    expect(body).toContain('published=true');
    expect(body).toContain('access_token=tok-abc');
  });

  it('erro da Graph API vira AppError 502', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad',
      json: async () => ({ error: { message: 'token ruim' } }),
    } as Response);

    await expect(FacebookService.publishPhoto('https://x.test/a.jpg', 'oi')).rejects.toMatchObject({
      statusCode: 502,
    });
  });
});

describe('FacebookService.publishPhotos', () => {
  it('sobe cada foto unpublished e cria um post no feed com attached_media', async () => {
    const f = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(ok({ id: 'ph-1' }))
      .mockResolvedValueOnce(ok({ id: 'ph-2' }))
      .mockResolvedValueOnce(ok({ id: 'feed-1' }));

    const id = await FacebookService.publishPhotos(
      ['https://x.test/a.jpg', 'https://x.test/b.jpg'],
      'carrossel',
    );

    expect(id).toBe('feed-1');
    expect(f).toHaveBeenCalledTimes(3);
    expect(String((f.mock.calls[0][1] as RequestInit).body)).toContain('published=false');
    expect(f.mock.calls[2][0]).toContain('/page-123/feed');
    const feedBody = decodeURIComponent(String((f.mock.calls[2][1] as RequestInit).body));
    expect(feedBody).toContain('attached_media[0]={"media_fbid":"ph-1"}');
    expect(feedBody).toContain('attached_media[1]={"media_fbid":"ph-2"}');
  });
});

describe('FacebookService.publishVideo', () => {
  it('POST /{page}/videos com file_url → devolve id', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValueOnce(ok({ id: 'vid-1' }));

    const id = await FacebookService.publishVideo('https://x.test/v.mp4', 'reel');

    expect(id).toBe('vid-1');
    expect(f.mock.calls[0][0]).toContain('/page-123/videos');
    expect(String((f.mock.calls[0][1] as RequestInit).body)).toContain('file_url=https');
  });
});
