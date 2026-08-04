---
name: async-error-handling
description: Use ao escrever qualquer controller, rota ou service que faça operação assíncrona (I/O, chamada a API externa, banco de dados) neste projeto, ou ao lidar com erros/validação em endpoints. Especialmente relevante para o automatizador de posts, que vai chamar APIs externas de redes sociais.
---

# Async/await e tratamento de erro

Express 4 (usado neste projeto) **não captura automaticamente rejeições de Promise** em route handlers — um `await` que falha sem `try/catch` vira uma exceção não tratada e trava a request (sem resposta, sem log útil). Este projeto resolve isso com dois utilitários; use-os sempre, não reinvente.

## `asyncHandler` — obrigatório em toda rota assíncrona

`src/utils/async-handler.ts` envolve o handler e encaminha qualquer rejeição para o middleware de erro central via `next()`.

```ts
import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import MeuController from '../controllers/meu.controller';

const router = Router();
router.get('/', asyncHandler(MeuController.metodo));
```

**Nunca** registre um controller assíncrono direto no router sem `asyncHandler` — se ele rejeitar, a request fica pendurada.

## `AppError` — como sinalizar um erro esperado

`src/errors/app-error.ts` é uma classe de erro com `statusCode`. Dentro de um controller (já envolto em `asyncHandler`), **jogue o erro em vez de responder manualmente**:

```ts
import { AppError } from '../errors/app-error';

if (!post) {
  throw new AppError('Post não encontrado', 404);
}
```

O middleware `src/middlewares/error-handler.middleware.ts` (registrado por último em `src/app.ts`) captura isso e devolve o JSON padronizado — ver [[api-response-conventions]]. Erros que não são `AppError` (bug inesperado, exceção de biblioteca) caem no branch genérico: log no `console.error` + `500`, sem vazar detalhes internos na resposta.

## Nunca

- Fazer `try/catch` manual dentro de todo controller só para formatar a resposta de erro — é para isso que existe o `AppError` + middleware central. Reserve `try/catch` local para quando você precisa de uma ação além de responder o erro (ex.: rollback, retry, log extra antes de rejogar).
- Chamar I/O bloqueante síncrono (`fs.readFileSync`, `execSync`) em código que roda por request. `asset.controller.ts` usa `fs.readFileSync` hoje porque é lido uma vez em resposta simples — não copie esse padrão para algo que rodará com frequência ou payloads grandes; prefira as versões `async`/`promises`.
- Deixar uma `Promise` "solta" sem `await` nem `.catch()` (ex.: disparar uma chamada de API de rede social e seguir em frente sem tratar a falha). Isso é especialmente importante no automatizador de posts: uma falha de rede ao publicar não pode desaparecer silenciosamente — tem que virar um `AppError` (se descoberta síncrona na request) ou ser logada/persistida com status `failed` (se for um job assíncrono em background, fora do ciclo request/response).

## Ao integrar uma API externa (ex.: rede social)

Isolar a chamada em `src/services/<recurso>.service.ts` (ver [[node-typescript-build]]). O service deve:
1. Fazer `await` na chamada.
2. Deixar erros de rede/timeout subirem como `AppError` com uma mensagem clara (ou um erro específico que o controller converte em `AppError`), nunca engolir o erro retornando `null`/`undefined` silenciosamente.
