import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { UserRole, UserStatus } from '@/types';

export interface IUser extends Document {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  centreId: mongoose.Types.ObjectId;
  googleId?: string;
  avatar?: string;
  status: UserStatus;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    passwordHash: {
      type: String,
      required: function (this: IUser) {
        return !this.googleId;
      },
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'assessor', 'iqa', 'admin'],
      required: [true, 'Role is required'],
      default: 'student',
    },
    centreId: {
      type: Schema.Types.ObjectId,
      ref: 'Centre',
    },
    googleId: {
      type: String,
      sparse: true,
    },
    avatar: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ role: 1 });
UserSchema.index({ centreId: 1 });

UserSchema.pre('save', async function () {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
