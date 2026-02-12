import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IStandardisationRecord extends Document {
  title: string;
  date: Date;
  attendees: string[];
  minutes: string;
  outcomes: string;
  centreId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StandardisationRecordSchema = new Schema<IStandardisationRecord>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    attendees: [
      {
        type: String,
        trim: true,
      },
    ],
    minutes: {
      type: String,
      trim: true,
    },
    outcomes: {
      type: String,
      trim: true,
    },
    centreId: {
      type: Schema.Types.ObjectId,
      ref: 'Centre',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
  },
  {
    timestamps: true,
  }
);

StandardisationRecordSchema.index({ centreId: 1 });
StandardisationRecordSchema.index({ createdBy: 1 });

const StandardisationRecord: Model<IStandardisationRecord> =
  mongoose.models.StandardisationRecord ||
  mongoose.model<IStandardisationRecord>('StandardisationRecord', StandardisationRecordSchema);

export default StandardisationRecord;
