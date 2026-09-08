export type LocalVideoSource = 'library' | 'generated' | 'video';

export interface LocalVideo {
  fileName: string;
  source: LocalVideoSource;
}
