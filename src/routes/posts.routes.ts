import { Router } from 'express';
import PostsController from '../controllers/posts.controller';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get('/', asyncHandler(PostsController.list));
router.get('/:id', asyncHandler(PostsController.getById));
router.post('/', asyncHandler(PostsController.create));
router.post('/:id/publish', asyncHandler(PostsController.publish));

export default router;
