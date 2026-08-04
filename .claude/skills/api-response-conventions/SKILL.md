---
name: api-response-conventions
description: Use ao criar ou modificar qualquer endpoint deste projeto — define o formato JSON padrão de sucesso e erro que toda rota nova deve seguir. Acionar em pedidos como "cria um endpoint", "adiciona uma rota", "qual o formato de resposta".
---

# Formato padrão de resposta da API

Toda rota **nova** neste projeto deve responder no envelope abaixo. Rotas antigas (`/users`, `/assets`) ainda não foram migradas — não é preciso mexer nelas por causa disso, mas não copie o formato delas para código novo.

## Sucesso

```json
{ "success": true, "data": { "...": "..." } }
```

Gerado com o helper `sendSuccess` de `src/utils/api-response.ts`:

```ts
import { sendSuccess } from '../utils/api-response';

sendSuccess(res, post);        // 200 por padrão
sendSuccess(res, post, 201);   // status custom, ex.: criação
```

`data` pode ser um objeto, array ou lista — nunca a resposta HTTP inteira sem o envelope.

## Erro

```json
{ "success": false, "error": { "message": "..." } }
```

Não construa esse JSON manualmente no controller. Jogue um `AppError` (ver [[async-error-handling]]) com a mensagem e o status HTTP corretos — o middleware central converte automaticamente:

```ts
throw new AppError('O campo "content" é obrigatório', 400);
throw new AppError('Post não encontrado', 404);
```

Erros não previstos (bugs, exceções de biblioteca) viram `500` com mensagem genérica (`"Erro interno do servidor"`) — nunca vazam stack trace ou mensagem interna para o cliente; o detalhe vai só para `console.error`.

## Regras

- **Nunca** responder um recurso "cru" sem o envelope (`res.json(post)`) — sempre `sendSuccess`.
- **Nunca** montar `{ message: '...' }` de erro na mão dentro do controller — sempre `throw new AppError(...)`.
- Status HTTP segue convenção REST: `200` leitura, `201` criação, `400` validação, `404` não encontrado, `401`/`403` quando houver auth, `500` reservado para erro não tratado.
- Ao escrever o teste do endpoint (ver [[testing-jest]]), a asserção do corpo sempre passa por `res.body.success` e `res.body.data` (sucesso) ou `res.body.error.message` (erro) — nunca assuma o formato antigo (`{ message }` solto ou objeto cru).
