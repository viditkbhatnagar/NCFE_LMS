import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  threadId: string;
  senderId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  content: string;
  attachmentUrl: string;
  readAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    threadId: {
      type: String,
      required: [true, 'Thread ID is required'],
      trim: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    attachmentUrl: {
      type: String,
      trim: true,
    },
    readAt: {
      type: Date,
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

MessageSchema.index({ threadId: 1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ recipientId: 1 });

const Message: Model<IMessage> =
  mongoose.models.Message ||
  mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
