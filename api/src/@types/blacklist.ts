import { Types } from 'mongoose';

export type IBlackList = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  hash: string;
  createdAt: Date;
};

export type JwtPayload = {
  id: string;
  valid: string;
};
