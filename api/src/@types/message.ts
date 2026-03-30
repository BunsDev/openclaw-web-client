import { Types } from 'mongoose';
import { RequestHandler } from 'express';
import { RequestParams, APIResponse } from './shared';

export type MessageRole = 'user' | 'assistant';

export type MessageFile = {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
};

export type IMessage = {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  text: string;
  thinking: string | null;
  files: MessageFile[];
  role: MessageRole;
  createdBy: Types.ObjectId;
  createdAt: Date | string;
  deletedAt: Date | string | null;
};

export type CMessage = Omit<IMessage, 'deletedAt'> | null;

export type MessageRequestBody = {
  conversationId?: string;
  text?: string;
};

export type ChatRequestBody = {
  conversationId?: string;
  text?: string;
};

export type ListByConversation = RequestHandler<{ conversationId: string }, APIResponse<CMessage>, never, never>;
export type Create = RequestHandler<never, CMessage, MessageRequestBody, never>;
export type Chat = RequestHandler<never, unknown, ChatRequestBody, never>;
export type Destroy = RequestHandler<RequestParams, null, never, never>;
