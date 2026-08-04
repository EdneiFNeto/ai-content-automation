# influencer

Backend em Node.js + TypeScript (Express) para automação de posts no Instagram via Meta Graph API.

## Pré-requisitos

- Node.js >= 21 (o projeto usa `fetch` nativo do Node)
- Uma conta Instagram **Business** ou **Creator**
- Um token de acesso da **Instagram API (Instagram Login)** — token que começa com `IGAA...` — com permissão `instagram_content_publish`

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

## Como fazer um post no Instagram

A publicação acontece em duas etapas: primeiro você cria o post (fica como rascunho), depois manda publicar.

### 1. Criar o post

```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Legenda do post aqui",
    "imageUrl": "https://sua-url-publica.com/foto.jpg"
  }'
```

Resposta:

```json
{
  "success": true,
  "data": {
    "id": "uuid-do-post",
    "content": "Legenda do post aqui",
    "imageUrl": "https://sua-url-publica.com/foto.jpg",
    "status": "draft",
    "createdAt": "2026-08-04T02:33:05.859Z"
  }
}
```

Guarde o `id` retornado — é ele que você usa no próximo passo.

### 2. Publicar no Instagram

```bash
curl -X POST http://localhost:3000/posts/<id-do-post>/publish
```

Se der certo, o post volta com `status: "published"` e um `instagramMediaId`:

```json
{
  "success": true,
  "data": {
    "id": "uuid-do-post",
    "status": "published",
    "instagramMediaId": "17901449796499675",
    "...": "..."
  }
}
```

Esse `instagramMediaId` pode ser usado para consultar o post direto na Graph API (ex.: `GET https://graph.instagram.com/v21.0/<instagramMediaId>?fields=permalink&access_token=...`) e pegar o link permanente do post.

### ⚠️ A imagem precisa ser pública

O Instagram busca a imagem a partir da própria internet — `imageUrl` **não pode** apontar para `localhost` ou uma rede interna. Em desenvolvimento, a forma mais simples é expor o servidor local com [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Isso gera uma URL pública (`https://algo.ngrok-free.dev`). As imagens da pasta `assets/` ficam disponíveis em `/assets/<arquivo>`, então a `imageUrl` do post seria algo como:

```
https://algo.ngrok-free.dev/assets/profile.png
```

Em produção, use a URL pública real do servidor (ou um storage externo, como S3/Cloudinary).

### Outros endpoints de posts

| Método | Rota                | Descrição                          |
| ------ | -------------------- | ------------------------------------ |
| GET    | `/posts`             | lista todos os posts                 |
| GET    | `/posts/:id`         | detalhes de um post                  |
| POST   | `/posts`             | cria um post (rascunho)              |
| POST   | `/posts/:id/publish` | publica um post existente no Instagram |

## Estrutura do projeto

```
src/
  app.ts                  # monta o Express app (middlewares, rotas, error handler)
  index.ts                # bootstrap do servidor (carrega .env e faz app.listen)
  controllers/             # lógica de cada recurso
  routes/                  # endpoints HTTP
  services/                # integrações externas (ex.: Instagram Graph API)
  middlewares/              # middleware central de tratamento de erro
  errors/                  # classe AppError
  utils/                    # helpers (resposta padrão, wrapper async)
  types/                    # tipos compartilhados
assets/                    # imagens estáticas servidas em /assets
```

As convenções detalhadas de cada parte (testes, lint, tratamento de erro, formato de resposta da API, integração com o Instagram) estão documentadas nas skills do Claude Code em `.claude/skills/`.
