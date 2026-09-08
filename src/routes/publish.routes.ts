import { Router } from 'express';
import multer from 'multer';
import PublishController from '../controllers/publish.controller';
import { asyncHandler } from '../utils/async-handler';

// Guarda os arquivos em memória (até 64 MB cada, 10 no total) — daí vão pra
// assets/generated/ via AssetUploadService.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 64 * 1024 * 1024, files: 10 },
});

const router = Router();

// `upload.array` processa multipart/form-data; num corpo JSON ele passa direto
// (req.files fica indefinido) e o express.json() global já parseou.
router.post('/', upload.array('media', 10), asyncHandler(PublishController.publish));

export default router;
