import mongoose, { Schema } from 'mongoose';

export interface IActivityLog {
  _id: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  action: 'document.created' | 'document.edited' | 'comment.added' | 'member.invited' | 'role.changed' | 'version.restored' | 'member.joined' | 'workspace.updated';
  targetType: 'document' | 'comment' | 'workspace' | 'version';
  targetId: mongoose.Types.ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: ['document.created', 'document.edited', 'comment.added', 'member.invited', 'role.changed', 'version.restored', 'member.joined', 'workspace.updated'],
      required: true,
    },
    targetType: {
      type: String,
      enum: ['document', 'comment', 'workspace', 'version'],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ workspace: 1, createdAt: -1 });

export const ActivityLogModel = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
