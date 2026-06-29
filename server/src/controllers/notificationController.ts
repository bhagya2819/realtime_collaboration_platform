import { Request, Response } from 'express';
import { NotificationModel } from '../models';

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await NotificationModel.find({ recipient: req.userId })
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await NotificationModel.countDocuments({
      recipient: req.userId,
      isRead: false,
    });

    res.json({ notifications, unreadCount });
  } catch {
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await NotificationModel.findByIdAndUpdate(
      req.params.id as string,
      { isRead: true }
    );

    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ message: 'Failed to mark as read' });
  }
};

export const markAllRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await NotificationModel.updateMany(
      { recipient: req.userId, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'All marked as read' });
  } catch {
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
};
