export type ImageAspectRatio =
  '1:1' | '3:2' | '2:3' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';

export interface GenerateImageInput {
  prompt: string;
  aspectRatio?: ImageAspectRatio;
}

export interface GeneratedImage {
  fileName: string;
  mimeType: string;
}
