---
name: node-typescript-build
description: Use ao criar ou estruturar um projeto/módulo Node.js com TypeScript neste repositório — novas rotas, controllers, services, configuração de build (tsc), scripts do package.json ou organização de pastas. Acionar em pedidos como "cria uma rota nova", "monta a estrutura do projeto", "configura o build", "adiciona um controller/service".
---

# Construção de projeto Node.js + TypeScript

Convenções para estruturar e evoluir este projeto (Express + TypeScript, `type: commonjs`, compilado via `tsc`).

## Estrutura de pastas

```
src/
  app.ts                    # monta o Express app (middlewares, rotas, error handler) — importado pelos testes
  index.ts                  # só faz app.listen — nunca importar em teste
  controllers/
    <nome>.controller.ts    # lógica de cada recurso
  routes/
    <nome>.routes.ts        # define os endpoints, liga ao controller, envolve com asyncHandler
    <nome>.routes.test.ts   # teste do endpoint (Supertest) — ver [[testing-jest]]
  services/                 # lógica de negócio/integração externa
    <nome>.service.ts
  middlewares/
    error-handler.middleware.ts   # middleware central de erro — ver [[async-error-handling]]
  errors/
    app-error.ts             # classe AppError(message, statusCode)
  utils/
    async-handler.ts         # wrapper para rotas assíncronas
    api-response.ts          # sendSuccess() — ver [[api-response-conventions]]
  types/                     # tipos/interfaces compartilhados entre camadas
assets/                      # arquivos estáticos servidos em /assets
dist/                        # saída do build (gerado por tsc, não versionar)
```

## Padrão de controller

- Classe com métodos públicos assíncronos, exportada como instância singleton (`export default new XController()`).
- Assinatura: `(req: Request, res: Response): Promise<void>` ou `void` se síncrono.
- Sem lógica de negócio pesada dentro do controller — extrair para `services/` quando crescer.

```ts
import { Request, Response } from 'express';

class ExemploController {
  public async metodo(req: Request, res: Response): Promise<void> {
    res.status(200).json({ message: 'ok' });
  }
}

export default new ExemploController();
```

## Padrão de rota

- Um arquivo por recurso em `src/routes/`, usando `Router()` do Express.
- Importa o controller correspondente e mapeia os verbos HTTP, envolvendo cada handler com `asyncHandler` (ver [[async-error-handling]]).
- Registrar a rota em `src/app.ts` (não em `index.ts`) com `app.use('/<recurso>', xRoutes)`.

```ts
import { Router } from 'express';
import ExemploController from '../controllers/exemplo.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();
router.get('/', asyncHandler(ExemploController.metodo));

export default router;
```

## package.json — scripts esperados

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon src/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "format:check": "prettier --check \"src/**/*.ts\""
  }
}
```

- `dev`: desenvolvimento com reload automático (nodemon + ts-node).
- `build`: compila `src/` para `dist/` conforme `tsconfig.json`.
- `start`: roda o build compilado (uso em produção).
- `test` / `test:watch`: ver [[testing-jest]].
- `lint` / `format`: ver [[lint-format]] — rodar ambos antes de finalizar qualquer alteração.

## tsconfig.json — base do projeto

Manter `strict: true`, `rootDir: ./src`, `outDir: ./dist`, `esModuleInterop: true`. Não relaxar `strict` para "resolver" erros de tipo — corrigir os tipos.

## Ao adicionar uma nova funcionalidade

1. Definir o recurso (ex.: `posts`, `schedules`, `channels`).
2. Criar `src/controllers/<recurso>.controller.ts` — respostas via `sendSuccess`, erros via `throw new AppError(...)` (ver [[api-response-conventions]]).
3. Criar `src/routes/<recurso>.routes.ts`, cada handler envolto em `asyncHandler` (ver [[async-error-handling]]).
4. Registrar em `src/app.ts`.
5. Se envolver integração externa (API de rede social, fila, storage), isolar em `src/services/<recurso>.service.ts` — controller chama o service, nunca faz a chamada HTTP/SDK diretamente.
6. Tipos compartilhados entre camadas vão em `src/types/`, não duplicados em cada arquivo.
7. Criar `src/routes/<recurso>.routes.test.ts` cobrindo sucesso e erro (ver [[testing-jest]]).

## Dependências

- Adicionar dependências de runtime com `npm install <pkg>`.
- Pacotes só de tipos ou ferramentas de dev (`@types/*`, `nodemon`, `ts-node`, `typescript`) sempre com `npm install -D <pkg>`.
- Preferir bibliotecas já presentes no projeto antes de introduzir uma nova para o mesmo propósito.

## Antes de considerar concluído

- Rodar `npm run build` e garantir que compila sem erros de tipo.
- Rodar `npm run lint` e `npm run format` (ver [[lint-format]]).
- Rodar `npm test` e garantir que os testes novos e existentes passam (ver [[testing-jest]]).
- Se houver servidor rodando, testar o endpoint novo com uma requisição real (`curl` ou similar) antes de reportar como pronto.
