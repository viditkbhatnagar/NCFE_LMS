import mongoose, { Schema, Document, Model } from 'mongoose';

// A Module groups Units within a Qualification:
//   Qualification → Module → Unit → LearningOutcome → AssessmentCriteria
// Existing units created before this layer have no moduleId and are treated
// as "ungrouped" by the admin UI — the field is optional for that reason.

export interface IModule extends Document {
  qualificationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema = new Schema<IModule>(
  {
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Module title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

ModuleSchema.index({ qualificationId: 1, order: 1 });

const Module: Model<IModule> =
  mongoose.models.Module || mongoose.model<IModule>('Module', ModuleSchema);

export default Module;
