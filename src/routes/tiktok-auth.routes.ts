import { Router } from 'express';
import TikTokAuthController from '../controllers/tiktok-auth.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/login', asyncHandler(TikTokAuthController.login));
router.get('/callback', asyncHandler(TikTokAuthController.callback));

export default router;
