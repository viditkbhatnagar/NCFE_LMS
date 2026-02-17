import mongoose, { Schema, Document, Model } from 'mongoose';
import type { AssessmentKind, AssessmentStatus } from '@/types';

export interface IAssessment extends Document {
  title: string;
  date: Date;
  assessmentKind: AssessmentKind | null;
  planIntent: string;
  planImplementation: string;
  status: AssessmentStatus;
  learnerId: mongoose.Types.ObjectId;
  assessorId: mongoose.Types.ObjectId;
  enrollmentId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>(
  {
    title: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    assessmentKind: {
      type: String,
      enum: [
        'observation',
        'professional_discussion',
        'reflective_account',
        'verbal_assessment',
        'written_assessment',
        'work_product',
        'witness_testimony',
        null,
      ],
      default: null,
    },
    planIntent: {
      type: String,
      default: '',
    },
    planImplementation: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Learner ID is required'],
    },
    assessorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assessor ID is required'],
    },
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Enrolment',
      required: [true, 'Enrollment ID is required'],
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

AssessmentSchema.index({ assessorId: 1 });
AssessmentSchema.index({ learnerId: 1 });
AssessmentSchema.index({ enrollmentId: 1 });
AssessmentSchema.index({ status: 1 });
AssessmentSchema.index({ date: -1 });

const Assessment: Model<IAssessment> =
  mongoose.models.Assessment ||
  mongoose.model<IAssessment>('Assessment', AssessmentSchema);

export default Assessment;
