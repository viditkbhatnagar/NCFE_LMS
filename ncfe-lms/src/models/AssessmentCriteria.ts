import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssessmentCriteria extends Document {
  learningOutcomeId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  acNumber: string;
  description: string;
  evidenceRequirements: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentCriteriaSchema = new Schema<IAssessmentCriteria>(
  {
    learningOutcomeId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningOutcome',
      required: [true, 'Learning Outcome ID is required'],
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit ID is required'],
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
    acNumber: {
      type: String,
      required: [true, 'AC number is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    evidenceRequirements: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

AssessmentCriteriaSchema.index({ learningOutcomeId: 1 });
AssessmentCriteriaSchema.index({ unitId: 1 });
AssessmentCriteriaSchema.index({ qualificationId: 1 });

const AssessmentCriteria: Model<IAssessmentCriteria> =
  mongoose.models.AssessmentCriteria ||
  mongoose.model<IAssessmentCriteria>('AssessmentCriteria', AssessmentCriteriaSchema);

export default AssessmentCriteria;
