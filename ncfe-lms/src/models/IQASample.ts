import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIQASample extends Document {
  iqaUserId: mongoose.Types.ObjectId;
  assessorId: mongoose.Types.ObjectId;
  learnerId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  qualificationId: mongoose.Types.ObjectId;
  assessmentMethodsSampled: string[];
  stage: 'early' | 'mid' | 'late';
  status: 'pending' | 'reviewed' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const IQASampleSchema = new Schema<IIQASample>(
  {
    iqaUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'IQA User ID is required'],
    },
    assessorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assessor ID is required'],
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Learner ID is required'],
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
    assessmentMethodsSampled: [
      {
        type: String,
        trim: true,
      },
    ],
    stage: {
      type: String,
      enum: ['early', 'mid', 'late'],
      required: [true, 'Stage is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'completed'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

IQASampleSchema.index({ iqaUserId: 1 });
IQASampleSchema.index({ assessorId: 1 });

const IQASample: Model<IIQASample> =
  mongoose.models.IQASample ||
  mongoose.model<IIQASample>('IQASample', IQASampleSchema);

export default IQASample;
