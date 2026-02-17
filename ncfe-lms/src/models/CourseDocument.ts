import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICourseDocument extends Document {
  qualificationId: mongoose.Types.ObjectId;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  folderId: mongoose.Types.ObjectId | null;
  isFolder: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CourseDocumentSchema = new Schema<ICourseDocument>(
  {
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
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
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'CourseDocument',
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

CourseDocumentSchema.index({ qualificationId: 1 });
CourseDocumentSchema.index({ folderId: 1 });

const CourseDoc: Model<ICourseDocument> =
  mongoose.models.CourseDocument ||
  mongoose.model<ICourseDocument>('CourseDocument', CourseDocumentSchema);

export default CourseDoc;
