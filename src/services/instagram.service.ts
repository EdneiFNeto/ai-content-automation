import { AppError } from '../errors/app-error';
import {
  CreateMediaContainerResponse,
  GraphApiErrorBody,
  MediaContainerStatusResponse,
  PublishMediaResponse,
} from '../types/instagram.types';

interface CreateMediaContainerParams {
  imageUrl: string;
  caption?: string;
}

const CONTAINER_POLL_MAX_ATTEMPTS = 10;
const CONTAINER_POLL_DELAY_MS = 2000;

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

  private async createMediaContainer({
    imageUrl,
    caption,
  }: CreateMediaContainerParams): Promise<string> {
    const params = new URLSearchParams({
      image_url: imageUrl,
      access_token: this.accessToken,
    });

    if (caption) {
      params.set('caption', caption);
    }

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
  private async waitForContainerReady(creationId: string): Promise<void> {
    const params = new URLSearchParams({
      fields: 'status_code',
      access_token: this.accessToken,
    });

    for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt += 1) {
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

      await sleep(CONTAINER_POLL_DELAY_MS);
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
    const creationId = await this.createMediaContainer({ imageUrl, caption });
    await this.waitForContainerReady(creationId);
    return this.publishMediaContainer(creationId);
  }
}

export default new InstagramService();
