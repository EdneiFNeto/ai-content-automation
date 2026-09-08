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

Para publicar de verdade, `imageUrl` do post precisa apontar para um host público (HTTPS), seja o próprio servidor exposto publicamente (deploy, túnel como ngrok em dev) servindo `/assets`, seja um storage externo (S3, Cloudinary, etc.). Essa restrição vale mesmo usando `imageFileName` (ver abaixo) — só muda quem monta a URL, não a exigência de ela ser pública.

## Receber mídia de outro projeto (`POST /assets`)

`POST /assets` recebe os bytes de uma imagem/vídeo no corpo cru (`Content-Type`
do arquivo, nome opcional em `?name=`), salva em `assets/generated/` via
`AssetUploadService`, e devolve `{ fileName, url }` — a `url` já sai pública
(usa `buildAssetUrl` / `trust proxy`). É por aí que outros repos de jogo mandam
o conteúdo sem compartilhar disco: `POST /assets` (uma vez por arquivo) →
`POST /posts` com as `imageUrl`/`videoUrl` devolvidas + `project` →
`POST /posts/:id/publish`. `project` é texto livre no post (só atribuição, não
muda nada). Aceita `image/png|jpeg|webp`, `video/mp4|quicktime`, até 64 MB.
Rota com `express.raw({ type: () => true })` — a validação de tipo é no service.

## Criar o post a partir de uma imagem local (`imageFileName`)

`POST /posts` aceita `imageFileName` como alternativa a `imageUrl` — referencia um arquivo já existente em `assets/` (biblioteca) ou `assets/generated/` (gerado pelo Gemini) pelo nome, sem precisar montar a URL pública na mão. Implementado em `LocalImagesService.resolve()` (`src/services/local-images.service.ts`) + `resolveLocalImageUrl()` em `posts.controller.ts`.

- Nunca envie `imageUrl` e `imageFileName` juntos — o controller responde `400`.
- `imageFileName` inexistente (em nenhuma das duas pastas) → `400`.
- `LocalImagesService.resolve()` usa `path.basename()` no nome recebido antes de checar o disco — protege contra path traversal (`../../etc/passwd` vira só `passwd`, que não existe nas pastas conhecidas).
- `GET /images/local` lista o que está disponível (`fileName`, `source`, `imageUrl` já pronta) — útil para descobrir nomes de arquivo sem precisar de acesso ao disco do servidor.

Hoje esse é o caminho padrão do projeto (evita o custo do Gemini) — ver [[image-generation-gemini]] para quando fizer sentido voltar a gerar imagem por IA em vez de usar a biblioteca local.

## Fluxo de publicação de um post

`POST /posts/:id/publish` (`src/controllers/posts.controller.ts#publish`):

1. Busca o post por `id` — 404 se não existir.
2. Exige `post.imageUrl` — 400 se ausente (Instagram não publica só texto via este fluxo). Note que isso já é o `imageUrl` resolvido — não importa se o post foi criado com `imageUrl` direto ou com `imageFileName`.
3. Chama `InstagramService.publishImagePost(imageUrl, content)`.
4. Sucesso: atualiza o post para `status: 'published'` e grava `instagramMediaId`.
5. Falha: atualiza o post para `status: 'failed'` e relança o erro (o middleware central formata a resposta — ver [[api-response-conventions]]).

Ao estender esse fluxo (ex.: publicar carrossel, vídeo/Reels, ou agendar via `scheduledFor`), manter o mesmo padrão: toda chamada de rede para a Meta isolada em `instagram.service.ts`, nunca no controller.

## Testes

Nunca bater na Graph API real em teste. Dois padrões usados:
- **Unit do service** (`instagram.service.test.ts`): mocka `global.fetch` com `jest.spyOn`.
- **Teste de rota** (`posts.routes.test.ts`): mocka o módulo inteiro com `jest.mock('../services/instagram.service', ...)` e controla o retorno de `publishImagePost`.

Ver [[testing-jest]] para convenções gerais de teste.
