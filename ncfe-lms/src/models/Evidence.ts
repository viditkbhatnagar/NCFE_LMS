import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvidence extends Document {
  enrolmentId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  label: string;
  description: string;
  uploadedAt: Date;
  attemptNumber: number;
  status: 'draft' | 'submitted' | 'assessed';
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<IEvidence>(
  {
    enrolmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Enrolment',
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'assessed'],
      default: 'draft',
    },
  },
  {
    timestamps: true,
  }
);

EvidenceSchema.index({ enrolmentId: 1 });
EvidenceSchema.index({ unitId: 1 });

const Evidence: Model<IEvidence> =
  mongoose.models.Evidence ||
  mongoose.model<IEvidence>('Evidence', EvidenceSchema);

export default Evidence;
