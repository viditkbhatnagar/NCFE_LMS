import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssessmentDecision extends Document {
  submissionId: mongoose.Types.ObjectId;
  assessmentCriteriaId: mongoose.Types.ObjectId;
  decision: 'met' | 'not_yet_met';
  assessorId: mongoose.Types.ObjectId;
  learnerId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  vascValid: boolean;
  vascAuthentic: boolean;
  vascSufficient: boolean;
  vascCurrent: boolean;
  decisionDate: Date;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentDecisionSchema = new Schema<IAssessmentDecision>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Submission',
      required: [true, 'Submission ID is required'],
    },
    assessmentCriteriaId: {
      type: Schema.Types.ObjectId,
      ref: 'AssessmentCriteria',
      required: [true, 'Assessment Criteria ID is required'],
    },
    decision: {
      type: String,
      enum: ['met', 'not_yet_met'],
      required: [true, 'Decision is required'],
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
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
    },
    vascValid: {
      type: Boolean,
      required: [true, 'VASC Valid is required'],
    },
    vascAuthentic: {
      type: Boolean,
      required: [true, 'VASC Authentic is required'],
    },
    vascSufficient: {
      type: Boolean,
      required: [true, 'VASC Sufficient is required'],
    },
    vascCurrent: {
      type: Boolean,
      required: [true, 'VASC Current is required'],
    },
    decisionDate: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

AssessmentDecisionSchema.pre('save', function () {
  if (this.decision === 'met') {
    if (!this.vascValid || !this.vascAuthentic || !this.vascSufficient || !this.vascCurrent) {
      throw new Error(
        'All four VASC fields (Valid, Authentic, Sufficient, Current) must be true when decision is "met"'
      );
    }
  }
});

AssessmentDecisionSchema.index({ submissionId: 1 });
AssessmentDecisionSchema.index({ assessmentCriteriaId: 1, learnerId: 1 });

const AssessmentDecision: Model<IAssessmentDecision> =
  mongoose.models.AssessmentDecision ||
  mongoose.model<IAssessmentDecision>('AssessmentDecision', AssessmentDecisionSchema);

export default AssessmentDecision;
