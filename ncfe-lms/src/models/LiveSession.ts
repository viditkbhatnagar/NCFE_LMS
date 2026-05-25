import mongoose, { Schema, Document, Model } from 'mongoose';

// A scheduled live class / webinar for a course. Created by an admin or
// assessor with a meeting link (Zoom / Meet / Teams) and an optional cohort
// scope. After the class, the recording is uploaded onto the same record.

export type LiveSessionStatus = 'scheduled' | 'completed' | 'cancelled';

export interface ILiveSession extends Document {
  qualificationId: mongoose.Types.ObjectId;
  cohortId: string; // '' means all cohorts on the course
  title: string;
  description: string;
  meetingLink: string;
  scheduledAt: Date;
  durationMinutes: number;
  createdBy: mongoose.Types.ObjectId;
  recordingUrl?: string;
  recordingStorageKey?: string;
  recordingStorageProvider?: 'local' | 's3';
  recordingStorageBucket?: string;
  // External recording link (Google Drive / OneDrive / YouTube). When set,
  // the "Watch recording" button opens this URL in a new tab — used as an
  // alternative to uploading the file directly into S3 for large recordings.
  recordingLink?: string;
  status: LiveSessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const LiveSessionSchema = new Schema<ILiveSession>(
  {
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'Qualification',
      required: [true, 'Qualification ID is required'],
    },
    cohortId: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    meetingLink: {
      type: String,
      required: [true, 'Meeting link is required'],
      trim: true,
    },
    scheduledAt: {
      type: Date,
      required: [true, 'Scheduled date/time is required'],
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: 5,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recordingUrl: { type: String, trim: true },
    recordingStorageKey: { type: String, trim: true },
    recordingStorageProvider: { type: String, enum: ['local', 's3'] },
    recordingStorageBucket: { type: String, trim: true },
    recordingLink: { type: String, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  {
    timestamps: true,
  }
);

LiveSessionSchema.index({ qualificationId: 1, scheduledAt: -1 });

const LiveSession: Model<ILiveSession> =
  mongoose.models.LiveSession ||
  mongoose.model<ILiveSession>('LiveSession', LiveSessionSchema);

export default LiveSession;
