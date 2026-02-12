import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQualification extends Document {
  title: string;
  level: number;
  code: string;
  awardingBody: string;
  description: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const QualificationSchema = new Schema<IQualification>(
  {
    title: {
      type: String,
      required: [true, 'Qualification title is required'],
      trim: true,
    },
    level: {
      type: Number,
      required: [true, 'Level is required'],
      enum: [2, 3, 5],
    },
    code: {
      type: String,
      required: [true, 'Qualification code is required'],
      unique: true,
      trim: true,
    },
    awardingBody: {
      type: String,
      required: [true, 'Awarding body is required'],
      default: 'NCFE/CACHE',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

const Qualification: Model<IQualification> =
  mongoose.models.Qualification ||
  mongoose.model<IQualification>('Qualification', QualificationSchema);

export default Qualification;
