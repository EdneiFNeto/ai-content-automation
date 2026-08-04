import { Request } from 'express';

export function buildAssetUrl(req: Request, relativePath: string): string {
  return `${req.protocol}://${req.get('host')}/assets/${relativePath}`;
}
