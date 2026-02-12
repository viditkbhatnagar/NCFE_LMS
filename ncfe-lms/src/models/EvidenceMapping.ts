import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEvidenceMapping extends Document {
  evidenceId: mongoose.Types.ObjectId;
  assessmentCriteriaId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  learningOutcomeId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  learnerId: mongoose.Types.ObjectId;
  status: 'active' | 'superseded';
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceMappingSchema = new Schema<IEvidenceMapping>(
  {
    evidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      required: [true, 'Evidence ID is required'],
    },
    assessmentCriteriaId: {
      type: Schema.Types.ObjectId,
      ref: 'AssessmentCriteria',
      required: [true, 'Assessment Criteria ID is required'],
    },
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
    },
    learningOutcomeId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningOutcome',
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['active', 'superseded'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

EvidenceMappingSchema.index({ assessmentCriteriaId: 1, learnerId: 1 });
EvidenceMappingSchema.index({ evidenceId: 1 });

const EvidenceMapping: Model<IEvidenceMapping> =
  mongoose.models.EvidenceMapping ||
  mongoose.model<IEvidenceMapping>('EvidenceMapping', EvidenceMappingSchema);

export default EvidenceMapping;
