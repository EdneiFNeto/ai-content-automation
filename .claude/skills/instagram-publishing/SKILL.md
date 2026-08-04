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

Para publicar de verdade, `imageUrl` do post precisa apontar para um host público (HTTPS), seja o próprio servidor exposto publicamente (deploy, túnel como ngrok em dev) servindo `/assets`, seja um storage externo (S3, Cloudinary, etc.).

## Fluxo de publicação de um post

`POST /posts/:id/publish` (`src/controllers/posts.controller.ts#publish`):

1. Busca o post por `id` — 404 se não existir.
2. Exige `post.imageUrl` — 400 se ausente (Instagram não publica só texto via este fluxo).
3. Chama `InstagramService.publishImagePost(imageUrl, content)`.
4. Sucesso: atualiza o post para `status: 'published'` e grava `instagramMediaId`.
5. Falha: atualiza o post para `status: 'failed'` e relança o erro (o middleware central formata a resposta — ver [[api-response-conventions]]).

Ao estender esse fluxo (ex.: publicar carrossel, vídeo/Reels, ou agendar via `scheduledFor`), manter o mesmo padrão: toda chamada de rede para a Meta isolada em `instagram.service.ts`, nunca no controller.

## Testes

Nunca bater na Graph API real em teste. Dois padrões usados:
- **Unit do service** (`instagram.service.test.ts`): mocka `global.fetch` com `jest.spyOn`.
- **Teste de rota** (`posts.routes.test.ts`): mocka o módulo inteiro com `jest.mock('../services/instagram.service', ...)` e controla o retorno de `publishImagePost`.

Ver [[testing-jest]] para convenções gerais de teste.
