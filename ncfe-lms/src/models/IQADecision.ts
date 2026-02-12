import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIQADecision extends Document {
  iqaSampleId: mongoose.Types.ObjectId;
  decision: 'approved' | 'action_required' | 'reassessment_required';
  rationale: string;
  actionsForAssessor: string;
  decidedAt: Date;
  iqaUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IQADecisionSchema = new Schema<IIQADecision>(
  {
    iqaSampleId: {
      type: Schema.Types.ObjectId,
      ref: 'IQASample',
      required: [true, 'IQA Sample ID is required'],
    },
    decision: {
      type: String,
      enum: ['approved', 'action_required', 'reassessment_required'],
      required: [true, 'Decision is required'],
    },
    rationale: {
      type: String,
      required: [true, 'Rationale is required'],
      trim: true,
    },
    actionsForAssessor: {
      type: String,
      trim: true,
    },
    decidedAt: {
      type: Date,
      default: Date.now,
    },
    iqaUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'IQA User ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

IQADecisionSchema.index({ iqaSampleId: 1 });

const IQADecision: Model<IIQADecision> =
  mongoose.models.IQADecision ||
  mongoose.model<IIQADecision>('IQADecision', IQADecisionSchema);

export default IQADecision;
