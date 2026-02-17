import mongoose, { Schema, Document, Model } from 'mongoose';
import type { SignOffRole, SignOffStatus } from '@/types';

export interface ISignOff extends Document {
  assessmentId: mongoose.Types.ObjectId;
  role: SignOffRole;
  status: SignOffStatus;
  signedOffBy: mongoose.Types.ObjectId | null;
  signedOffAt: Date | null;
  comments: string;
  createdAt: Date;
  updatedAt: Date;
}

const SignOffSchema = new Schema<ISignOff>(
  {
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
    },
    role: {
      type: String,
      enum: ['assessor', 'iqa', 'eqa', 'learner'],
      required: [true, 'Role is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'signed_off', 'rejected'],
      default: 'pending',
    },
    signedOffBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    signedOffAt: {
      type: Date,
      default: null,
    },
    comments: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

SignOffSchema.index({ assessmentId: 1 });
SignOffSchema.index({ assessmentId: 1, role: 1 }, { unique: true });

const SignOff: Model<ISignOff> =
  mongoose.models.SignOff ||
  mongoose.model<ISignOff>('SignOff', SignOffSchema);

export default SignOff;
