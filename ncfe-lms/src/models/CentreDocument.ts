import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICentreDocument extends Document {
  title: string;
  category: 'sampling_plan' | 'iqa_report' | 'cpd_record' | 'action_plan' | 'other';
  fileUrl: string;
  description: string;
  centreId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CentreDocumentSchema = new Schema<ICentreDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    category: {
      type: String,
      enum: ['sampling_plan', 'iqa_report', 'cpd_record', 'action_plan', 'other'],
      required: [true, 'Category is required'],
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    centreId: {
      type: Schema.Types.ObjectId,
      ref: 'Centre',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploaded by is required'],
    },
  },
  {
    timestamps: true,
  }
);

CentreDocumentSchema.index({ centreId: 1 });
CentreDocumentSchema.index({ category: 1 });

const CentreDocument: Model<ICentreDocument> =
  mongoose.models.CentreDocument ||
  mongoose.model<ICentreDocument>('CentreDocument', CentreDocumentSchema);

export default CentreDocument;
