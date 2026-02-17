import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssessmentCriteriaMap extends Document {
  assessmentId: mongoose.Types.ObjectId;
  criteriaId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentCriteriaMapSchema = new Schema<IAssessmentCriteriaMap>(
  {
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
    },
    criteriaId: {
      type: Schema.Types.ObjectId,
      ref: 'AssessmentCriteria',
      required: [true, 'Criteria ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

AssessmentCriteriaMapSchema.index({ assessmentId: 1 });
AssessmentCriteriaMapSchema.index({ assessmentId: 1, criteriaId: 1 }, { unique: true });

const AssessmentCriteriaMap: Model<IAssessmentCriteriaMap> =
  mongoose.models.AssessmentCriteriaMap ||
  mongoose.model<IAssessmentCriteriaMap>('AssessmentCriteriaMap', AssessmentCriteriaMapSchema);

export default AssessmentCriteriaMap;
