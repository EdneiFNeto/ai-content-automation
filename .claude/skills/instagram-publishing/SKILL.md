---
name: instagram-publishing
description: Use ao mexer em publicação no Instagram, integração com Meta/Graph API, credenciais do Instagram, ou no fluxo de publish de posts. Acionar em pedidos como "publica no Instagram", "configura o token da Meta", "por que a publicação falhou".
---

# Publicação no Instagram (Instagram API / Instagram Login)

Este projeto usa a **Instagram API com Instagram Login** (não o fluxo antigo via Facebook Login/Página). Sinal de qual fluxo está em uso: o token de acesso começa com `IGAA...`. Esse tipo de token atende em **`graph.instagram.com`**, não em `graph.facebook.com` — usar o host errado dá `"Invalid OAuth access token - Cannot parse access token"` mesmo com token válido. `instagram.service.ts#apiBaseUrl` já aponta para o host certo; não troque sem confirmar antes com uma chamada de leitura (`GET /me?fields=id,username`) que o token realmente é desse tipo.

Fluxo em duas etapas, implementado em `src/services/instagram.service.ts`:

1. `POST /{ig-user-id}/media` com `image_url` + `caption` → devolve um `creation_id` (container de mídia, ainda não publicado).
2. `POST /{ig-user-id}/media_publish` com `creation_id` → publica de fato e devolve o `id` da mídia publicada.

`InstagramService.publishImagePost(imageUrl, caption)` encapsula as duas chamadas. Não chame a API direto de um controller — sempre pelo service.

## Credenciais (nunca hardcode)

Variáveis de ambiente, carregadas via `dotenv` em `src/index.ts` (`import 'dotenv/config'` deve ser o primeiro import):

- `INSTAGRAM_ACCESS_TOKEN` — token `IGAA...` com permissão `instagram_content_publish`.
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` — o `ig-user-id` numérico (confirmável via `GET /me` com o próprio token — o `id` retornado deve bater com essa variável).
- `GRAPH_API_VERSION` — opcional, default `v21.0` em `instagram.service.ts`.

`.env.example` documenta as chaves esperadas; o `.env` real é local e está no `.gitignore` — nunca commitar, logar nem colar o token em código, teste ou mensagem versionada. Ao depurar um token, verificar formato/tamanho (`.length`, prefixo) sem nunca imprimir o valor completo.

Se uma variável faltar, o service lança `AppError` com status `500` (falha de configuração do servidor, não erro do cliente) — ver [[async-error-handling]].

## Restrição importante: `imageUrl` precisa ser pública

A Graph API busca a imagem a partir do `image_url` enviado — **o servidor da Meta precisa conseguir acessar essa URL pela internet**. Não funciona com:
- `localhost` / `127.0.0.1`
- IPs de rede local
- URLs atrás de autenticação

Para publicar de verdade, a URL da mídia precisa apontar para um host público (HTTPS), seja o próprio servidor exposto publicamente (deploy, túnel como ngrok em dev) servindo `/assets`, seja um storage externo (S3, Cloudinary, etc.). Vale mesmo mandando a mídia por upload ou por nome de asset — o servidor monta a URL, mas ela ainda precisa ser alcançável pela Meta.

## O endpoint: `POST /publish` (um passo só)

`src/controllers/publish.controller.ts` + `src/routes/publish.routes.ts`. **É o
único caminho de publicação** — não existe mais `POST /assets` nem o fluxo de
rascunho `POST /posts` + `/posts/:id/publish` (removidos). `GET /posts` /
`/posts/:id` sobraram só como histórico em memória (`PostsService`).

Corpo aceito:
- **`multipart/form-data`** (`multer` memoryStorage, `upload.array('media', 10)`):
  `caption`, `project?`, `media` (1+ arquivos).
- **`application/json`**: `{ caption, project?, media: [<nome de asset> | <url http(s)>, ...] }`.

Passos no controller:
1. `caption` obrigatório (400 se vazio); `media` obrigatório (400 se nenhum);
   upload **e** `media[]` juntos → 400.
2. `media-resolver.service.ts` transforma cada entrada em `CarouselItem`
   (`{type, url}` com URL pública):
   - upload → `AssetUploadService.save()` → `assets/generated/` → `buildAssetUrl`;
   - nome → `LocalImagesService`/`LocalVideosService.resolve()` (`assets/`,
     `assets/generated/`, `assets/video/`); `path.basename` barra traversal;
   - `http(s)://…` → passa direto (tipo pela extensão).
3. Formato decidido pela mídia: 1 imagem → `publishImagePost`; 1 vídeo →
   `publishReel`; 2+ → `publishCarouselPost`. Depois `publishToTikTok` (nunca
   lança — Instagram já publicado não pode cair por falha do TikTok).
4. Grava o resultado em `PostsService.save()` (`status: 'published'` ou
   `'failed'` + `error`).
5. `?dryRun=1` → resolve tudo (salva os uploads!) e devolve
   `{ wouldPublish: {type, caption, project, mediaUrls} }` sem chamar Meta/TikTok.

`project` é texto livre, só atribuição — não muda nada.

Toda chamada de rede pra Meta continua isolada em `instagram.service.ts`
(2 etapas: `POST /{ig-id}/media` → `POST /{ig-id}/media_publish`), pro TikTok
em `tiktok.service.ts`. Controller nunca fala com API externa direto.

## Testes

Nunca bater na Graph API real em teste. Padrões:
- **Unit do service** (`instagram.service.test.ts`): mocka `global.fetch` com `jest.spyOn`.
- **Teste de rota** (`publish.routes.test.ts`): `jest.mock('../services/instagram.service', …)` + `tiktok.service` + `asset-upload.service` (pra não escrever no disco), e controla os retornos.
- `asset-upload.service.test.ts` cobre a escrita real (traversal, extensão, tipo).

Ver [[testing-jest]] para convenções gerais de teste.
