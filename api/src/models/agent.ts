import { Schema, model } from 'mongoose';
import { IAgent } from '../@types/agent';

const agentSchema = new Schema<IAgent>({
  name: {
    type: String,
    required: true,
  },
  openclawAgentId: {
    type: String,
    default: 'main',
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
  updatedAt: {
    type: Date,
    default: null,
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

agentSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function () {
  this.where({ deletedAt: null });
});

agentSchema.post('save', function () {
  this.set('deletedAt', undefined);
});

export default model<IAgent>('Agent', agentSchema);
