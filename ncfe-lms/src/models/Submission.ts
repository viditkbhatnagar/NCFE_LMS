import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubmission extends Document {
  enrolmentId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  evidenceIds: mongoose.Types.ObjectId[];
  submittedAt: Date;
  attemptNumber: number;
  status: 'submitted' | 'under_review' | 'assessed' | 'resubmission_required';
  learnerId: mongoose.Types.ObjectId;
  assessorId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    enrolmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Enrolment',
      required: [true, 'Enrolment ID is required'],
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit ID is required'],
    },
    evidenceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['submitted', 'under_review', 'assessed', 'resubmission_required'],
      default: 'submitted',
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assessorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

SubmissionSchema.index({ learnerId: 1 });
SubmissionSchema.index({ assessorId: 1 });
SubmissionSchema.index({ status: 1 });

const Submission: Model<ISubmission> =
  mongoose.models.Submission ||
  mongoose.model<ISubmission>('Submission', SubmissionSchema);

export default Submission;
