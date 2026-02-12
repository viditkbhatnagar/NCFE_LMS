import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILearningMaterial extends Document {
  unitId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  fileUrl: string;
  fileType: 'pdf' | 'pptx' | 'video' | 'template';
  category: 'manual' | 'slides' | 'video' | 'guidance' | 'template';
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
      required: [true, 'File URL is required'],
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'pptx', 'video', 'template'],
      required: [true, 'File type is required'],
    },
    category: {
      type: String,
      enum: ['manual', 'slides', 'video', 'guidance', 'template'],
      required: [true, 'Category is required'],
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

const LearningMaterial: Model<ILearningMaterial> =
  mongoose.models.LearningMaterial ||
  mongoose.model<ILearningMaterial>('LearningMaterial', LearningMaterialSchema);

export default LearningMaterial;
