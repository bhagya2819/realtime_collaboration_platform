import mongoose, { Schema } from 'mongoose';

export interface IComment {
  _id: mongoose.Types.ObjectId;
  document: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  text: string;
  selectionReference?: object;
  threadParent?: mongoose.Types.ObjectId;
  resolved: boolean;
  mentions: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    document: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    selectionReference: { type: Schema.Types.Mixed },
    threadParent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    resolved: { type: Boolean, default: false },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export const CommentModel = mongoose.model<IComment>('Comment', commentSchema);
