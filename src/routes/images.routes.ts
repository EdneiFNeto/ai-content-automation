import { Router } from 'express';
import ImagesController from '../controllers/images.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.post('/generate', asyncHandler(ImagesController.generate));

export default router;
