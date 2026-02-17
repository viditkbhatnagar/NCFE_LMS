import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQualification extends Document {
  title: string;
  slug: string;
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
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
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

QualificationSchema.pre('validate', async function () {
  if (this.title && !this.slug) {
    const baseSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    let candidate = baseSlug;
    let suffix = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Model = this.constructor as any;
    const selfId = this._id;

    while (true) {
      const existing = await Model.findOne({
        slug: candidate,
        ...(selfId ? { _id: { $ne: selfId } } : {}),
      });
      if (!existing) break;
      suffix++;
      candidate = `${baseSlug}-${suffix}`;
    }

    this.slug = candidate;
  }
});

QualificationSchema.index({ slug: 1 });

const Qualification: Model<IQualification> =
  mongoose.models.Qualification ||
  mongoose.model<IQualification>('Qualification', QualificationSchema);

export default Qualification;
