---
name: testing-jest
description: Use ao escrever ou pedir testes automatizados neste projeto — testar um controller, uma rota, um service, ou rodar/depurar `npm test`. Acionar em pedidos como "escreve um teste para", "cobre esse endpoint com teste", "por que o teste está falhando".
---

# Testes com Jest + Supertest

Stack de testes deste projeto: **Jest** (`ts-jest`) + **Supertest** para testes de rota/integração via HTTP contra o `app` do Express.

## Onde colocar o teste

- Co-localizado com o arquivo testado, sufixo `.test.ts`: `src/routes/posts.routes.test.ts` testa `src/routes/posts.routes.ts`.
- Testes de rota/endpoint importam `app` de `src/app.ts` (não `src/index.ts` — esse só faz `app.listen`, não deve ser importado em teste pois abriria porta real).
- `jest.config.js` já casa `src/**/*.test.ts` automaticamente — não precisa registrar o arquivo em lugar nenhum.

## Padrão de teste de endpoint (Supertest)

```ts
import request from 'supertest';
import app from '../app';

describe('POST /recurso', () => {
  it('cria com sucesso', async () => {
    const res = await request(app).post('/recurso').send({ campo: 'valor' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.campo).toBe('valor');
  });

  it('retorna 400 quando falta campo obrigatório', async () => {
    const res = await request(app).post('/recurso').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

Sempre cobrir: caminho feliz (2xx) + pelo menos um caminho de erro (validação ou "não encontrado"). Ver [[api-response-conventions]] para o formato de resposta esperado em cada asserção.

## Padrão de teste de service (unitário, sem HTTP)

Quando o service não depende do Express, teste direto, sem Supertest:

```ts
import PostsService from './posts.service';

describe('PostsService', () => {
  it('marca como "scheduled" quando scheduledFor é informado', () => {
    const post = PostsService.create({ content: 'x', scheduledFor: '2026-01-01T10:00:00Z' });
    expect(post.status).toBe('scheduled');
  });
});
```

## Estado entre testes

Os services atuais guardam dados em memória (array na instância singleton) — não há reset automático entre testes. Se um teste depender de estado limpo, ler o array resultante em vez de assumir tamanho/posição fixos (ex.: pegar o item pelo `id` retornado na criação, não por índice `[0]`).

## Rodando

- `npm test` — roda toda a suíte uma vez.
- `npm run test:watch` — modo watch durante desenvolvimento.
- Não reportar uma tarefa como concluída sem rodar `npm test` e ver os testes novos passando.

## Ao adicionar teste para uma nova rota

1. Criar `<recurso>.routes.test.ts` ao lado da rota.
2. Cobrir sucesso + erro de validação + erro "não encontrado" (quando aplicável), conforme [[async-error-handling]].
3. Rodar `npm test` antes de considerar pronto.
