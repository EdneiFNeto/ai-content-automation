import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

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
}

export default new AssetController();
