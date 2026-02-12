import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ILearningOutcome extends Document {
  unitId: mongoose.Types.ObjectId;
  loNumber: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

const LearningOutcomeSchema = new Schema<ILearningOutcome>(
  {
    unitId: {
      type: Schema.Types.ObjectId,
      ref: 'Unit',
      required: [true, 'Unit ID is required'],
    },
    loNumber: {
      type: String,
      required: [true, 'LO number is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

LearningOutcomeSchema.index({ unitId: 1 });

const LearningOutcome: Model<ILearningOutcome> =
  mongoose.models.LearningOutcome ||
  mongoose.model<ILearningOutcome>('LearningOutcome', LearningOutcomeSchema);

export default LearningOutcome;
