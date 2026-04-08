export type IBlackList = {
  _id: number;
  userId: number;
  hash: string;
  createdAt: Date;
};

export type JwtPayload = {
  id: string;
  valid: string;
};
