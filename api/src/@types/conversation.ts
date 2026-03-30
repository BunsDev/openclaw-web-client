import { Types } from 'mongoose';
import { RequestHandler } from 'express';
import { RequestParams, APIResponse } from './shared';

export type IConversation = {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  title: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date | string;
  deletedAt: Date | string | null;
};

export type CConversation = Omit<IConversation, 'deletedAt'> | null;

export type ConversationRequestBody = {
  agentId?: string;
};

export type ConversationUpdateBody = {
  title?: string;
};

export type ListByAgent = RequestHandler<{ agentId: string }, APIResponse<CConversation>, never, never>;
export type Create = RequestHandler<never, CConversation, ConversationRequestBody, never>;
export type Update = RequestHandler<RequestParams, CConversation, ConversationUpdateBody, never>;
export type Destroy = RequestHandler<RequestParams, null, never, never>;
