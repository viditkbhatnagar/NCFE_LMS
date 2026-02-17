import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILearningMaterial extends Document {
  unitId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  fileUrl: string;
  fileName: string;
  fileType: 'pdf' | 'pptx' | 'video' | 'template' | 'other' | '';
  fileSize: number;
  category: 'manual' | 'slides' | 'video' | 'guidance' | 'template' | '';
  folderId: mongoose.Types.ObjectId | null;
  isFolder: boolean;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LearningMaterialSchema = new Schema<ILearningMaterial>(
  {
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      default: '',
      trim: true,
    },
    fileName: {
      type: String,
      default: '',
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'pptx', 'video', 'template', 'other', ''],
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      enum: ['manual', 'slides', 'video', 'guidance', 'template', ''],
      default: '',
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningMaterial',
      default: null,
    },
    isFolder: {
      type: Boolean,
      default: false,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by is required'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

LearningMaterialSchema.index({ qualificationId: 1 });
LearningMaterialSchema.index({ unitId: 1 });
LearningMaterialSchema.index({ folderId: 1 });

const LearningMaterial: Model<ILearningMaterial> =
  mongoose.models.LearningMaterial ||
  mongoose.model<ILearningMaterial>('LearningMaterial', LearningMaterialSchema);

export default LearningMaterial;
