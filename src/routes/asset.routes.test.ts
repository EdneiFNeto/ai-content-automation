import request from 'supertest';
import { promises as fs } from 'fs';
import path from 'path';
import app from '../app';

const GENERATED_DIR = path.resolve(__dirname, '../../assets/generated');

// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

// Só limpa o que ESTE teste criou — outros testes usam assets/generated/ em
// paralelo, então nada de `rm` recursivo na pasta inteira.
const created: string[] = [];
async function post(opts: { name?: string; type: string; body?: Buffer }) {
  const req = request(app).post('/assets').set('Content-Type', opts.type);
  if (opts.name !== undefined) req.query({ name: opts.name });
  const res = await req.send(opts.body ?? '');
  if (res.body?.data?.fileName) created.push(res.body.data.fileName);
  return res;
}

afterEach(async () => {
  await Promise.all(
    created.splice(0).map((f) => fs.rm(path.join(GENERATED_DIR, f), { force: true })),
  );
});

describe('POST /assets', () => {
  it('salva o arquivo e devolve fileName + url pública', async () => {
    const res = await post({ name: 'promo-01-home.png', type: 'image/png', body: PNG });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fileName).toBe('promo-01-home.png');
    expect(res.body.data.url).toMatch(/\/assets\/generated\/promo-01-home\.png$/);

    const saved = await fs.readFile(path.join(GENERATED_DIR, 'promo-01-home.png'));
    expect(saved.equals(PNG)).toBe(true);
  });

  it('gera um nome quando "name" não é passado', async () => {
    const res = await post({ type: 'image/png', body: PNG });
    expect(res.status).toBe(201);
    expect(res.body.data.fileName).toMatch(/\.png$/);
  });

  it('corrige a extensão do "name" para bater com o Content-Type', async () => {
    const res = await post({ name: 'shot', type: 'video/mp4', body: Buffer.from('fake-mp4-bytes') });
    expect(res.status).toBe(201);
    expect(res.body.data.fileName).toBe('shot.mp4');
  });

  it('rejeita Content-Type não suportado (415)', async () => {
    const res = await post({ type: 'text/plain', body: Buffer.from('nao sou imagem') });
    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
  });

  it('rejeita corpo vazio (400)', async () => {
    const res = await post({ type: 'image/png' });
    expect(res.status).toBe(400);
  });

  it('neutraliza path traversal no "name"', async () => {
    const res = await post({ name: '../../etc/passwd.png', type: 'image/png', body: PNG });
    expect(res.status).toBe(201);
    expect(res.body.data.fileName).toBe('passwd.png');
  });
});
