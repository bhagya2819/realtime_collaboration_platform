import { Request, Response } from 'express';
import { CommentModel, NotificationModel, User } from '../models';
import { io } from '../socket';

const pid = (req: Request): string => req.params.id as string;

const parseMentions = (text: string): string[] => {
  const matches = text.match(/@\[([^\]]+)\]\(([^)]+)\)/g);
  if (!matches) return [];
  return matches.map((m) => {
    const idMatch = m.match(/\(([^)]+)\)/);
    return idMatch ? idMatch[1] : '';
  }).filter(Boolean);
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, selectionReference, threadParent } = req.body;
    const mentionIds = parseMentions(text);

    const comment = await CommentModel.create({
      document: pid(req),
      user: req.userId,
      text,
      selectionReference,
      threadParent: threadParent || null,
      mentions: mentionIds,
    });

    await comment.populate('user', 'name email');

    const actor = await User.findById(req.userId).select('name');

    // Notify mentioned users
    for (const mentionId of mentionIds) {
      await NotificationModel.create({
        recipient: mentionId,
        actor: req.userId,
        type: 'mention',
        message: `${actor?.name || 'Someone'} mentioned you in a comment`,
        targetType: 'document',
        targetId: comment.document as any,
      });

      io?.to(`user:${mentionId}`).emit('notification', {
        type: 'mention',
        message: `${actor?.name || 'Someone'} mentioned you in a comment`,
        targetType: 'document',
        targetId: comment.document,
        notificationId: comment._id,
      });
    }

    // Notify document subscribers (comment added) — broadcast new comment
    io?.to(pid(req)).emit('new-comment', {
      documentId: pid(req),
      comment,
    });

    res.status(201).json({ comment });
  } catch {
    res.status(500).json({ message: 'Failed to add comment' });
  }
};

export const getComments = async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await CommentModel.find({ document: pid(req) })
      .populate('user', 'name email')
      .populate('mentions', 'name email')
      .sort({ createdAt: 1 });

    res.json({ comments });
  } catch {
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
};

export const updateComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const comment = await CommentModel.findOneAndUpdate(
      { _id: pid(req), user: req.userId },
      { text: req.body.text },
      { returnDocument: 'after' }
    ).populate('user', 'name email');

    if (!comment) {
      res.status(404).json({ message: 'Comment not found or not authorized' });
      return;
    }

    res.json({ comment });
  } catch {
    res.status(500).json({ message: 'Failed to update comment' });
  }
};

export const deleteComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const comment = await CommentModel.findOneAndDelete({
      _id: pid(req),
      user: req.userId,
    });

    if (!comment) {
      res.status(404).json({ message: 'Comment not found or not authorized' });
      return;
    }

    res.json({ message: 'Comment deleted' });
  } catch {
    res.status(500).json({ message: 'Failed to delete comment' });
  }
};

export const resolveComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const comment = await CommentModel.findById(pid(req));
    if (!comment) {
      res.status(404).json({ message: 'Comment not found' });
      return;
    }

    comment.resolved = !comment.resolved;
    await comment.save();

    io?.to(comment.document.toString()).emit('comment-resolved', {
      documentId: comment.document.toString(),
      commentId: comment._id.toString(),
    });

    res.json({ comment });
  } catch {
    res.status(500).json({ message: 'Failed to resolve comment' });
  }
};
