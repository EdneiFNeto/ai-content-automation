# Ai-content-automation

Backend em Node.js + TypeScript (Express) para automação de posts no Instagram (Meta Graph API) e TikTok (Content Posting API), com geração de imagem por IA via Gemini (Nano Banana).

[Instagram](https://www.instagram.com/drabeatriznogueira.ai) & [Tiktok](https://www.tiktok.com/@bianutricionistaai) plataforma de automação de conteúdo baseada em IA para gerar, otimizar e publicar automaticamente conteúdos em contas de redes sociais, com foco no Instagram.

**Não é de um projeto só.** A conta de destino é o que estiver no `.env`
(`INSTAGRAM_*` / `TIKTOK_*`); vários projetos — inclusive fora do nicho de
conteúdo IA, como o jogo *Ironcrag Conquest* — mandam a mídia + legenda por HTTP
e este serviço publica. Ver [Publicando de vários projetos](#publicando-de-vários-projetos).


## Pré-requisitos

- Node.js >= 21 (o projeto usa `fetch` nativo do Node)
- Uma conta Instagram **Business** ou **Creator**
- Um token de acesso da **Instagram API (Instagram Login)** — token que começa com `IGAA...` — com permissão `instagram_content_publish`
- Uma **API key do Gemini** (opcional, só se for usar geração de imagem) — gerada em https://aistudio.google.com/apikey

## Configuração

1. Instalar as dependências:

   ```bash
   npm install
   ```

2. Copiar o arquivo de variáveis de ambiente e preencher com suas credenciais:

   ```bash
   cp .env.example .env
   ```

   ```
   PORT=3000
   INSTAGRAM_BUSINESS_ACCOUNT_ID=   # ig-user-id numérico da conta (confirmável via GET /me)
   INSTAGRAM_ACCESS_TOKEN=          # token "IGAA..." com permissão instagram_content_publish
   GRAPH_API_VERSION=v21.0
   GEMINI_API_KEY=                  # opcional — só necessário para gerar imagens
   GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
   ```

   O `.env` nunca é versionado (está no `.gitignore`) — não cole o token em nenhum outro lugar do código.

3. Rodar em desenvolvimento:

   ```bash
   npm run dev
   ```

   O servidor sobe em `http://localhost:3000`.

## Scripts disponíveis

| Comando                | O que faz                                      |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | desenvolvimento com reload automático            |
| `npm run build`         | compila `src/` para `dist/`                      |
| `npm start`             | roda o build compilado (`dist/index.js`)         |
| `npm test`              | roda a suíte de testes (Jest)                    |
| `npm run test:watch`    | testes em modo watch                             |
| `npm run lint`          | verifica problemas de lint (ESLint)              |
| `npm run lint:fix`      | corrige o que for autofixável                    |
| `npm run format`        | formata o código com Prettier                    |
| `npm run format:check`  | só verifica a formatação, sem alterar arquivos    |

## Como fazer um post — `POST /publish` (um passo só)

Uma chamada: manda a mídia + a legenda, o servidor resolve tudo, decide o
formato (imagem / Reel / carrossel) e publica no Instagram e depois no TikTok.

**Dois jeitos de mandar a mídia:**

### a) Upload dos arquivos — `multipart/form-data`

```bash
curl -F caption='Minha legenda' \
     -F project='ironcrag-conquest' \
     -F media=@01-home.png \
     -F media=@05-battle.png \
     http://localhost:3000/publish
```

`media` repetido = os itens do carrossel, **na ordem**. 1 arquivo → post
simples; vídeo `.mp4` → Reel; 2+ → carrossel. Aceita `image/png|jpeg|webp` e
`video/mp4|quicktime`, até 64 MB por arquivo, 10 no total. `project` é opcional
(texto livre, só atribuição).

### b) Referências — `application/json`

```bash
curl -X POST http://localhost:3000/publish -H 'content-type: application/json' -d '{
  "caption": "Minha legenda",
  "project": "ironcrag-conquest",
  "media": [
    "profile.png",
    "https://outro-storage.com/foto.jpg"
  ]
}'
```

Cada item de `media` é **um nome de arquivo em `assets/` / `assets/generated/` /
`assets/video/`** (o servidor monta a URL pública) **ou uma URL http(s)** (passa
direto).

### Resposta

```json
{
  "success": true,
  "data": {
    "id": "…", "status": "published", "project": "ironcrag-conquest",
    "instagramMediaId": "17901449796499675",
    "tiktokStatus": "published", "tiktokPublishId": "…",
    "items": [ { "type": "IMAGE", "url": "https://…/assets/generated/01-home.png" } ]
  }
}
```

O `instagramMediaId` serve pra pegar o permalink na Graph API
(`GET graph.instagram.com/v21.0/<id>?fields=permalink&access_token=…`).

### Ensaiar sem publicar — `?dryRun=1`

```bash
curl -F caption='teste' -F media=@01-home.png 'http://localhost:3000/publish?dryRun=1'
# → { "data": { "wouldPublish": { "type": "image", "caption": "teste", "mediaUrls": ["http://localhost:3000/assets/generated/01-home.png"] } } }
```

Resolve a mídia (inclusive salva os uploads) mas **não** chama Meta/TikTok.

## Testar rápido (só o serviço, sem ngrok)

Sobe o servidor (`npm run dev`) e, noutro terminal, roda os `curl` abaixo — o
`?dryRun=1` resolve/salva a mídia e devolve o que **publicaria**, sem chamar
Instagram/TikTok. As imagens usadas já vêm no repo (`assets/`).

```bash
cd ~/Dev/AI-projects/influencer   # os caminhos @assets/... são relativos daqui

# JSON — referencia imagens que já estão em assets/
curl -s -X POST 'http://localhost:3000/publish?dryRun=1' \
  -H 'content-type: application/json' \
  -d '{"caption":"teste 123","project":"sandbox","media":["profile.png","Character_model.jpeg"]}' | jq

# Multipart — upload de arquivo
curl -s -F caption='teste multipart' -F project=sandbox \
     -F media=@assets/profile.png \
     -F media=@assets/Character_model.jpeg \
     'http://localhost:3000/publish?dryRun=1' | jq

# Erros esperados (400)
curl -s -X POST 'http://localhost:3000/publish?dryRun=1' -H 'content-type: application/json' \
  -d '{"media":["profile.png"]}' | jq                    # sem "caption"
curl -s -X POST 'http://localhost:3000/publish?dryRun=1' -H 'content-type: application/json' \
  -d '{"caption":"x","media":["nao-existe.png"]}' | jq   # mídia inexistente

# Histórico do que já foi publicado (vazio enquanto só rodar dryRun)
curl -s http://localhost:3000/posts | jq
```

**Post real** (posta de verdade na conta do `.env`) — tira o `?dryRun=1` e o
servidor precisa estar público:

```bash
# terminal 2
ngrok http 3000 --domain=SEU-DOMINIO.ngrok-free.dev

# terminal 3
curl -s -F caption='post de teste' -F project=sandbox \
     -F media=@assets/profile.png -F media=@assets/Character_model.jpeg \
     https://SEU-DOMINIO.ngrok-free.dev/publish | jq
# → { "data": { "status": "published", "instagramMediaId": "...", "tiktokStatus": "..." } }
```

### ⚠️ A mídia precisa ser pública

A Meta/TikTok baixam a mídia **pela internet** a partir da URL — não alcançam
`localhost`. Em dev, exponha o servidor com [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Aí as URLs que o servidor monta (`/assets/generated/…`) saem já com o host
público (`trust proxy` está ligado). Em produção, use a URL real do servidor
(ou um storage externo).

## Como gerar uma imagem com IA (Gemini / Nano Banana)

> Opcional — hoje o fluxo padrão é usar imagens locais (seção acima). A integração com Gemini continua no código para quando fizer sentido usar de novo, mas gera custo por imagem (ver tabela de preços nos comentários do serviço/skill), então não é o caminho default.

Se você não tem uma foto pronta, dá pra gerar uma a partir de um prompt de texto:

```bash
curl -X POST http://localhost:3000/images/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "retrato profissional em estúdio, luz suave, fundo neutro",
    "aspectRatio": "4:5"
  }'
```

`aspectRatio` é opcional (aceita `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`).

Resposta:

```json
{
  "success": true,
  "data": {
    "imageUrl": "http://localhost:3000/assets/generated/<uuid>.png",
    "fileName": "<uuid>.png",
    "mimeType": "image/png"
  }
}
```

A imagem fica salva em `assets/generated/` (não versionada) e servida em `/assets/generated/<arquivo>`. Use o nome do arquivo (ou a `imageUrl`) em `media` no `POST /publish` — mesma restrição de URL pública descrita acima.

## Publicando de vários projetos

Não é de um projeto/perfil só. A conta de destino é a do `.env`; qualquer
projeto (o jogo *Ironcrag Conquest*, o perfil de nutrição, etc.) publica com
**um `POST /publish`** — via upload multipart ou via nomes/URLs (seções acima).
`project` no corpo marca a origem. O `tool/promo/` do repo `ironcrag_conquest`
faz exatamente isso: captura as telas → um `POST /publish` multipart.

## Endpoints

| Método | Rota                  | Descrição                              |
| ------ | ---------------------- | ---------------------------------------- |
| POST   | `/publish`             | **publica** (Instagram + TikTok) — multipart ou JSON; `?dryRun=1` ensaia |
| GET    | `/posts`               | histórico do que foi publicado (memória) |
| GET    | `/posts/:id`           | um item do histórico                     |
| GET    | `/images/local`        | lista imagens em `assets/` e `assets/generated/` |
| POST   | `/images/generate`     | gera uma imagem a partir de um prompt (Gemini) |
| GET    | `/assets`              | imagens de destaque do influencer (legado) |
| GET    | `/auth/tiktok/login`   | inicia o OAuth do TikTok |
| GET/POST | `/legal/{terms,privacy}` | páginas exigidas pelo TikTok |

## Estrutura do projeto

```
src/
  app.ts                  # monta o Express app (middlewares, rotas, error handler)
  index.ts                # bootstrap do servidor (carrega .env e faz app.listen)
  controllers/             # lógica de cada recurso
  routes/                  # endpoints HTTP
  services/                # integrações externas (Instagram Graph API, Gemini)
  middlewares/              # middleware central de tratamento de erro
  errors/                  # classe AppError
  utils/                    # helpers (resposta padrão, wrapper async)
  types/                    # tipos compartilhados
assets/                    # imagens estáticas servidas em /assets
```

As convenções detalhadas de cada parte (testes, lint, tratamento de erro, formato de resposta da API, integração com o Instagram) estão documentadas nas skills do Claude Code em `.claude/skills/`.
