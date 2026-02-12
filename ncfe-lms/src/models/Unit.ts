import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUnit extends Document {
  unitReference: string;
  title: string;
  description: string;
  qualificationId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UnitSchema = new Schema<IUnit>(
  {
    unitReference: {
      type: String,
      required: [true, 'Unit reference is required'],
      trim: true,
    },
    title: {
      type: String,
      required: [true, 'Unit title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

UnitSchema.index({ qualificationId: 1 });

const Unit: Model<IUnit> =
  mongoose.models.Unit || mongoose.model<IUnit>('Unit', UnitSchema);

export default Unit;
