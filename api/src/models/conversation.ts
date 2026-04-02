import { Schema, model } from 'mongoose';
import { IConversation } from '../@types/conversation';

const conversationSchema = new Schema<IConversation>({
  agentId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Agent',
    index: true,
  },
  title: {
    type: String,
    default: null,
  },
  sessionKey: {
    type: String,
    default: null,
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

conversationSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function () {
  this.where({ deletedAt: null });
});

conversationSchema.post('save', function () {
  this.set('deletedAt', undefined);
});

export default model<IConversation>('Conversation', conversationSchema);
