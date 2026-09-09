# Deploy — Render (free)

O serviço roda no [Render](https://render.com) como **web service free**, com
domínio fixo `https://<nome>.onrender.com`. **Instância atual:**
`https://ai-content-automation-2hei.onrender.com` (workspace BlackMind AI,
`srv-dagaet0u01pc738ovpdg`). Isso dá URLs estáveis pro callback
OAuth do TikTok, pras páginas de Termos/Privacidade e pro `PULL_FROM_URL` da
mídia — o que o ngrok manual não sustentava (e é pré-requisito pra submeter o
app TikTok pra Production).

O blueprint está em [`render.yaml`](render.yaml).

## Pegadinhas do ambiente

- **Plano free dorme** após ~15 min sem request → cold start de ~30-50s no
  primeiro acesso. O `POST /publish` acorda a instância, que fica de pé ~15 min
  — tempo de sobra pro TikTok/Meta baixarem a mídia. Pra evitar o cold start,
  um cron externo grátis (cron-job.org) batendo em `/` a cada ~12 min mantém
  aquecido (750h grátis/mês ≈ 1 serviço sempre no ar).
- **Filesystem efêmero**: `assets/generated/` é gravável em runtime mas some a
  cada deploy/restart. OK pro fluxo de publish (upload → pull em minutos); não
  serve como storage durável.
- **`NODE_ENV=production`** no build → `--include=dev` é obrigatório no
  `npm install` (o `typescript` é devDependency). Já está no `buildCommand`.
  Usamos `npm install` e não `npm ci` porque o lockfile carrega deps opcionais
  WASM (`@emnapi/*`) que o `npm ci` recusa ao instalar em Linux.
- **Não setar `PORT`** no dashboard — o Render injeta a dele; `src/index.ts` lê
  de `process.env.PORT`.
- **Body de request**: multipart até 64 MB no código, mas o proxy do Render
  limita ~100 MB — vídeos grandes podem falhar antes de chegar no app.

## Primeiro deploy

1. Render → **New → Blueprint** → conectar `github.com/EdneiFNeto/ai-content-automation`
   → ele detecta o `render.yaml`.
2. **Environment** do serviço → colar o conteúdo do `.env` local (o Render aceita
   paste de `.env` inteiro). **Apagar a linha `PORT`.** As chaves com default no
   `render.yaml` (`GRAPH_API_VERSION`, `TIKTOK_SCOPES`, etc.) já vêm preenchidas.
3. **Create** → aguardar o build/deploy → anotar a URL
   `https://<nome>.onrender.com`.
4. Sanity check:
   ```bash
   curl -s https://<nome>.onrender.com/            # {"message":"Servidor ...:"}
   curl -s https://<nome>.onrender.com/posts       # {"success":true,"data":[]}
   curl -s https://<nome>.onrender.com/legal/terms # HTML
   ```

## Ligar o TikTok ao novo domínio

1. Render env → `TIKTOK_REDIRECT_URI =
   https://<nome>.onrender.com/auth/tiktok/callback` (e o `.env` local igual).
2. TikTok for Developers → app → **Login Kit → Redirect URI** → adicionar essa
   URL exata.
3. TikTok → app → **URL properties → Verify → URL prefix** →
   `https://<nome>.onrender.com/` → baixar o `tiktokXXXX.txt` → colocar em
   `public/` → `git add -f public/tiktokXXXX.txt` → commit + push → Render
   redeploya → clicar **Verify**.
4. Abrir `https://<nome>.onrender.com/auth/tiktok/login` → refazer o OAuth →
   copiar `accessToken` + `refreshToken` da resposta pro Render env
   (`TIKTOK_ACCESS_TOKEN` / `TIKTOK_REFRESH_TOKEN`) e pro `.env` local → redeploy.
5. Teste real (multipart — a mídia sai do domínio verificado):
   ```bash
   curl -s -F caption='teste render' -F project=ironcrag-conquest \
        -F 'media=@video.mp4;type=video/mp4' \
        https://<nome>.onrender.com/publish | jq
   # esperado: instagramMediaId, facebookStatus:"published", tiktokStatus:"published"
   ```
6. No repo do jogo: `tool/promo/ironcrag.config.json` → `influencerUrl =
   https://<nome>.onrender.com`.

## TikTok Production (App Review) — depois

Ver `TIKTOK_INTEGRATION.md` §5 e §11. Resumo: preencher Basic Information,
verificar o domínio também na aba **Production**, gravar o vídeo demo, **Submit
for review** (~5-10 dias úteis). Só depois: trocar client key/secret pra
Production, `TIKTOK_PRIVACY_LEVEL=PUBLIC_TO_EVERYONE`, conta TikTok pública.

## Manutenção

- **Token TikTok (24h)**: hoje é re-login manual em `/auth/tiktok/login`. Plugar
  `TikTokService.refreshAccessToken()` num agendador + persistir o refresh token
  resolve — follow-up.
- **Redeploy**: `autoDeploy: true` — todo push na `main` redeploya.
- **Logs**: dashboard do Render → aba Logs.
