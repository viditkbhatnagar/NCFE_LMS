import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRemark extends Document {
  assessmentId: mongoose.Types.ObjectId;
  content: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RemarkSchema = new Schema<IRemark>(
  {
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Remark content is required'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
    },
  },
  {
    timestamps: true,
  }
);

RemarkSchema.index({ assessmentId: 1 });

const Remark: Model<IRemark> =
  mongoose.models.Remark ||
  mongoose.model<IRemark>('Remark', RemarkSchema);

export default Remark;
