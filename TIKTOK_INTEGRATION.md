# Integração com o TikTok (Content Posting API) — passo a passo

Este documento registra como a publicação automática no TikTok foi configurada neste projeto: o que foi feito no [TikTok for Developers](https://developers.tiktok.com), quais arquivos de código foram criados, e as pegadinhas que valem a pena lembrar antes de repetir o processo (ex.: aprovar um app novo, trocar de domínio, etc.).

## Visão geral

O fluxo usa a **Content Posting API** do TikTok via **Login Kit** (OAuth) + **PULL_FROM_URL** (o TikTok baixa a mídia direto de uma URL pública do nosso servidor, sem upload manual). O mesmo padrão já era usado com a Meta Graph API do Instagram — a ideia foi replicar a arquitetura.

```
GET  /auth/tiktok/login     → redireciona pro consentimento do TikTok
GET  /auth/tiktok/callback  → troca "code" por access_token/refresh_token
POST /publish               → publica no Instagram e, em seguida, no TikTok
```

Arquivos relevantes:

- `src/services/tiktok.service.ts` — toda a chamada de rede pro TikTok (OAuth + publicação de vídeo/foto)
- `src/controllers/tiktok-auth.controller.ts` + `src/routes/tiktok-auth.routes.ts` — fluxo OAuth
- `src/controllers/legal.controller.ts` + `src/routes/legal.routes.ts` — páginas de Termos de Uso e Política de Privacidade (exigidas pelo cadastro do app)
- `src/controllers/publish.controller.ts` — publica no TikTok logo depois do Instagram, sem derrubar o post se o TikTok falhar (`publishToTikTok`)
- `public/` — pasta servida na raiz do domínio, usada para hospedar os arquivos de verificação de propriedade de URL do TikTok

## 1. Criar o app no TikTok for Developers

1. Acesse [developers.tiktok.com](https://developers.tiktok.com) e crie uma conta de desenvolvedor.
2. Crie um novo app. Isso gera um **Client Key** e **Client Secret** — visíveis (mascarados, com botão de revelar) na aba "Credentials" da tela do app.
3. Adicione os produtos:
   - **Login Kit** (necessário pro fluxo OAuth)
   - **Content Posting API** (necessário pra publicar)
   - Dentro de Content Posting API, ative o toggle **Direct Post** — sem isso, o app só consegue subir vídeo como rascunho (`video.upload`), não publicar de fato (`video.publish`).

## 2. Preencher "Basic information"

Campos obrigatórios pra sair do estado "Draft":

| Campo                | Observação                                         |
| -------------------- | -------------------------------------------------- |
| App icon             | 1024×1024px, até 5MB                               |
| App name             | até 50 caracteres                                  |
| Category             | dropdown (usamos "Lifestyle")                      |
| Description          | até 120 caracteres                                 |
| Terms of Service URL | precisa ser uma página real acessível publicamente |
| Privacy Policy URL   | idem                                               |
| Platforms            | marcar "Web"                                       |
| Web/Desktop URL      | site oficial do app/serviço                        |

As URLs de Termos/Privacidade e o site oficial apontam pro próprio servidor deste projeto:
`https://<seu-domínio>/legal/terms`, `/legal/privacy` e a raiz `/` — implementadas em `legal.controller.ts`.

⚠️ **O formulário só salva quando TODOS os campos obrigatórios estão preenchidos de uma vez** (inclusive o vídeo de demonstração, ver seção 5). Preencher parcialmente e clicar "Save" não persiste nada — só existe validação client-side até então.

## 3. Verificação de propriedade de URL (obrigatório pro `PULL_FROM_URL`)

Nas telas de Basic Information (Terms/Privacy/Website) e em "Content Posting API → Verify domains", o TikTok exige provar posse do domínio usado. Método usado aqui: **URL prefix / signature file**.

1. Botão "URL properties" (canto superior direito da tela do app) → "Verify properties" → escolher **URL prefix**.
2. Informar o prefixo (ex.: `https://seu-dominio.com/`) → o TikTok gera um arquivo `.txt` (nome único, tipo `tiktokXXXXX.txt`) com conteúdo `tiktok-developers-site-verification=XXXXX`.
3. Baixar o arquivo e hospedá-lo **na raiz do domínio**, com o mesmo nome.
4. Clicar em "Verify".

No código, isso é servido por um `express.static` extra em `src/app.ts` apontando pra pasta `public/` (arquivos ali ficam disponíveis em `/<nome-do-arquivo>`, fora de `/assets`):

```ts
app.use(express.static(path.resolve(__dirname, '../public')));
```

⚠️ **Essa verificação NÃO é compartilhada entre Production e Sandbox** — são apps efetivamente diferentes (client_key diferente), cada um com sua própria lista de "URL properties". É preciso repetir o processo nos dois.

⚠️ **Domínio efêmero (ngrok grátis)**: enquanto o servidor for exposto via `ngrok http 3000` no plano gratuito, o domínio muda a cada reinício do túnel — invalidando a verificação e todas as URLs cadastradas (Terms, Privacy, Redirect URI, Website). Pra um cadastro definitivo, use um domínio fixo (ngrok com domínio estático pago, ou deploy real).

## 4. Configurar o Login Kit (Redirect URI)

Dentro de "Products → Login Kit → Redirect URI", cadastrar a URL exata do callback:

```
https://<seu-domínio>/auth/tiktok/callback
```

Regras: HTTPS obrigatório, até 512 caracteres, sem parâmetros dinâmicos nem `#`. Precisa bater **exatamente** com `TIKTOK_REDIRECT_URI` no `.env`.

## 5. Vídeo de demonstração + submissão pra revisão (Production)

A aba "App review" pede:

- Um texto (até 1000 caracteres) explicando como cada produto/scope é usado.
- Um vídeo (mp4/mov, até 50MB) mostrando o fluxo completo de ponta a ponta — nesse projeto, gravamos a tela mostrando `/auth/tiktok/login` → login → tela de consentimento → redirecionamento pro `/auth/tiktok/callback` com o token.

Como o app ainda não tinha sido aprovado, a doc do TikTok exige que essa demonstração use o ambiente **Sandbox** (ver seção 6).

⚠️ **Upload de arquivo via automação de navegador não funciona nesse formulário** (o campo não reage a eventos de `input[type=file]` disparados programaticamente — parece exigir interação real do usuário/drag-and-drop). Precisou ser feito manualmente, clicando direto no navegador.

Depois de tudo preenchido (incluindo ícone, vídeo, produtos, redirect URI), clicar em **Submit for review**, descrever o motivo da submissão (até 120 caracteres) e confirmar. O app entra em status **"In review"** — auditoria costuma levar de 5 a 10 dias úteis.

## 6. Ambiente Sandbox (testar antes da aprovação)

Cada app tem uma aba **Sandbox** separada da Production, com:

- **Client Key / Client Secret próprios** (diferentes da Production)
- Necessário repetir: Basic information, Products (Login Kit + Content Posting API + Direct Post), Redirect URI, **e a verificação de URL prefix** (é outro app, outra lista de propriedades verificadas)
- Uma seção extra, **Sandbox settings → Target Users**: só é possível testar publicação nas contas TikTok explicitamente autorizadas ali (clicar "Add account" → login na conta TikTok que vai ser usada pra teste).

Depois de preencher tudo, clicar em **Apply changes** (equivalente ao "Save" da Production).

### Restrição importante: apps não auditados só publicam em conta privada

Tentar publicar com um client_key não auditado — mesmo com `privacy_level: "SELF_ONLY"` no payload — retorna:

```json
{ "error": { "code": "unaudited_client_can_only_post_to_private_accounts" } }
```

Isso não é sobre o nível de privacidade do _post_, é sobre a **conta TikTok em si**: ela precisa estar marcada como conta privada (TikTok app → Configurações e privacidade → Privacidade → "Conta Privada" → ativar). Enquanto o app não passa por auditoria, essa é uma exigência da plataforma, não uma escolha nossa — e vale tanto pro Sandbox quanto pro Production ainda não aprovado.

Depois que o Production for aprovado, a conta pode voltar a ser pública e os posts podem usar `privacy_level: "PUBLIC_TO_EVERYONE"`.

## 7. Fluxo OAuth (obter o access token)

Implementado em `tiktok.service.ts` + `tiktok-auth.controller.ts`, seguindo a doc oficial (`https://developers.tiktok.com/doc/oauth-user-access-token-management`):

1. `GET /auth/tiktok/login` — gera um `state` aleatório (CSRF, guardado em memória) e redireciona pra:
   `https://www.tiktok.com/v2/auth/authorize/?client_key=...&response_type=code&scope=user.info.basic,video.publish&redirect_uri=...&state=...`
2. Usuário loga e autoriza no TikTok.
3. TikTok redireciona pro `redirect_uri` com `?code=...&state=...`.
4. `GET /auth/tiktok/callback` valida o `state`, troca o `code` por token via `POST https://open.tiktokapis.com/v2/oauth/token/` (client_key/secret no body, `grant_type=authorization_code`), e devolve o token na resposta JSON.
5. **O token não é salvo automaticamente** — é preciso copiar `accessToken` da resposta pra `TIKTOK_ACCESS_TOKEN` no `.env` e reiniciar o servidor.

O token dura 24h (`expiresIn: 86400`); há também um `refreshToken` de longa duração, mas `TikTokService.refreshAccessToken()` (implementado, não usado automaticamente ainda) precisaria ser plugado numa rotina de renovação se o projeto for rodar por muito tempo sem reautenticação manual.

## 8. Publicar vídeo ou foto

Dois endpoints diferentes na Content Posting API, ambos via `PULL_FROM_URL` (o servidor só precisa hospedar a mídia publicamente, o TikTok busca sozinho):

- **Vídeo**: `POST /v2/post/publish/video/init/` → `TikTokService.publishVideo(videoUrl, caption)`
- **Foto / carrossel de fotos**: `POST /v2/post/publish/content/init/` com `media_type: "PHOTO"`, `post_mode: "DIRECT_POST"`, `photo_images: [...]` (até 35 imagens) → `TikTokService.publishPhoto(images, caption)`

Ambos retornam um `publish_id`, que é consultado em `POST /v2/post/publish/status/fetch/` até sair de `PROCESSING_*` (sucesso = `PUBLISH_COMPLETE`).

Limites da API: vídeo até 4GB/10min; imagem até 20MB cada; a URL da mídia precisa ficar acessível por até 1h após o início do download.

⚠️ **A mídia tem que estar num domínio verificado neste app do TikTok** (URL
properties → URL prefix, seção 3). O TikTok recusa `PULL_FROM_URL` de qualquer
outro host com `Please review our URL ownership verification rules`. Na prática:
o `POST /publish` só serve TikTok quando a mídia entra por **upload multipart**
(o serviço salva em `assets/generated/` e monta a URL no **próprio host** — o
domínio ngrok/deploy que está verificado). Passar uma URL externa em `media[]`
(ex.: Firebase Hosting) funciona pro Instagram/Facebook mas **quebra o TikTok**.

## 9. Integração com `/publish`

Toda vez que um post é publicado no Instagram, o mesmo conteúdo é automaticamente publicado no TikTok em seguida (lógica em `publish.controller.ts`, função `publishToTikTok`):

| Mídia (`items`)     | Instagram      | TikTok                                                                       |
| ------------------- | -------------- | ---------------------------------------------------------------------------- |
| 1 imagem            | Post de imagem | Foto única                                                                   |
| 1 vídeo             | Reels          | Vídeo                                                                        |
| 2+ imagens          | Carrossel      | Carrossel de fotos                                                           |
| carrossel com vídeo | Carrossel      | **Pulado** (`tiktokStatus: "skipped"`) — a API do TikTok não tem equivalente |

Se a publicação no TikTok falhar por qualquer motivo, o post **continua marcado como `published`** (porque o Instagram já deu certo) — o erro fica registrado em `tiktokError`, sem derrubar a resposta. Ou seja, TikTok é sempre "melhor esforço", nunca bloqueia o Instagram.

Resposta de exemplo:

```json
{
  "success": true,
  "data": {
    "status": "published",
    "instagramMediaId": "18095120285373810",
    "tiktokPublishId": "p_pub_url~v2.7674475075214706709",
    "tiktokStatus": "published"
  }
}
```

## 10. Variáveis de ambiente (`.env`)

```
TIKTOK_CLIENT_KEY=            # Client Key do app (Production ou Sandbox, conforme ambiente ativo)
TIKTOK_CLIENT_SECRET=         # Client Secret correspondente
TIKTOK_REDIRECT_URI=          # precisa bater com o cadastrado no Login Kit
TIKTOK_SCOPES=user.info.basic,video.publish
TIKTOK_ACCESS_TOKEN=          # gerado via /auth/tiktok/login, copiado manualmente
TIKTOK_PRIVACY_LEVEL=SELF_ONLY   # trocar pra PUBLIC_TO_EVERYONE só depois do app aprovado
```

## 11. Checklist pra quando o Production for aprovado

- [ ] Trocar `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` pelas credenciais de **Production** (não Sandbox)
- [ ] Refazer o login OAuth pra gerar um `TIKTOK_ACCESS_TOKEN` novo com o client_key de Production
- [ ] Trocar `TIKTOK_PRIVACY_LEVEL` pra `PUBLIC_TO_EVERYONE` (ou o nível desejado)
- [ ] Voltar a conta TikTok pra pública (Configurações → Privacidade → desativar "Conta Privada")
- [ ] Garantir domínio fixo (não depender mais de ngrok efêmero) antes de reverificar URL properties em Production, se o domínio tiver mudado desde a submissão
