import mongoose, { Schema } from 'mongoose';

export interface IDocumentVersion {
  _id: mongoose.Types.ObjectId;
  document: mongoose.Types.ObjectId;
  content: Record<string, any>;
  title: string;
  snapshotNumber: number;
  savedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const documentVersionSchema = new Schema<IDocumentVersion>(
  {
    document: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    content: { type: Schema.Types.Mixed, required: true },
    title: { type: String, required: true },
    snapshotNumber: { type: Number, required: true },
    savedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

documentVersionSchema.index({ document: 1, snapshotNumber: -1 });

export const DocumentVersionModel = mongoose.model<IDocumentVersion>('DocumentVersion', documentVersionSchema);
