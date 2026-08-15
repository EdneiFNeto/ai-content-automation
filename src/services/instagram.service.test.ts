import InstagramService from './instagram.service';
import { AppError } from '../errors/app-error';

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    INSTAGRAM_ACCESS_TOKEN: 'token-de-teste',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: '123456',
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.restoreAllMocks();
});

describe('InstagramService.publishImagePost', () => {
  it('cria o container, aguarda ficar pronto e publica na sequência', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'FINISHED' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) } as Response);

    const mediaId = await InstagramService.publishImagePost(
      'https://example.com/foto.jpg',
      'legenda',
    );

    expect(mediaId).toBe('media-1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('/123456/media');
    expect(fetchMock.mock.calls[1][0]).toContain('/container-1?');
    expect(fetchMock.mock.calls[2][0]).toContain('/123456/media_publish');
  });

  it('aguarda o container sair de IN_PROGRESS antes de publicar', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'IN_PROGRESS' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'FINISHED' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) } as Response);
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setTimeout);

    const mediaId = await InstagramService.publishImagePost('https://example.com/foto.jpg');

    expect(mediaId).toBe('media-1');
  });

  it('lança AppError quando o container falha no processamento', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'container-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'ERROR' }),
      } as Response);

    await expect(InstagramService.publishImagePost('https://example.com/foto.jpg')).rejects.toThrow(
      /Processamento da mídia falhou/,
    );
  });

  it('lança AppError quando a Graph API retorna erro', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'URL de imagem inválida' } }),
    } as Response);

    await expect(InstagramService.publishImagePost('https://example.com/foto.jpg')).rejects.toThrow(
      /URL de imagem inválida/,
    );
  });

  it('lança AppError quando falta INSTAGRAM_ACCESS_TOKEN', async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;

    await expect(InstagramService.publishImagePost('https://example.com/foto.jpg')).rejects.toThrow(
      AppError,
    );
  });
});

describe('InstagramService.publishCarouselPost', () => {
  it('cria um container por item, agrupa em CAROUSEL e publica', async () => {
    // Os dois itens são criados via Promise.all, então as chamadas de fetch ficam
    // intercaladas por etapa (cria item1, cria item2, poll item1, poll item2), não
    // sequenciais por item — a ordem dos mocks abaixo segue essa intercalação real.
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'item-1' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'item-2' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'FINISHED' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'FINISHED' }),
      } as Response)
      // container pai CAROUSEL: cria + poll pronto + publica
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'carousel-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status_code: 'FINISHED' }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'media-1' }) } as Response);

    const mediaId = await InstagramService.publishCarouselPost(
      [
        { type: 'IMAGE', url: 'https://example.com/foto.jpg' },
        { type: 'VIDEO', url: 'https://example.com/video.mp4' },
      ],
      'legenda',
    );

    expect(mediaId).toBe('media-1');
    expect(fetchMock).toHaveBeenCalledTimes(7);

    const createItem1Body = fetchMock.mock.calls[0][1]?.body as string;
    expect(createItem1Body).toContain('is_carousel_item=true');
    expect(createItem1Body).toContain('image_url=');

    const createItem2Body = fetchMock.mock.calls[1][1]?.body as string;
    expect(createItem2Body).toContain('is_carousel_item=true');
    expect(createItem2Body).toContain('media_type=VIDEO');
    expect(createItem2Body).toContain('video_url=');

    const createParentBody = fetchMock.mock.calls[4][1]?.body as string;
    expect(createParentBody).toContain('media_type=CAROUSEL');
    expect(createParentBody).toContain('children=item-1%2Citem-2');
  });

  it('lança AppError quando menos de 2 itens são enviados', async () => {
    await expect(
      InstagramService.publishCarouselPost([{ type: 'IMAGE', url: 'https://example.com/foto.jpg' }]),
    ).rejects.toThrow(/entre 2 e 10 itens/);
  });

  it('lança AppError quando mais de 10 itens são enviados', async () => {
    const items = Array.from({ length: 11 }, (_, i) => ({
      type: 'IMAGE' as const,
      url: `https://example.com/foto-${i}.jpg`,
    }));

    await expect(InstagramService.publishCarouselPost(items)).rejects.toThrow(/entre 2 e 10 itens/);
  });
});
