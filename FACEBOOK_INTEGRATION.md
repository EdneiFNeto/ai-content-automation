# Publicação na Página do Facebook

Registro de como ligar o `POST /publish` numa Página do Facebook. Igual ao
padrão do TikTok: uma publicação secundária depois do Instagram, isolada em
`src/services/facebook.service.ts`, que **nunca derruba** o post do Instagram.

## Como funciona no código

```
POST /publish
  → Instagram (obrigatório)
  → Promise.all([ TikTok, Facebook ])   ← cada um não-fatal
```

`publishToFacebook` em `publish.controller.ts` decide pelo tipo de mídia:

| Mídia          | Chamada                                                 | Endpoint Graph                                                                           |
| -------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1 imagem       | `FacebookService.publishPhotos([url])` → `publishPhoto` | `POST /{page-id}/photos` (`published=true`)                                              |
| 2+ imagens     | `FacebookService.publishPhotos(urls)`                   | cada foto `published=false&temporary=true` → `POST /{page-id}/feed` com `attached_media` |
| 1 vídeo        | `FacebookService.publishVideo(url)`                     | `POST /{page-id}/videos` (`file_url`)                                                    |
| vídeo + imagem | —                                                       | `skipped`                                                                                |

Resultado na resposta: `facebookStatus` (`published`/`skipped`/`failed`),
`facebookPostId`, `facebookError`. Sem credenciais → `skipped`, sem nem chamar
a API.

## Credenciais (`.env`)

```
FACEBOOK_PAGE_ID=              # id numérico da Página
FACEBOOK_PAGE_ACCESS_TOKEN=    # Page Access Token com pages_manage_posts
FB_GRAPH_API_VERSION=          # opcional (default: GRAPH_API_VERSION ou v21.0)
```

O token é de **Página** (`EAAB…`), diferente do `IGAA…` do Instagram — vem de um
app do Facebook via Facebook Login, não do fluxo Instagram Login.

## Como pegar o token (app em modo dev, sem App Review)

> Se a Página for "New Pages Experience" (toda Página nova é), este passo a passo
> **não basta** — `GET /me/accounts` volta vazio. Vá direto pra seção
> **"Pegadinha grande: Página NPE"** abaixo.

Enquanto o app do Facebook estiver **em modo de desenvolvimento**, quem é
**admin/dev/tester do app E admin da Página** consegue publicar com
`pages_manage_posts` **sem App Review**.

1. **App do Facebook** — reaproveitar o app que já existe
   (`developers.facebook.com/apps`). Adicionar o produto **"Facebook Login"** /
   um caso de uso que peça `pages_show_list`, `pages_read_engagement`,
   `pages_manage_posts`.
2. **Graph API Explorer** — `developers.facebook.com/tools/explorer`:
   - selecionar o app no topo
   - "User or Page" → **Get Page Access Token** → escolher a Página
   - marcar as permissões `pages_show_list`, `pages_manage_posts`,
     `pages_read_engagement`
   - "Generate Access Token" → copiar (é um token de usuário curto)
3. **Page ID** — na mesma tela, `GET /me/accounts` lista as Páginas com `id` +
   `access_token` (esse `access_token` é o **de Página**, use ele).
4. **Token de longa duração** — trocar o token curto:
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
       ?grant_type=fb_exchange_token
       &client_id={app-id}&client_secret={app-secret}
       &fb_exchange_token={token-curto}
   ```
   e então `GET /me/accounts` de novo com o token longo → o `access_token` de
   Página que sai daí **não expira** (enquanto o token de usuário longo valer).
5. Colar `FACEBOOK_PAGE_ID` + `FACEBOOK_PAGE_ACCESS_TOKEN` no `.env`, reiniciar.

## Pegadinha grande: Página "New Pages Experience" (NPE)

Páginas criadas hoje são NPE. Sintoma: com um token de usuário comum,
`GET /me/accounts` volta **vazio**, `POST /{page-id}/feed` dá
`(#200) requires ... as an admin with sufficient administrative permission`, e
`debug_token` diz `type: USER` mesmo pra token "de Página". A Página não
"existe" pra Graph API até estar num **Portfólio empresarial**.

Caminho que funcionou (conta `AI GameCraft`, app `AI GameCraft Publisher`):

1. `business.facebook.com` → criar um **Portfólio empresarial**.
2. Business Settings → **Contas → Páginas → Adicionar → "Adicionar uma Página
   do Facebook existente"** → a Página entra no portfólio com você em
   "Acesso total". (Se o buscador não achar pela URL/ID, tente o nome; a Página
   precisa aparecer como sua no `facebook.com/pages/?category=your_pages`.)
3. Graph API Explorer → app correto → permissões `pages_show_list`,
   `pages_read_engagement`, `pages_manage_posts`, **`business_management`** →
   **Generate Access Token** → no popup, opt-in no portfólio + marcar a Página.
4. Agora `GET /me/accounts` lista a Página com `access_token` e
   `tasks: [MANAGE, CREATE_CONTENT, ...]`. Esse `access_token` é o de Página;
   `debug_token` nele diz `type: PAGE`. É o que vai no `.env`.

⚠️ O **Page ID real** (o que vai em `FACEBOOK_PAGE_ID`) é o `id` que sai em
`/me/accounts` — **não** o `id` que `GET /me` devolve com o token de Página
(esse é o `profile_id`/`user_id` interno). No nosso caso: real
`1264172443452271`, não `122113614105326158`.

## Pegadinhas

- **Página ligada ao Instagram** não é obrigatório pro post no Facebook (é só
  pro Instagram). Mas se você quiser um dia unificar tudo num token só, é o
  fluxo Facebook Login com a Página vinculada — outra refatoração.
- **`file_url` de vídeo** — a Página baixa o vídeo da URL; vale a mesma exigência
  de URL pública (ngrok / Firebase Hosting / storage).
- **Vídeo processa async** no Facebook também; `POST /{page-id}/videos` devolve
  o `id` na hora, mas o vídeo pode levar minutos pra aparecer publicado.
- **Publicar fora do modo dev** (qualquer admin da Página, não só os do app) →
  aí sim precisa de **App Review** pra `pages_manage_posts` + "Business
  Verification".

## Testes

`src/services/facebook.service.test.ts` (mock de `fetch`) +
`src/routes/publish.routes.test.ts` (mock do `FacebookService`, casos
`skipped`/`published`/`failed`). Nunca bate na Graph API real.
