import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICriterionComment extends Document {
  assessmentId: mongoose.Types.ObjectId;
  criteriaId: mongoose.Types.ObjectId;
  content: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CriterionCommentSchema = new Schema<ICriterionComment>(
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
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
    },
  },
  { timestamps: true }
);

CriterionCommentSchema.index({ assessmentId: 1, criteriaId: 1, createdAt: -1 });
CriterionCommentSchema.index({ assessmentId: 1 });

const CriterionComment: Model<ICriterionComment> =
  mongoose.models.CriterionComment ||
  mongoose.model<ICriterionComment>('CriterionComment', CriterionCommentSchema);

export default CriterionComment;
