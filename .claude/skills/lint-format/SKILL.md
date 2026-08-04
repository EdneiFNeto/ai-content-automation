---
name: lint-format
description: Use antes de considerar uma alteração de código TypeScript concluída neste projeto, ou quando o usuário pedir para "arrumar o lint", "formatar", ou reportar erro/warning do ESLint ou Prettier.
---

# Lint (ESLint) e formatação (Prettier)

Este projeto usa **ESLint 10 (flat config, `eslint.config.js`)** com `typescript-eslint` (regras type-aware) + `eslint-plugin-n` (regras específicas de Node.js) + **Prettier** para formatação.

## Comandos

```bash
npm run lint          # reporta problemas
npm run lint:fix       # corrige o que for autofixável
npm run format         # formata src/**/*.ts com Prettier
npm run format:check   # só verifica, não escreve
```

## Antes de finalizar qualquer alteração em `src/`

1. `npm run lint` — zero erros é obrigatório; warnings (`@typescript-eslint/no-explicit-any`, `@typescript-eslint/no-unused-vars`) devem ter justificativa se não forem corrigidos.
2. `npm run format` — nunca deixar um arquivo em formatação diferente do resto do projeto (aspas simples, ponto e vírgula, trailing comma múltiplo — ver `.prettierrc.json`).
3. `npm run build` — lint e format não garantem que os tipos fecham; sempre rodar o build também.

## Regras de tipagem type-aware

O ESLint usa `tsconfig.eslint.json` (não o `tsconfig.json` principal) para o parser type-aware, porque esse arquivo inclui os `*.test.ts` que o build de produção exclui. **Todo arquivo `.ts` novo em `src/` precisa estar coberto por esse tsconfig** — como ele estende `tsconfig.json` e só re-declara `exclude`, isso é automático; não crie um terceiro tsconfig sem necessidade.

## Erros comuns e como resolver

- **`@typescript-eslint/no-explicit-any`**: trocar `any` por um tipo concreto ou `unknown` com narrowing. Não silenciar com `// eslint-disable` a menos que realmente não haja alternativa — e nesse caso, comentar o porquê.
- **`@typescript-eslint/no-unused-vars` em parâmetro obrigatório** (ex.: middleware de erro do Express, que exige 4 argumentos mesmo sem usar todos): prefixar o parâmetro com `_` (ex.: `_req`, `_next`) — a regra já ignora esse padrão.
- **`catch (e)` com `e` não usado**: omitir o binding — `catch { ... }` é válido no target `ES2020`.
- **Arquivos de configuração na raiz** (`eslint.config.js`, `jest.config.js`): já estão em `ignores` no próprio `eslint.config.js`. Não lintar nem "corrigir" esses arquivos para usar `import` — eles são CommonJS de propósito (`"type": "commonjs"` no `package.json`).

## Prettier

- Config em `.prettierrc.json`: aspas simples, ponto e vírgula, trailing comma em multi-linha, `printWidth: 100`.
- Nunca ajustar formatação manualmente char a char — sempre rodar `npm run format` e deixar a ferramenta decidir.
