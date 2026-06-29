import { Router } from 'express';
import {
  createWorkspace,
  getWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../controllers/workspaceController';
import { generateInvite, joinWorkspace } from '../controllers/inviteController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { workspaceSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.post('/', validate(workspaceSchema), createWorkspace);
router.get('/', getWorkspaces);
router.post('/join', joinWorkspace);
router.get('/:id', getWorkspace);
router.patch('/:id', validate(workspaceSchema), updateWorkspace);
router.delete('/:id', deleteWorkspace);
router.post('/:id/invite', generateInvite);

export default router;
