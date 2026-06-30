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
import { joinWorkspace } from '../controllers/inviteController';
import {
  addComment,
  getComments,
  updateComment,
  deleteComment,
  resolveComment,
} from '../controllers/commentController';
import {
  getNotifications,
  markAsRead,
  markAllRead,
} from '../controllers/notificationController';
import {
  getActivity,
} from '../controllers/activityController';
import {
  getVersions,
  getVersion,
  restoreVersion,
} from '../controllers/versionController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { documentCreateSchema, documentUpdateSchema, commentSchema } from '../validators';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workspaces', workspaceRoutes);

// Documents (admin/editor only for mutations)
router.post('/workspaces/:id/documents', authenticate, authorize('admin', 'editor'), validate(documentCreateSchema), createDocument);
router.get('/workspaces/:id/documents', authenticate, getDocuments);
router.post('/workspaces/join', authenticate, joinWorkspace);
router.get('/documents/:id', authenticate, getDocument);
router.patch('/documents/:id', authenticate, validate(documentUpdateSchema), updateDocument);
router.delete('/documents/:id', authenticate, archiveDocument);

// Comments
router.post('/documents/:id/comments', authenticate, validate(commentSchema), addComment);
router.get('/documents/:id/comments', authenticate, getComments);
router.patch('/comments/:id', authenticate, updateComment);
router.delete('/comments/:id', authenticate, deleteComment);
router.patch('/comments/:id/resolve', authenticate, resolveComment);

// Notifications
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/:id/read', authenticate, markAsRead);
router.patch('/notifications/read-all', authenticate, markAllRead);

// Version History
router.get('/documents/:id/versions', authenticate, getVersions);
router.get('/documents/:id/versions/:vid', authenticate, getVersion);
router.post('/documents/:id/restore/:vid', authenticate, restoreVersion);

// Activity
router.get('/workspaces/:id/activity', authenticate, getActivity);

export default router;
