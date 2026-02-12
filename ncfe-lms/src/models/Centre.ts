import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICentre extends Document {
  name: string;
  code: string;
  contactEmail: string;
  address: string;
  ncfeCentreNumber: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const CentreSchema = new Schema<ICentre>(
  {
    name: {
      type: String,
      required: [true, 'Centre name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Centre code is required'],
      unique: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    ncfeCentreNumber: {
      type: String,
      required: [true, 'NCFE centre number is required'],
      unique: true,
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

const Centre: Model<ICentre> =
  mongoose.models.Centre || mongoose.model<ICentre>('Centre', CentreSchema);

export default Centre;
