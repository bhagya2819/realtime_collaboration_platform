import { Router } from 'express';
import authRoutes from './auth';
import workspaceRoutes from './workspace';
import {
  createDocument,
  getDocuments,
  getDocument,
  updateDocument,
  archiveDocument,
} from '../controllers/documentController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { documentCreateSchema, documentUpdateSchema } from '../validators';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);

router.post(
  '/workspaces/:id/documents',
  authenticate,
  validate(documentCreateSchema),
  createDocument
);
router.get('/workspaces/:id/documents', authenticate, getDocuments);

router.get('/documents/:id', authenticate, getDocument);
router.patch('/documents/:id', authenticate, validate(documentUpdateSchema), updateDocument);
router.delete('/documents/:id', authenticate, archiveDocument);

export default router;
