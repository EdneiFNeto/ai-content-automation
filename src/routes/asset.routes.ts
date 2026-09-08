import { Router, raw } from 'express';
import AssetController from '../controllers/asset.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/', AssetController.getInfluencerImages);

// Corpo cru (imagem/vídeo) — aceita qualquer Content-Type; o service valida.
router.post('/', raw({ type: () => true, limit: '64mb' }), asyncHandler(AssetController.upload));

export default router;
