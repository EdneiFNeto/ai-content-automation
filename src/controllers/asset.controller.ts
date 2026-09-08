import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import AssetUploadService from '../services/asset-upload.service';
import { buildAssetUrl } from '../utils/public-url';
import { sendSuccess } from '../utils/api-response';

class AssetController {
  /**
   * Retorna a lista de imagens do influencer formatada conforme solicitado
   */
  public getInfluencerImages(req: Request, res: Response): void {
    const protocol = req.protocol;
    const host = req.get('host'); // Pega localhost:3000 ou 4000 automaticamente
    const baseUrl = `${protocol}://${host}/assets`;

    // Função auxiliar para converter imagem em Base64
    const getBase64 = (filename: string) => {
      const filePath = path.resolve(__dirname, '../../assets', filename);
      try {
        return fs.readFileSync(filePath, { encoding: 'base64' });
      } catch {
        return null;
      }
    };

    const response = {
      influencerId: '1',
      images: [
        {
          id: 1,
          url: `${baseUrl}/Character_model.jpeg`,
          description: 'Foto de destaque local',
          base64: `data:image/jpeg;base64,${getBase64('Character_model.jpeg')}`,
        },
        {
          id: 2,
          url: `${baseUrl}/Facial_reference.jpeg`,
          description: 'Foto de perfil local',
          base64: `data:image/jpeg;base64,${getBase64('Facial_reference.jpeg')}`,
        },
      ],
    };

    res.status(200).json(response);
  }

  /**
   * `POST /assets` — recebe os bytes de uma imagem/vídeo no corpo da requisição
   * (raw, `Content-Type` do arquivo; nome opcional em `?name=`), salva em
   * `assets/generated/` e devolve `{ fileName, url }` (URL pública já pronta pra
   * usar como `imageUrl`/`videoUrl` de um post). Serve pra outros projetos
   * mandarem a mídia sem compartilhar sistema de arquivos.
   */
  public async upload(req: Request, res: Response): Promise<void> {
    const name = typeof req.query.name === 'string' ? req.query.name : undefined;
    const { fileName } = await AssetUploadService.save(req.body, req.headers['content-type'], name);
    sendSuccess(res, { fileName, url: buildAssetUrl(req, `generated/${fileName}`) }, 201);
  }
}

export default new AssetController();
