import { promises as fs } from 'fs';
import path from 'path';
import LocalImagesService from './local-images.service';

const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const GENERATED_DIR = path.resolve(ASSETS_DIR, 'generated');
const generatedFixture = 'fixture-teste.png';

beforeAll(async () => {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.writeFile(path.join(GENERATED_DIR, generatedFixture), Buffer.from('fake'));
});

afterAll(async () => {
  await fs.rm(path.join(GENERATED_DIR, generatedFixture), { force: true });
});

describe('LocalImagesService', () => {
  describe('list', () => {
    it('lista imagens da pasta assets/ (library) e assets/generated/', async () => {
      const images = await LocalImagesService.list();

      expect(images).toContainEqual({ fileName: 'profile.png', source: 'library' });
      expect(images).toContainEqual({ fileName: generatedFixture, source: 'generated' });
    });
  });

  describe('resolve', () => {
    it('resolve um arquivo existente na biblioteca (assets/)', async () => {
      const result = await LocalImagesService.resolve('profile.png');
      expect(result).toEqual({ fileName: 'profile.png', source: 'library' });
    });

    it('resolve um arquivo existente em assets/generated/', async () => {
      const result = await LocalImagesService.resolve(generatedFixture);
      expect(result).toEqual({ fileName: generatedFixture, source: 'generated' });
    });

    it('retorna undefined para um arquivo que não existe', async () => {
      const result = await LocalImagesService.resolve('nao-existe.png');
      expect(result).toBeUndefined();
    });

    it('ignora tentativa de path traversal e não escapa das pastas conhecidas', async () => {
      const result = await LocalImagesService.resolve('../../../etc/passwd');
      expect(result).toBeUndefined();
    });
  });
});
