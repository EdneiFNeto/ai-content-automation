import { promises as fs } from 'fs';
import path from 'path';
import AssetUploadService from './asset-upload.service';

const GENERATED_DIR = path.resolve(__dirname, '../../assets/generated');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

// Mocka o disco — outros testes usam assets/generated/ em paralelo.
let writeFile: jest.SpyInstance;
let mkdir: jest.SpyInstance;

beforeEach(() => {
  writeFile = jest.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
  mkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('AssetUploadService.save', () => {
  it('escreve os bytes e mantém o nome quando a extensão bate', async () => {
    const { fileName } = await AssetUploadService.save(PNG, 'image/png', 'promo-01.png');

    expect(fileName).toBe('promo-01.png');
    expect(mkdir).toHaveBeenCalledWith(GENERATED_DIR, { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(path.join(GENERATED_DIR, 'promo-01.png'), PNG);
  });

  it('gera um nome quando nenhum é passado', async () => {
    const { fileName } = await AssetUploadService.save(PNG, 'image/png');
    expect(fileName).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  it('corrige a extensão pra bater com o Content-Type', async () => {
    const { fileName } = await AssetUploadService.save(Buffer.from('x'), 'video/mp4', 'clipe');
    expect(fileName).toBe('clipe.mp4');
  });

  it('neutraliza path traversal no nome', async () => {
    const { fileName } = await AssetUploadService.save(PNG, 'image/png', '../../etc/passwd.png');
    expect(fileName).toBe('passwd.png');
    expect(writeFile).toHaveBeenCalledWith(path.join(GENERATED_DIR, 'passwd.png'), PNG);
  });

  it('rejeita corpo vazio', async () => {
    await expect(AssetUploadService.save(Buffer.alloc(0), 'image/png')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(AssetUploadService.save({}, 'image/png')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejeita Content-Type não suportado', async () => {
    await expect(AssetUploadService.save(PNG, 'text/plain')).rejects.toMatchObject({
      statusCode: 415,
    });
  });
});
