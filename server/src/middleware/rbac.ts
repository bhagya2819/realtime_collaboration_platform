import { Request, Response, NextFunction } from 'express';
import { Workspace } from '../models';

export const authorize = (...roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const workspaceId = req.params.workspaceId || req.params.id;
    if (!workspaceId) {
      next();
      return;
    }

    try {
      const workspace = await Workspace.findById(workspaceId).select('owner members');
      if (!workspace) {
        res.status(404).json({ message: 'Workspace not found' });
        return;
      }

      if (workspace.owner.toString() === req.userId) {
        next();
        return;
      }

      const member = workspace.members.find(
        (m) => m.user.toString() === req.userId
      );

      if (!member) {
        res.status(403).json({ message: 'Not a member of this workspace' });
        return;
      }

      if (!roles.includes(member.role)) {
        res.status(403).json({ message: `Requires ${roles.join(' or ')} role` });
        return;
      }

      req.userRole = member.role;
      next();
    } catch {
      res.status(500).json({ message: 'Authorization check failed' });
    }
  };
};

declare global {
  namespace Express {
    interface Request {
      userRole?: string;
    }
  }
}
