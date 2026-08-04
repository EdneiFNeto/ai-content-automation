export type LocalImageSource = 'library' | 'generated';

export interface LocalImage {
  fileName: string;
  source: LocalImageSource;
}
