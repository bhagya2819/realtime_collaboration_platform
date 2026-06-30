import { Request, Response } from 'express';
import { DocumentModel, Workspace } from '../models';
import { logActivity } from '../services/logActivity';
import { createSnapshot } from './versionController';
import { getDocumentWithCache, invalidateDocumentCache } from '../services/documentCache';

const pid = (req: Request): string => req.params.id as string;

export const createDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findOne({
      _id: pid(req),
      $or: [{ owner: req.userId }, { 'members.user': req.userId }],
    });

    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found or not authorized' });
      return;
    }

    const { title } = req.body;
    const document = await DocumentModel.create({
      workspace: pid(req),
      title,
      content: { type: 'doc', content: [] },
      createdBy: req.userId,
      lastEditedBy: req.userId,
    });

    await logActivity({
      workspace: pid(req),
      user: req.userId!,
      action: 'document.created',
      targetType: 'document',
      targetId: document._id.toString(),
      metadata: { title },
    });

    res.status(201).json({ document });
  } catch {
    res.status(500).json({ message: 'Failed to create document' });
  }
};

export const getDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const workspace = await Workspace.findOne({
      _id: pid(req),
      $or: [{ owner: req.userId }, { 'members.user': req.userId }],
    });

    if (!workspace) {
      res.status(404).json({ message: 'Workspace not found or not authorized' });
      return;
    }

    const documents = await DocumentModel.find({
      workspace: pid(req),
      isArchived: false,
    })
      .select('title createdBy lastEditedBy updatedAt createdAt')
      .populate('createdBy', 'name')
      .populate('lastEditedBy', 'name')
      .sort({ updatedAt: -1 });

    res.json({ documents });
  } catch {
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
};

export const getDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const document = await getDocumentWithCache(pid(req));

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.json({ document });
  } catch {
    res.status(500).json({ message: 'Failed to fetch document' });
  }
};

export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: Record<string, any> = { lastEditedBy: req.userId };

    if (req.body.title !== undefined) update.title = req.body.title;
    if (req.body.content !== undefined) update.content = req.body.content;

    const document = await DocumentModel.findByIdAndUpdate(pid(req), update, { returnDocument: 'after' });

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    if (req.body.content !== undefined) {
      await logActivity({
        workspace: document.workspace.toString(),
        user: req.userId!,
        action: 'document.edited',
        targetType: 'document',
        targetId: document._id.toString(),
      });

      createSnapshot(document._id.toString(), document.content, document.title, req.userId!);
      invalidateDocumentCache(document._id.toString());
    }

    res.json({ document });
  } catch {
    res.status(500).json({ message: 'Failed to update document' });
  }
};

export const archiveDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const document = await DocumentModel.findByIdAndUpdate(
      pid(req),
      { isArchived: true },
      { returnDocument: 'after' }
    );

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.json({ document });
  } catch {
    res.status(500).json({ message: 'Failed to archive document' });
  }
};
