import mongoose, { Schema, Document, Model } from 'mongoose';
import type { EnrolmentStatus } from '@/types';

export interface IEnrolment extends Document {
  userId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  cohortId: string;
  // Lead assessor — kept for backward compatibility. Always equals
  // assessorIds[0] when assessorIds is set, so every existing access gate and
  // populate that reads assessorId keeps working against the lead assessor.
  assessorId: mongoose.Types.ObjectId;
  // Full set of assessors assigned to this enrolment (includes the lead).
  // A student is visible to, and accessible by, EVERY assessor listed here.
  assessorIds: mongoose.Types.ObjectId[];
  status: EnrolmentStatus;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EnrolmentSchema = new Schema<IEnrolment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
    cohortId: {
      type: String,
      trim: true,
    },
    assessorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assessorIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    status: {
      type: String,
      enum: ['enrolled', 'in_progress', 'completed', 'withdrawn'],
      default: 'enrolled',
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

EnrolmentSchema.index({ userId: 1 });
EnrolmentSchema.index({ qualificationId: 1 });
EnrolmentSchema.index({ assessorId: 1 });
EnrolmentSchema.index({ assessorIds: 1 });
EnrolmentSchema.index({ userId: 1, qualificationId: 1 });
EnrolmentSchema.index({ status: 1 });

const Enrolment: Model<IEnrolment> =
  mongoose.models.Enrolment ||
  mongoose.model<IEnrolment>('Enrolment', EnrolmentSchema);

export default Enrolment;
