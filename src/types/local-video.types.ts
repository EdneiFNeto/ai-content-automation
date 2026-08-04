export type LocalVideoSource = 'library' | 'generated';

export interface LocalVideo {
  fileName: string;
  source: LocalVideoSource;
}
