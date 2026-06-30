import { Request, Response } from 'express';
import { ActivityLogModel } from '../models';

export const getActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const activities = await ActivityLogModel.find({ workspace: req.params.id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ activities });
  } catch {
    res.status(500).json({ message: 'Failed to fetch activity' });
  }
};
