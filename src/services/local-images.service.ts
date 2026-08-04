import { promises as fs } from 'fs';
import path from 'path';
import { LocalImage, LocalImageSource } from '../types/local-image.types';

const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const GENERATED_DIR = path.resolve(ASSETS_DIR, 'generated');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

async function listImageFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

class LocalImagesService {
  public async list(): Promise<LocalImage[]> {
    const [library, generated] = await Promise.all([
      listImageFiles(ASSETS_DIR),
      listImageFiles(GENERATED_DIR),
    ]);

    return [
      ...library.map((fileName) => ({ fileName, source: 'library' as const })),
      ...generated.map((fileName) => ({ fileName, source: 'generated' as const })),
    ];
  }

  // path.basename evita path traversal (ex.: "../../etc/passwd") — só o nome do
  // arquivo é considerado, sempre relativo às pastas conhecidas de imagem
  public async resolve(
    fileName: string,
  ): Promise<{ fileName: string; source: LocalImageSource } | undefined> {
    const safeName = path.basename(fileName);

    if (await fileExists(path.join(ASSETS_DIR, safeName))) {
      return { fileName: safeName, source: 'library' };
    }

    if (await fileExists(path.join(GENERATED_DIR, safeName))) {
      return { fileName: safeName, source: 'generated' };
    }

    return undefined;
  }
}

export default new LocalImagesService();
