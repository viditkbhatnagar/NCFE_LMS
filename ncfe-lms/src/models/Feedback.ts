import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeedback extends Document {
  submissionId: mongoose.Types.ObjectId;
  assessorId: mongoose.Types.ObjectId;
  learnerId: mongoose.Types.ObjectId;
  strengths: string;
  gaps: string;
  actionsRequired: string;
  isResubmissionRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Submission',
      required: [true, 'Submission ID is required'],
    },
    assessorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assessor ID is required'],
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    strengths: {
      type: String,
      required: [true, 'Strengths is required'],
      trim: true,
    },
    gaps: {
      type: String,
      trim: true,
    },
    actionsRequired: {
      type: String,
      trim: true,
    },
    isResubmissionRequired: {
      type: Boolean,
      default: false,
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

FeedbackSchema.index({ submissionId: 1 });

const Feedback: Model<IFeedback> =
  mongoose.models.Feedback ||
  mongoose.model<IFeedback>('Feedback', FeedbackSchema);

export default Feedback;
