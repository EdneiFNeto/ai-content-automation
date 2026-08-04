import { AppError } from '../errors/app-error';
import {
  CreateMediaContainerResponse,
  GraphApiErrorBody,
  MediaContainerStatusResponse,
  PublishMediaResponse,
} from '../types/instagram.types';

const CONTAINER_POLL_MAX_ATTEMPTS = 10;
const CONTAINER_POLL_DELAY_MS = 2000;

// Vídeo/Reel demora bem mais que imagem para o Instagram processar o container
const REEL_POLL_MAX_ATTEMPTS = 30;
const REEL_POLL_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class InstagramService {
  private get accessToken(): string {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!token) {
      throw new AppError('INSTAGRAM_ACCESS_TOKEN não configurado no servidor', 500);
    }

    return token;
  }

  private get businessAccountId(): string {
    const id = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!id) {
      throw new AppError('INSTAGRAM_BUSINESS_ACCOUNT_ID não configurado no servidor', 500);
    }

    return id;
  }

  // Token no formato "IGAA..." é da Instagram API direta (Instagram Login),
  // que atende em graph.instagram.com — não em graph.facebook.com (tokens de Página do Facebook)
  private get apiBaseUrl(): string {
    const version = process.env.GRAPH_API_VERSION || 'v21.0';
    return `https://graph.instagram.com/${version}`;
  }

  private async createMediaContainer(fields: Record<string, string>): Promise<string> {
    const params = new URLSearchParams({
      ...fields,
      access_token: this.accessToken,
    });

    const response = await fetch(`${this.apiBaseUrl}/${this.businessAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const body = (await response.json()) as CreateMediaContainerResponse & GraphApiErrorBody;

    if (!response.ok || !body.id) {
      throw new AppError(
        `Falha ao criar container de mídia no Instagram: ${body.error?.message ?? response.statusText}`,
        502,
      );
    }

    return body.id;
  }

  // O container leva um tempo para processar a imagem; media_publish antes disso
  // falha com "Media ID is not available", então é preciso aguardar status_code === 'FINISHED'
  private async waitForContainerReady(
    creationId: string,
    maxAttempts: number = CONTAINER_POLL_MAX_ATTEMPTS,
    delayMs: number = CONTAINER_POLL_DELAY_MS,
  ): Promise<void> {
    const params = new URLSearchParams({
      fields: 'status_code',
      access_token: this.accessToken,
    });

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(`${this.apiBaseUrl}/${creationId}?${params.toString()}`);
      const body = (await response.json()) as MediaContainerStatusResponse & GraphApiErrorBody;

      if (!response.ok) {
        throw new AppError(
          `Falha ao consultar status do container de mídia: ${body.error?.message ?? response.statusText}`,
          502,
        );
      }

      if (body.status_code === 'FINISHED') {
        return;
      }

      if (body.status_code === 'ERROR' || body.status_code === 'EXPIRED') {
        throw new AppError(
          `Processamento da mídia falhou no Instagram (status: ${body.status_code})`,
          502,
        );
      }

      await sleep(delayMs);
    }

    throw new AppError('Tempo esgotado aguardando o processamento da mídia no Instagram', 504);
  }

  private async publishMediaContainer(creationId: string): Promise<string> {
    const params = new URLSearchParams({
      creation_id: creationId,
      access_token: this.accessToken,
    });

    const response = await fetch(`${this.apiBaseUrl}/${this.businessAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const body = (await response.json()) as PublishMediaResponse & GraphApiErrorBody;

    if (!response.ok || !body.id) {
      throw new AppError(
        `Falha ao publicar mídia no Instagram: ${body.error?.message ?? response.statusText}`,
        502,
      );
    }

    return body.id;
  }

  // Fluxo em duas etapas da Instagram Graph API: cria o container e depois publica
  public async publishImagePost(imageUrl: string, caption?: string): Promise<string> {
    const creationId = await this.createMediaContainer({
      image_url: imageUrl,
      ...(caption ? { caption } : {}),
    });
    await this.waitForContainerReady(creationId);
    return this.publishMediaContainer(creationId);
  }

  // media_type=REELS é o único caminho de vídeo suportado hoje pela Graph API
  // (vídeo de feed "clássico" foi unificado em Reels) — mesmo fluxo de container,
  // mas com polling mais longo pois o processamento de vídeo demora mais
  public async publishReel(videoUrl: string, caption?: string): Promise<string> {
    const creationId = await this.createMediaContainer({
      media_type: 'REELS',
      video_url: videoUrl,
      ...(caption ? { caption } : {}),
    });
    await this.waitForContainerReady(creationId, REEL_POLL_MAX_ATTEMPTS, REEL_POLL_DELAY_MS);
    return this.publishMediaContainer(creationId);
  }
}

export default new InstagramService();
