import { Request, Response } from 'express';
import { Workspace } from '../models';
import { logActivity } from '../services/logActivity';

const pid = (req: Request): string => req.params.id as string;

export const generateInvite = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(pid(req));
    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found' });
      return;
    }

    if (workspace.owner.toString() !== req.userId) {
      res.status(403).json({ message: 'Only owner can generate invite links' });
      return;
    }

    await logActivity({
      workspace: pid(req),
      user: req.userId!,
      action: 'member.invited',
      targetType: 'workspace',
      targetId: workspace._id.toString(),
    });

    res.json({ inviteCode: workspace.inviteCode });
  } catch {
    res.status(500).json({ message: 'Failed to generate invite' });
  }
};

export const joinWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const { inviteCode } = req.body;

    const workspace = await Workspace.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!workspace) {
      res.status(404).json({ message: 'Invalid invite code' });
      return;
    }

    const alreadyMember = workspace.members.some(
      (m) => m.user.toString() === req.userId
    );

    if (alreadyMember || workspace.owner.toString() === req.userId) {
      res.status(409).json({ message: 'Already a member of this workspace' });
      return;
    }

    workspace.members.push({ user: req.userId as any, role: 'editor', joinedAt: new Date() });
    await workspace.save();

    await logActivity({
      workspace: workspace._id.toString(),
      user: req.userId!,
      action: 'member.joined',
      targetType: 'workspace',
      targetId: workspace._id.toString(),
    });

    res.json({ workspace });
  } catch {
    res.status(500).json({ message: 'Failed to join workspace' });
  }
};
