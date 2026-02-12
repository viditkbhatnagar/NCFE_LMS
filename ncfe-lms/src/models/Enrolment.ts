import mongoose, { Schema, Document, Model } from 'mongoose';
import type { EnrolmentStatus } from '@/types';

export interface IEnrolment extends Document {
  userId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  cohortId: string;
  assessorId: mongoose.Types.ObjectId;
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

const Enrolment: Model<IEnrolment> =
  mongoose.models.Enrolment ||
  mongoose.model<IEnrolment>('Enrolment', EnrolmentSchema);

export default Enrolment;
