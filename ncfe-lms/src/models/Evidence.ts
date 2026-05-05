import mongoose, { Schema, Document, Model } from 'mongoose';

export type EvidenceKind =
  | 'observation'
  | 'professional_discussion'
  | 'reflective_account'
  | 'verbal_assessment'
  | 'written_assessment'
  | 'work_product'
  | 'witness_testimony';

export interface IEvidence extends Document {
  enrolmentId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageProvider?: 'local' | 's3';
  storageBucket?: string;
  storageKey?: string;
  label: string;
  description: string;
  uploadedAt: Date;
  attemptNumber: number;
  status: 'draft' | 'submitted' | 'assessed';
  evidenceKind?: EvidenceKind;
  witnessName?: string;
  witnessRole?: string;
  witnessEmployer?: string;
  witnessEmail?: string;
  witnessStatement?: string;
  thumbnailUrl?: string;
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
    evidenceKind: {
      type: String,
      enum: [
        'observation',
        'professional_discussion',
        'reflective_account',
        'verbal_assessment',
        'written_assessment',
        'work_product',
        'witness_testimony',
      ],
    },
    witnessName: { type: String, trim: true },
    witnessRole: { type: String, trim: true },
    witnessEmployer: { type: String, trim: true },
    witnessEmail: { type: String, trim: true, lowercase: true },
    witnessStatement: { type: String, trim: true, maxlength: 5000 },
    thumbnailUrl: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

EvidenceSchema.index({ enrolmentId: 1 });
EvidenceSchema.index({ unitId: 1 });
EvidenceSchema.index({ status: 1 });

const Evidence: Model<IEvidence> =
  mongoose.models.Evidence ||
  mongoose.model<IEvidence>('Evidence', EvidenceSchema);

export default Evidence;
