import { Request, Response } from 'express';
import { Workspace } from '../models';
import { logActivity } from '../services/logActivity';

const pid = (req: Request): string => req.params.id as string;

export const createWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const workspace = await Workspace.create({
      name,
      owner: req.userId,
      members: [{ user: req.userId, role: 'admin' }],
    });

    res.status(201).json({ workspace });
  } catch {
    res.status(500).json({ message: 'Failed to create workspace' });
  }
};

export const getWorkspaces = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspaces = await Workspace.find({
      $or: [{ owner: req.userId }, { 'members.user': req.userId }],
    }).populate('owner', 'name email');

    res.json({ workspaces });
  } catch {
    res.status(500).json({ message: 'Failed to fetch workspaces' });
  }
};

export const getWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findById(pid(req))
      .populate('owner', 'name email')
      .populate('members.user', 'name email');

    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found' });
      return;
    }

    const isMember =
      workspace.owner.toString() === req.userId ||
      workspace.members.some((m: any) => m.user._id.toString() === req.userId);

    if (!isMember) {
      res.status(403).json({ message: 'Not a member of this workspace' });
      return;
    }

    res.json({ workspace });
  } catch {
    res.status(500).json({ message: 'Failed to fetch workspace' });
  }
};

export const updateWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    const workspace = await Workspace.findOneAndUpdate(
      { _id: pid(req), owner: req.userId },
      { name },
      { returnDocument: 'after' }
    );

    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found or not authorized' });
      return;
    }

    await logActivity({
      workspace: pid(req),
      user: req.userId!,
      action: 'workspace.updated',
      targetType: 'workspace',
      targetId: workspace._id.toString(),
      metadata: { name },
    });

    res.json({ workspace });
  } catch {
    res.status(500).json({ message: 'Failed to update workspace' });
  }
};

export const deleteWorkspace = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findOneAndDelete({
      _id: pid(req),
      owner: req.userId,
    });

    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found or not authorized' });
      return;
    }

    res.json({ message: 'Workspace deleted' });
  } catch {
    res.status(500).json({ message: 'Failed to delete workspace' });
  }
};
