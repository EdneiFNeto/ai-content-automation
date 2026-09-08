import { Router } from 'express';
import LegalController from '../controllers/legal.controller';

const router = Router();

router.get('/terms', LegalController.terms);
router.get('/privacy', LegalController.privacy);

export default router;
