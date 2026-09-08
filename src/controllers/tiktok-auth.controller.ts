import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import TikTokService from '../services/tiktok.service';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../errors/app-error';

// Estado de CSRF guardado em memória — suficiente para um app de um usuário só.
// Se o servidor reiniciar entre /login e /callback, o state se perde e é
// preciso refazer o login (mesmo limite do armazenamento em memória de PostsService).
let pendingState: string | undefined;

class TikTokAuthController {
  // Redireciona pro consentimento do TikTok. Sem asyncHandler porque não há
  // await aqui — se TIKTOK_CLIENT_KEY faltar, o getter lança AppError de forma
  // síncrona, e o Express 4 já encaminha exceções síncronas pro error handler.
  public login(req: Request, res: Response): void {
    pendingState = randomUUID();
    res.redirect(TikTokService.getAuthorizationUrl(pendingState));
  }

  // O TikTok redireciona o navegador do usuário pra cá com ?code=...&state=...
  // após o consentimento. Trocamos o code por token e devolvemos na resposta —
  // não há persistência automática (mesmo padrão manual do INSTAGRAM_ACCESS_TOKEN):
  // quem estiver rodando esse fluxo copia o accessToken pro .env.
  public async callback(req: Request, res: Response): Promise<void> {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
      throw new AppError(`TikTok recusou a autorização: ${errorDescription ?? error}`, 400);
    }

    if (!code || typeof code !== 'string') {
      throw new AppError('Parâmetro "code" ausente no callback do TikTok', 400);
    }

    if (!state || state !== pendingState) {
      throw new AppError(
        'Parâmetro "state" inválido ou expirado — refaça o login em /auth/tiktok/login',
        400,
      );
    }

    pendingState = undefined;

    const token = await TikTokService.exchangeCodeForToken(code);

    sendSuccess(res, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      scope: token.scope,
      message:
        'Copie "accessToken" para TIKTOK_ACCESS_TOKEN no .env — este token não é salvo automaticamente pelo servidor.',
    });
  }
}

export default new TikTokAuthController();
