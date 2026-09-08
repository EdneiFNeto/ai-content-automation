import request from 'supertest';
import app from '../app';

describe('GET /legal/terms', () => {
  it('retorna a página de Termos de Uso em HTML', async () => {
    const res = await request(app).get('/legal/terms');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Termos de Uso');
  });
});

describe('GET /legal/privacy', () => {
  it('retorna a página de Política de Privacidade em HTML', async () => {
    const res = await request(app).get('/legal/privacy');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Política de Privacidade');
  });
});
