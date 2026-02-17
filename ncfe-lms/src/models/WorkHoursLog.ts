import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWorkHoursLog extends Document {
  enrollmentId: mongoose.Types.ObjectId;
  learnerId: mongoose.Types.ObjectId;
  date: Date;
  hours: number;
  minutes: number;
  notes: string;
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkHoursLogSchema = new Schema<IWorkHoursLog>(
  {
    enrollmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Enrolment',
      required: [true, 'Enrollment ID is required'],
    },
    learnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Learner ID is required'],
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    hours: {
      type: Number,
      default: 0,
      min: 0,
      max: 23,
    },
    minutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 59,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

WorkHoursLogSchema.index({ enrollmentId: 1 });
WorkHoursLogSchema.index({ learnerId: 1 });
WorkHoursLogSchema.index({ enrollmentId: 1, date: 1 });

const WorkHoursLog: Model<IWorkHoursLog> =
  mongoose.models.WorkHoursLog ||
  mongoose.model<IWorkHoursLog>('WorkHoursLog', WorkHoursLogSchema);

export default WorkHoursLog;
