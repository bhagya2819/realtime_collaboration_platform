import mongoose, { Document, Schema } from 'mongoose';
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export interface IWorkspaceMember {
  user: mongoose.Types.ObjectId;
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: Date;
}

export interface IWorkspace extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  owner: mongoose.Types.ObjectId;
  members: IWorkspaceMember[];
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'editor' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [workspaceMemberSchema], default: [] },
    inviteCode: {
      type: String,
      unique: true,
      default: () => generateInviteCode(),
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ 'members.user': 1 });

export const Workspace = mongoose.model<IWorkspace>('Workspace', workspaceSchema);
