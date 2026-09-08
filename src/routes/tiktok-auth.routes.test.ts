import request from 'supertest';

jest.mock('../services/tiktok.service', () => ({
  __esModule: true,
  default: {
    getAuthorizationUrl: jest.fn(),
    exchangeCodeForToken: jest.fn(),
  },
}));

import app from '../app';
import TikTokService from '../services/tiktok.service';

const getAuthorizationUrlMock = TikTokService.getAuthorizationUrl as jest.Mock;
const exchangeCodeForTokenMock = TikTokService.exchangeCodeForToken as jest.Mock;

describe('GET /auth/tiktok/login', () => {
  afterEach(() => {
    getAuthorizationUrlMock.mockReset();
  });

  it('redireciona para a URL de autorização do TikTok', async () => {
    getAuthorizationUrlMock.mockReturnValueOnce('https://www.tiktok.com/v2/auth/authorize/?mock=1');

    const res = await request(app).get('/auth/tiktok/login');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://www.tiktok.com/v2/auth/authorize/?mock=1');
    expect(getAuthorizationUrlMock).toHaveBeenCalledWith(expect.any(String));
  });
});

describe('GET /auth/tiktok/callback', () => {
  afterEach(() => {
    exchangeCodeForTokenMock.mockReset();
  });

  it('retorna 400 quando o TikTok recusa a autorização', async () => {
    const res = await request(app)
      .get('/auth/tiktok/callback')
      .query({ error: 'access_denied', error_description: 'usuário cancelou' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(exchangeCodeForTokenMock).not.toHaveBeenCalled();
  });

  it('retorna 400 quando "code" está ausente', async () => {
    const res = await request(app).get('/auth/tiktok/callback').query({ state: 'qualquer' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('retorna 400 quando "state" não bate com o gerado no /login', async () => {
    const res = await request(app)
      .get('/auth/tiktok/callback')
      .query({ code: 'auth-code', state: 'state-forjado' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(exchangeCodeForTokenMock).not.toHaveBeenCalled();
  });

  it('troca o code por token quando state bate com o gerado no /login', async () => {
    getAuthorizationUrlMock.mockImplementationOnce((state: string) => {
      return `https://www.tiktok.com/v2/auth/authorize/?state=${state}`;
    });
    const loginRes = await request(app).get('/auth/tiktok/login');
    const state = new URL(loginRes.headers.location as string).searchParams.get('state');

    exchangeCodeForTokenMock.mockResolvedValueOnce({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 86400,
      scope: 'user.info.basic,video.publish',
    });

    const res = await request(app).get('/auth/tiktok/callback').query({ code: 'auth-code', state });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('access-1');
    expect(res.body.data.refreshToken).toBe('refresh-1');
    expect(exchangeCodeForTokenMock).toHaveBeenCalledWith('auth-code');
  });
});
