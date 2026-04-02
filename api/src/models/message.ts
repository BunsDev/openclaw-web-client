import { Schema, model } from 'mongoose';
import { IMessage } from '../@types/message';

const fileSchema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  url: { type: String, required: true },
}, { _id: false });

const messageSchema = new Schema<IMessage>({
  conversationId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Conversation',
    index: true,
  },
  externalId: {
    type: String,
    default: null,
    index: true,
    sparse: true,
  },
  text: {
    type: String,
    required: true,
  },
  thinking: {
    type: String,
    default: null,
  },
  files: {
    type: [fileSchema],
    default: [],
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    default: 'user',
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  deletedAt: {
    type: Date,
    default: null,
    select: false,
  },
}, {
  versionKey: false,
});

/* eslint-disable prefer-arrow-callback,func-names */

messageSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function () {
  this.where({ deletedAt: null });
});

messageSchema.post('save', function () {
  this.set('deletedAt', undefined);
});

export default model<IMessage>('Message', messageSchema);
