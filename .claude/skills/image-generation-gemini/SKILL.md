---
name: image-generation-gemini
description: Use ao mexer em geração de imagem via Gemini (Nano Banana), no endpoint /images/generate, ou ao encadear geração de imagem com publicação de post. Acionar em pedidos como "gera uma imagem", "cria uma foto com IA", "configura o Gemini".
---

# Geração de imagem com Gemini (Nano Banana)

Integração via SDK oficial `@google/genai`, endpoint `interactions.create` com `response_format: { type: 'image' }`. Implementado em `src/services/image-generation.service.ts`.

## Modelos ("Nano Banana" é o apelido)

| Apelido | Model ID | Uso |
|---|---|---|
| Nano Banana (legado) | `gemini-2.5-flash-image` | mais barato, qualidade menor |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | custo/benefício |
| **Nano Banana 2** (default do projeto) | `gemini-3.1-flash-image` | equilíbrio qualidade/custo |
| Nano Banana Pro | `gemini-3-pro-image` | melhor qualidade, mais caro |

Trocar de modelo é só mudar `GEMINI_IMAGE_MODEL` no `.env` — não tem lógica hardcoded no service além do default.

## Credenciais

- `GEMINI_API_KEY` — gerada em https://aistudio.google.com/apikey. Nunca hardcode, nunca commit, nunca colar em mensagem/teste. O service lê via getter (`private get apiKey()`) e lança `AppError(500)` se faltar — mesmo padrão do [[instagram-publishing]].
- `GEMINI_IMAGE_MODEL` — opcional, default `gemini-3.1-flash-image`.

## Fluxo

`POST /images/generate` (`src/controllers/images.controller.ts`):

1. Exige `prompt` no body — 400 se ausente. `aspectRatio` é opcional (`1:1`, `16:9`, `9:16`, etc. — ver `ImageAspectRatio` em `src/types/image-generation.types.ts`).
2. `ImageGenerationService.generateImage()` chama a Gemini API, pega `interaction.output_image` (`{ data: base64, mime_type }`), decodifica e salva em `assets/generated/<uuid>.<ext>`.
3. Controller monta a URL pública (`${protocol}://${host}/assets/generated/<arquivo>`, mesmo padrão do `asset.controller.ts`) e responde com `sendSuccess`.

`assets/generated/` é criado em runtime (`fs.mkdir recursive`) e está no `.gitignore` — são artefatos gerados, não fazem parte do código-fonte versionado.

## Encadeando com publicação no Instagram

Não existe (ainda) um endpoint único "gera e publica". O fluxo é composto manualmente, chamando os dois endpoints em sequência:

1. `POST /images/generate` → pega `data.imageUrl` da resposta.
2. `POST /posts` com `imageUrl` = a URL retornada no passo 1.
3. `POST /posts/:id/publish` (ver [[instagram-publishing]]).

Como a imagem gerada já é salva com uma URL sob `/assets/generated/`, ela só é alcançável pela Meta se o servidor estiver exposto publicamente (deploy real ou túnel como ngrok em dev) — mesma restrição de `imageUrl` documentada em [[instagram-publishing]].

## Testes

Nunca bater na Gemini API real em teste:
- **Unit do service** (`image-generation.service.test.ts`): mocka o módulo `@google/genai` inteiro (`jest.mock('@google/genai', ...)`), controlando o retorno de `interactions.create`. Usa um PNG mínimo em base64 como fixture e limpa `assets/generated/` no `afterEach`.
- **Teste de rota** (`images.routes.test.ts`): mocka `image-generation.service` inteiro, mesmo padrão do [[testing-jest]].
