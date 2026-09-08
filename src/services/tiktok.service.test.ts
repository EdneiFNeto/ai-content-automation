import TikTokService from './tiktok.service';
import { AppError } from '../errors/app-error';

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    TIKTOK_ACCESS_TOKEN: 'token-de-teste',
    TIKTOK_CLIENT_KEY: 'client-key-de-teste',
    TIKTOK_CLIENT_SECRET: 'client-secret-de-teste',
    TIKTOK_REDIRECT_URI: 'https://example.com/auth/tiktok/callback',
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('TikTokService.publishVideo', () => {
  it('inicia a publicação, aguarda concluir e devolve o publish_id', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'publish-1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' } }),
      } as Response);

    const publishId = await TikTokService.publishVideo('https://example.com/video.mp4', 'legenda');

    expect(publishId).toBe('publish-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
    );

    const initBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(initBody.source_info).toEqual({
      source: 'PULL_FROM_URL',
      video_url: 'https://example.com/video.mp4',
    });
    expect(initBody.post_info.privacy_level).toBe('SELF_ONLY');
  });

  it('aguarda o status sair de PROCESSING_DOWNLOAD antes de concluir', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'publish-1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'PROCESSING_DOWNLOAD' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' } }),
      } as Response);
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);

    const publishId = await TikTokService.publishVideo('https://example.com/video.mp4');

    expect(publishId).toBe('publish-1');
  });

  it('lança AppError quando o status retorna FAILED', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'publish-1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { status: 'FAILED', fail_reason: 'video_format_check_failed' },
        }),
      } as Response);

    await expect(TikTokService.publishVideo('https://example.com/video.mp4')).rejects.toThrow(
      /video_format_check_failed/,
    );
  });

  it('lança AppError quando a API do TikTok retorna erro na inicialização', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'url_ownership_unverified' } }),
    } as Response);

    await expect(TikTokService.publishVideo('https://example.com/video.mp4')).rejects.toThrow(
      /url_ownership_unverified/,
    );
  });

  it('lança AppError quando falta TIKTOK_ACCESS_TOKEN', async () => {
    delete process.env.TIKTOK_ACCESS_TOKEN;

    await expect(TikTokService.publishVideo('https://example.com/video.mp4')).rejects.toThrow(
      AppError,
    );
  });
});

describe('TikTokService.publishPhoto', () => {
  it('inicia a publicação de foto, aguarda concluir e devolve o publish_id', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { publish_id: 'publish-photo-1' } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: 'PUBLISH_COMPLETE' } }),
      } as Response);

    const publishId = await TikTokService.publishPhoto(
      ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg'],
      'legenda',
    );

    expect(publishId).toBe('publish-photo-1');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://open.tiktokapis.com/v2/post/publish/content/init/',
    );

    const initBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(initBody.media_type).toBe('PHOTO');
    expect(initBody.post_mode).toBe('DIRECT_POST');
    expect(initBody.source_info).toEqual({
      source: 'PULL_FROM_URL',
      photo_images: ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg'],
      photo_cover_index: 0,
    });
  });

  it('lança AppError quando a lista de imagens está vazia', async () => {
    await expect(TikTokService.publishPhoto([])).rejects.toThrow(/entre 1 e 35 itens/);
  });

  it('lança AppError quando a API do TikTok retorna erro', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'invalid_params' } }),
    } as Response);

    await expect(TikTokService.publishPhoto(['https://example.com/foto.jpg'])).rejects.toThrow(
      /invalid_params/,
    );
  });
});

describe('TikTokService.getAuthorizationUrl', () => {
  it('monta a URL de autorização com client_key, scope e redirect_uri', () => {
    const url = TikTokService.getAuthorizationUrl('state-123');
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(parsed.searchParams.get('client_key')).toBe('client-key-de-teste');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('user.info.basic,video.publish');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://example.com/auth/tiktok/callback',
    );
    expect(parsed.searchParams.get('state')).toBe('state-123');
  });

  it('lança AppError quando falta TIKTOK_CLIENT_KEY', () => {
    delete process.env.TIKTOK_CLIENT_KEY;

    expect(() => TikTokService.getAuthorizationUrl('state-123')).toThrow(AppError);
  });
});

describe('TikTokService.exchangeCodeForToken', () => {
  it('troca o code por access_token e refresh_token', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 86400,
        refresh_expires_in: 31536000,
        open_id: 'open-1',
        scope: 'user.info.basic,video.publish',
        token_type: 'Bearer',
      }),
    } as Response);

    const token = await TikTokService.exchangeCodeForToken('auth-code');

    expect(token.access_token).toBe('access-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://open.tiktokapis.com/v2/oauth/token/');

    const body = new URLSearchParams(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('client_key')).toBe('client-key-de-teste');
    expect(body.get('client_secret')).toBe('client-secret-de-teste');
    expect(body.get('redirect_uri')).toBe('https://example.com/auth/tiktok/callback');
  });

  it('lança AppError quando a troca de token falha', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'invalid_grant' } }),
    } as Response);

    await expect(TikTokService.exchangeCodeForToken('code-invalido')).rejects.toThrow(
      /invalid_grant/,
    );
  });
});

describe('TikTokService.refreshAccessToken', () => {
  it('renova o token usando grant_type=refresh_token', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        expires_in: 86400,
        refresh_expires_in: 31536000,
        open_id: 'open-1',
        scope: 'user.info.basic,video.publish',
        token_type: 'Bearer',
      }),
    } as Response);

    const token = await TikTokService.refreshAccessToken('refresh-antigo');

    expect(token.access_token).toBe('access-2');
    const body = new URLSearchParams(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-antigo');
  });
});
