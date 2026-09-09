import { Request, Response } from 'express';

// Serviço multi-projeto — nome neutro, sobrescrevível por ambiente. Aparece nas
// páginas de Termos/Privacidade que os revisores das plataformas (TikTok) leem.
const ENTITY = process.env.LEGAL_ENTITY_NAME ?? 'Content Publisher';

const PAGE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  footer { margin-top: 3rem; font-size: 0.85rem; color: #666; }
`;

function renderPage(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
${bodyHtml}
<footer>Última atualização: agosto de 2026</footer>
</body>
</html>`;
}

class LegalController {
  public terms(req: Request, res: Response): void {
    res.type('html').send(
      renderPage(
        `Termos de Uso — ${ENTITY}`,
        `
  <h1>Termos de Uso — ${ENTITY}</h1>
  <p>Estes Termos de Uso regem o uso da integração de publicação de conteúdo do ${ENTITY} ("o Serviço"), uma ferramenta que permite publicar automaticamente fotos, vídeos e carrosséis nas contas de redes sociais (Instagram, Facebook e TikTok) autorizadas pelo próprio titular da conta.</p>

  <h2>1. Aceitação dos termos</h2>
  <p>Ao autorizar o Serviço a acessar sua conta de rede social, você concorda com estes Termos de Uso e com a Política de Privacidade correspondente.</p>

  <h2>2. Descrição do serviço</h2>
  <p>O Serviço conecta-se às APIs oficiais do Instagram e do Facebook (Meta Graph API) e do TikTok (Content Posting API) para publicar, em nome do titular autorizado, conteúdo previamente definido por ele mesmo. O Serviço não publica conteúdo em contas de terceiros nem sem autorização explícita via OAuth.</p>

  <h2>3. Uso permitido</h2>
  <p>O Serviço destina-se exclusivamente à publicação de conteúdo próprio, autorizado pelo titular da conta. É proibido usar o Serviço para publicar conteúdo que viole as diretrizes de comunidade do Instagram ou do TikTok, direitos autorais de terceiros, ou legislação aplicável.</p>

  <h2>4. Responsabilidades do usuário</h2>
  <p>O titular da conta é responsável pelo conteúdo publicado através do Serviço, pela manutenção da confidencialidade de suas credenciais e tokens de acesso, e por revogar o acesso do Serviço caso deixe de utilizá-lo (via configurações de apps conectados do Instagram/TikTok).</p>

  <h2>5. Limitação de responsabilidade</h2>
  <p>O Serviço é fornecido "como está", sem garantias de disponibilidade contínua. Não nos responsabilizamos por indisponibilidade, alterações ou interrupções nas APIs de terceiros (Meta, TikTok) que estejam fora do nosso controle.</p>

  <h2>6. Alterações nos termos</h2>
  <p>Estes termos podem ser atualizados periodicamente. A versão vigente estará sempre disponível nesta URL.</p>

  <h2>7. Contato</h2>
  <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:edneifneto@gmail.com">edneifneto@gmail.com</a>.</p>
`,
      ),
    );
  }

  public privacy(req: Request, res: Response): void {
    res.type('html').send(
      renderPage(
        `Política de Privacidade — ${ENTITY}`,
        `
  <h1>Política de Privacidade — ${ENTITY}</h1>
  <p>Esta Política de Privacidade explica como a integração de publicação de conteúdo do ${ENTITY} ("o Serviço") trata dados ao se conectar com o Instagram, o Facebook e o TikTok em nome do titular da conta autorizada.</p>

  <h2>1. Quem somos</h2>
  <p>O Serviço é operado como uma ferramenta pessoal/interna de automação de publicação de conteúdo, de responsabilidade de <a href="mailto:edneifneto@gmail.com">edneifneto@gmail.com</a>.</p>

  <h2>2. Quais dados tratamos</h2>
  <ul>
    <li><strong>Tokens de acesso OAuth</strong> das contas de Instagram, Facebook e TikTok autorizadas, usados exclusivamente para publicar conteúdo em nome do titular.</li>
    <li><strong>Conteúdo de mídia</strong> (imagens, vídeos e legendas) fornecido pelo próprio titular para publicação.</li>
    <li><strong>Metadados de publicação</strong>, como identificadores de mídia retornados pelas APIs após a publicação (ex.: ID do post publicado).</li>
  </ul>
  <p>O Serviço não coleta dados de outros usuários do Instagram, do Facebook ou do TikTok (seguidores, curtidas, comentários de terceiros etc.) além do necessário para confirmar que uma publicação foi concluída.</p>

  <h2>3. Como usamos os dados</h2>
  <p>Os dados são usados exclusivamente para autenticar a conta junto às APIs oficiais (Meta Graph API e TikTok Content Posting API) e executar a publicação de conteúdo solicitada pelo próprio titular. Não usamos os dados para publicidade, perfilamento ou qualquer finalidade além da publicação solicitada.</p>

  <h2>4. Compartilhamento de dados</h2>
  <p>Os dados são compartilhados apenas com as plataformas Meta (Instagram e Facebook) e TikTok, na medida necessária para realizar a publicação — não vendemos, alugamos nem compartilhamos dados com nenhum outro terceiro.</p>

  <h2>5. Armazenamento e segurança</h2>
  <p>Tokens de acesso são armazenados localmente em variáveis de ambiente do servidor que executa o Serviço, não em um banco de dados externo ou serviço de terceiros. O acesso ao servidor é restrito ao titular do Serviço.</p>

  <h2>6. Seus direitos</h2>
  <p>Você pode revogar o acesso do Serviço à sua conta a qualquer momento, diretamente nas configurações de "Apps Conectados" do Instagram ou do TikTok. Após a revogação, o Serviço deixa de conseguir publicar em seu nome.</p>

  <h2>7. Contato</h2>
  <p>Dúvidas sobre esta política podem ser enviadas para <a href="mailto:edneifneto@gmail.com">edneifneto@gmail.com</a>.</p>
`,
      ),
    );
  }
}

export default new LegalController();
