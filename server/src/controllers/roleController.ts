import { Request, Response } from 'express';
import { Workspace } from '../models';
import { logActivity } from '../services/logActivity';

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found' });
      return;
    }

    if (workspace.owner.toString() !== req.userId) {
      res.status(403).json({ message: 'Only the workspace owner can change roles' });
      return;
    }

    const { role } = req.body;
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    const member = workspace.members.find(
      (m) => m.user.toString() === req.params.userId
    );

    if (!member) {
      res.status(404).json({ message: 'Member not found' });
      return;
    }

    const oldRole = member.role;
    member.role = role as 'admin' | 'editor' | 'viewer';
    await workspace.save();

    await logActivity({
      workspace: workspace._id.toString(),
      user: req.userId!,
      action: 'role.changed',
      targetType: 'workspace',
      targetId: workspace._id.toString(),
      metadata: { memberId: req.params.userId, oldRole, newRole: role },
    });

    await workspace.populate('members.user', 'name email');

    res.json({ workspace });
  } catch {
    res.status(500).json({ message: 'Failed to update role' });
  }
};
