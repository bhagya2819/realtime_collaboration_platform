import { Request, Response } from 'express';
import { DocumentVersionModel, DocumentModel } from '../models';
import { logActivity } from '../services/logActivity';

const pid = (req: Request): string => req.params.id as string;

export const getVersions = async (req: Request, res: Response): Promise<void> => {
  try {
    const versions = await DocumentVersionModel.find({ document: pid(req) })
      .select('snapshotNumber title savedBy createdAt')
      .populate('savedBy', 'name')
      .sort({ snapshotNumber: -1 });

    res.json({ versions });
  } catch {
    res.status(500).json({ message: 'Failed to fetch versions' });
  }
};

export const getVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const version = await DocumentVersionModel.findById(req.params.vid)
      .populate('savedBy', 'name');

    if (!version) {
      res.status(404).json({ message: 'Version not found' });
      return;
    }

    res.json({ version });
  } catch {
    res.status(500).json({ message: 'Failed to fetch version' });
  }
};

export const restoreVersion = async (req: Request, res: Response): Promise<void> => {
  try {
    const version = await DocumentVersionModel.findById(req.params.vid);
    if (!version) {
      res.status(404).json({ message: 'Version not found' });
      return;
    }

    const document = await DocumentModel.findByIdAndUpdate(
      pid(req),
      { content: version.content, title: version.title, lastEditedBy: req.userId },
      { returnDocument: 'after' }
    );

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    await logActivity({
      workspace: document.workspace.toString(),
      user: req.userId!,
      action: 'version.restored',
      targetType: 'version',
      targetId: version._id.toString(),
      metadata: { snapshotNumber: version.snapshotNumber },
    });

    res.json({ document });
  } catch {
    res.status(500).json({ message: 'Failed to restore version' });
  }
};

let lastSnapshotTime = new Map<string, number>();

export const createSnapshot = async (documentId: string, content: any, title: string, userId: string): Promise<void> => {
  const now = Date.now();
  const lastTime = lastSnapshotTime.get(documentId) || 0;

  if (now - lastTime < 30000) return;

  lastSnapshotTime.set(documentId, now);

  try {
    const latest = await DocumentVersionModel.findOne({ document: documentId })
      .sort({ snapshotNumber: -1 })
      .select('snapshotNumber');

    const nextNumber = (latest?.snapshotNumber || 0) + 1;

    await DocumentVersionModel.create({
      document: documentId,
      content,
      title,
      snapshotNumber: nextNumber,
      savedBy: userId,
    });
  } catch {
    // Snapshot failure is non-critical
  }
};
