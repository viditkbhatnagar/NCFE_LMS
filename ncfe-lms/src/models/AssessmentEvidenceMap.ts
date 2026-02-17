import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAssessmentEvidenceMap extends Document {
  assessmentId: mongoose.Types.ObjectId;
  evidenceId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentEvidenceMapSchema = new Schema<IAssessmentEvidenceMap>(
  {
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
    },
    evidenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Evidence',
      required: [true, 'Evidence ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

AssessmentEvidenceMapSchema.index({ assessmentId: 1 });
AssessmentEvidenceMapSchema.index({ assessmentId: 1, evidenceId: 1 }, { unique: true });

const AssessmentEvidenceMap: Model<IAssessmentEvidenceMap> =
  mongoose.models.AssessmentEvidenceMap ||
  mongoose.model<IAssessmentEvidenceMap>('AssessmentEvidenceMap', AssessmentEvidenceMapSchema);

export default AssessmentEvidenceMap;
