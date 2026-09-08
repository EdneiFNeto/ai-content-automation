import { Router } from 'express';
import AssetController from '../controllers/asset.controller';

const router = Router();

router.get('/', AssetController.getInfluencerImages);

export default router;
