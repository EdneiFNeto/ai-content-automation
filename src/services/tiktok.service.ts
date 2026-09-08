import { AppError } from '../errors/app-error';
import {
  InitVideoPublishResponse,
  OAuthTokenResponse,
  PublishStatusResponse,
  TikTokApiErrorBody,
  TikTokPublishStatus,
} from '../types/tiktok.types';

const STATUS_POLL_MAX_ATTEMPTS = 30;
const STATUS_POLL_DELAY_MS = 5000;
const API_BASE_URL = 'https://open.tiktokapis.com/v2';
const TERMINAL_STATUSES: TikTokPublishStatus[] = [
  'PUBLISH_COMPLETE',
  'FAILED',
  'SEND_TO_USER_INBOX',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Content Posting API do TikTok: publicar exige um app auditado pelo TikTok
// (revisão que pode levar dias/semanas). Enquanto o app não for auditado,
// só é permitido usar privacy_level=SELF_ONLY — o vídeo vai pra caixa de
// rascunhos do próprio criador dentro do app TikTok, não pro feed público.
// Esse serviço já implementa o fluxo real da API; falta apenas o token OAuth
// (TIKTOK_ACCESS_TOKEN) gerado depois que o app for aprovado.
class TikTokService {
  private get accessToken(): string {
    const token = process.env.TIKTOK_ACCESS_TOKEN;

    if (!token) {
      throw new AppError('TIKTOK_ACCESS_TOKEN não configurado no servidor', 500);
    }

    return token;
  }

  private get authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  private get privacyLevel(): string {
    return process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';
  }

  private get clientKey(): string {
    const key = process.env.TIKTOK_CLIENT_KEY;

    if (!key) {
      throw new AppError('TIKTOK_CLIENT_KEY não configurado no servidor', 500);
    }

    return key;
  }

  private get clientSecret(): string {
    const secret = process.env.TIKTOK_CLIENT_SECRET;

    if (!secret) {
      throw new AppError('TIKTOK_CLIENT_SECRET não configurado no servidor', 500);
    }

    return secret;
  }

  private get redirectUri(): string {
    const uri = process.env.TIKTOK_REDIRECT_URI;

    if (!uri) {
      throw new AppError('TIKTOK_REDIRECT_URI não configurado no servidor', 500);
    }

    return uri;
  }

  // Monta a URL de autorização do Login Kit (OAuth v2) — o "state" é gerado
  // e validado por quem chama (ver TikTokAuthController) para prevenir CSRF.
  public getAuthorizationUrl(state: string): string {
    const scopes = process.env.TIKTOK_SCOPES || 'user.info.basic,video.publish';
    const params = new URLSearchParams({
      client_key: this.clientKey,
      response_type: 'code',
      scope: scopes,
      redirect_uri: this.redirectUri,
      state,
    });

    return `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  }

  // Endpoint de token não usa Bearer — client_key/client_secret vão no body,
  // igual troca de code quanto refresh (mesmo endpoint, grant_type diferente)
  private async requestToken(params: Record<string, string>): Promise<OAuthTokenResponse> {
    const response = await fetch(`${API_BASE_URL}/oauth/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams(params).toString(),
    });

    const body = (await response.json()) as OAuthTokenResponse & TikTokApiErrorBody;

    if (!response.ok || !body.access_token) {
      throw new AppError(
        `Falha ao obter token do TikTok: ${body.error?.message ?? response.statusText}`,
        502,
      );
    }

    return body;
  }

  public async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    return this.requestToken({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.redirectUri,
    });
  }

  public async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    return this.requestToken({
      client_key: this.clientKey,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  // PULL_FROM_URL: o TikTok busca o vídeo direto da URL pública informada,
  // mesma restrição de URL pública já usada no Instagram — não precisa fazer
  // upload em chunks a partir do servidor.
  private async initVideoPublish(videoUrl: string, caption?: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/post/publish/video/init/`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({
        post_info: {
          title: caption ?? '',
          privacy_level: this.privacyLevel,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    });

    const body = (await response.json()) as InitVideoPublishResponse & TikTokApiErrorBody;

    if (!response.ok || !body.data?.publish_id) {
      throw new AppError(
        `Falha ao iniciar publicação de vídeo no TikTok: ${body.error?.message ?? response.statusText}`,
        502,
      );
    }

    return body.data.publish_id;
  }

  // O TikTok processa download + publicação de forma assíncrona; é preciso
  // consultar o status até sair de PROCESSING_* — mesmo padrão de polling
  // usado em InstagramService.waitForContainerReady.
  private async waitForPublishComplete(
    publishId: string,
    maxAttempts: number = STATUS_POLL_MAX_ATTEMPTS,
    delayMs: number = STATUS_POLL_DELAY_MS,
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(`${API_BASE_URL}/post/publish/status/fetch/`, {
        method: 'POST',
        headers: this.authHeaders,
        body: JSON.stringify({ publish_id: publishId }),
      });

      const body = (await response.json()) as PublishStatusResponse & TikTokApiErrorBody;

      if (!response.ok) {
        throw new AppError(
          `Falha ao consultar status da publicação no TikTok: ${body.error?.message ?? response.statusText}`,
          502,
        );
      }

      const status = body.data?.status;

      if (status && TERMINAL_STATUSES.includes(status)) {
        if (status === 'FAILED') {
          throw new AppError(
            `Publicação falhou no TikTok: ${body.data?.fail_reason ?? 'motivo desconhecido'}`,
            502,
          );
        }
        return;
      }

      await sleep(delayMs);
    }

    throw new AppError('Tempo esgotado aguardando o processamento do vídeo no TikTok', 504);
  }

  public async publishVideo(videoUrl: string, caption?: string): Promise<string> {
    const publishId = await this.initVideoPublish(videoUrl, caption);
    await this.waitForPublishComplete(publishId);
    return publishId;
  }

  // Endpoint separado do de vídeo — content/init com media_type=PHOTO cobre
  // tanto uma foto única quanto carrossel (até 35 imagens), sempre via
  // PULL_FROM_URL. photo_cover_index define qual imagem aparece como capa.
  private async initPhotoPublish(
    images: string[],
    caption?: string,
    coverIndex = 0,
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/post/publish/content/init/`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({
        media_type: 'PHOTO',
        post_mode: 'DIRECT_POST',
        post_info: {
          title: caption ?? '',
          privacy_level: this.privacyLevel,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          photo_images: images,
          photo_cover_index: coverIndex,
        },
      }),
    });

    const body = (await response.json()) as InitVideoPublishResponse & TikTokApiErrorBody;

    if (!response.ok || !body.data?.publish_id) {
      throw new AppError(
        `Falha ao iniciar publicação de foto no TikTok: ${body.error?.message ?? response.statusText}`,
        502,
      );
    }

    return body.data.publish_id;
  }

  public async publishPhoto(images: string[], caption?: string): Promise<string> {
    if (images.length < 1 || images.length > 35) {
      throw new AppError('"images" precisa ter entre 1 e 35 itens', 400);
    }

    const publishId = await this.initPhotoPublish(images, caption);
    await this.waitForPublishComplete(publishId);
    return publishId;
  }
}

export default new TikTokService();
