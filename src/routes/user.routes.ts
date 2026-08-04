import { Router } from 'express';
import UserController from '../controllers/user.controller';

const router = Router();

/**
 * Rota de exemplo para listagem de usuários
 */
router.get('/', UserController.getAllUsers);

export default router;
