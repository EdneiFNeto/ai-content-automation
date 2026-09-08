import { AppError } from '../errors/app-error';
import { FeedPostResponse, GraphApiErrorBody, PhotoUploadResponse } from '../types/facebook.types';

/**
 * Publica numa **Página do Facebook** via Graph API (`graph.facebook.com`), com
 * um Page Access Token (`pages_manage_posts`). Independente do fluxo do
 * Instagram — token e host próprios.
 *
 * Sem `FACEBOOK_PAGE_ID` / `FACEBOOK_PAGE_ACCESS_TOKEN` o serviço fica
 * `isConfigured === false` e o `publish.controller` marca o Facebook como
 * `skipped` (não é erro — é opcional).
 */
class FacebookService {
  get isConfigured(): boolean {
    return Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN);
  }

  private get pageId(): string {
    const id = process.env.FACEBOOK_PAGE_ID;
    if (!id) throw new AppError('FACEBOOK_PAGE_ID não configurado no servidor', 500);
    return id;
  }

  private get accessToken(): string {
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    if (!token) throw new AppError('FACEBOOK_PAGE_ACCESS_TOKEN não configurado no servidor', 500);
    return token;
  }

  private get apiBaseUrl(): string {
    const version = process.env.FB_GRAPH_API_VERSION || process.env.GRAPH_API_VERSION || 'v21.0';
    return `https://graph.facebook.com/${version}`;
  }

  private async post<T>(edge: string, fields: Record<string, string>): Promise<T> {
    const params = new URLSearchParams({ ...fields, access_token: this.accessToken });
    const res = await fetch(`${this.apiBaseUrl}/${edge}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const body = (await res.json()) as T & GraphApiErrorBody;
    if (!res.ok || (body as GraphApiErrorBody).error) {
      throw new AppError(
        `Facebook: ${(body as GraphApiErrorBody).error?.message ?? res.statusText}`,
        502,
      );
    }
    return body as T;
  }

  /** Uma foto → post no feed da Página. Devolve o id do post. */
  public async publishPhoto(imageUrl: string, message: string): Promise<string> {
    const body = await this.post<PhotoUploadResponse>(`${this.pageId}/photos`, {
      url: imageUrl,
      message,
      published: 'true',
    });
    return body.post_id ?? body.id;
  }

  /** Várias fotos → um único post no feed com todas anexadas. */
  public async publishPhotos(imageUrls: string[], message: string): Promise<string> {
    if (imageUrls.length < 2) return this.publishPhoto(imageUrls[0], message);

    const fbids = await Promise.all(
      imageUrls.map(async (url) => {
        const body = await this.post<PhotoUploadResponse>(`${this.pageId}/photos`, {
          url,
          published: 'false',
          temporary: 'true',
        });
        return body.id;
      }),
    );

    const attached: Record<string, string> = { message };
    fbids.forEach((fbid, i) => {
      attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: fbid });
    });

    const body = await this.post<FeedPostResponse>(`${this.pageId}/feed`, attached);
    return body.id;
  }

  /** Um vídeo → post de vídeo na Página. Devolve o id do vídeo. */
  public async publishVideo(videoUrl: string, description: string): Promise<string> {
    const body = await this.post<FeedPostResponse>(`${this.pageId}/videos`, {
      file_url: videoUrl,
      description,
    });
    return body.id;
  }
}

export default new FacebookService();
