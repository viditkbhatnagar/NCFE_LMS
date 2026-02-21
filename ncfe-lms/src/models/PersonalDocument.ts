import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPersonalDocument extends Document {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  storageProvider?: 'local' | 's3';
  storageBucket?: string;
  storageKey?: string;
  folderId: mongoose.Types.ObjectId | null;
  isFolder: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PersonalDocumentSchema = new Schema<IPersonalDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileUrl: {
      type: String,
      default: '',
      trim: true,
    },
    fileType: {
      type: String,
      default: '',
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    storageProvider: {
      type: String,
      enum: ['local', 's3'],
      default: undefined,
    },
    storageBucket: {
      type: String,
      trim: true,
    },
    storageKey: {
      type: String,
      trim: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'PersonalDocument',
      default: null,
    },
    isFolder: {
      type: Boolean,
      default: false,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required'],
    },
  },
  {
    timestamps: true,
  }
);

PersonalDocumentSchema.index({ userId: 1 });
PersonalDocumentSchema.index({ folderId: 1 });

const PersonalDocument: Model<IPersonalDocument> =
  mongoose.models.PersonalDocument ||
  mongoose.model<IPersonalDocument>('PersonalDocument', PersonalDocumentSchema);

export default PersonalDocument;
