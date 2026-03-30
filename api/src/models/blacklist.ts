import { Schema, model } from 'mongoose';
import { IBlackList } from '../@types/blacklist';

const blackListSchema = new Schema<IBlackList>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  hash: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now(),
  },
}, {
  versionKey: false,
});

export default model<IBlackList>('BlackList', blackListSchema);
