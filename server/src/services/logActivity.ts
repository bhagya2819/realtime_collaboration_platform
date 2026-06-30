import { ActivityLogModel } from '../models';

interface LogEntry {
  workspace: string;
  user: string;
  action: 'document.created' | 'document.edited' | 'comment.added' | 'member.invited' | 'role.changed' | 'version.restored' | 'member.joined' | 'workspace.updated';
  targetType: 'document' | 'comment' | 'workspace' | 'version';
  targetId: string;
  metadata?: Record<string, any>;
}

export const logActivity = async (entry: LogEntry): Promise<void> => {
  try {
    await ActivityLogModel.create(entry);
  } catch {
    // Activity logging should not block the main operation
  }
};
