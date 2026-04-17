import { RequestHandler } from 'express';

export interface ChannelChat {
  id: string;
  provider: string;
  enabled: boolean;
  [key: string]: unknown;
}

export interface ChannelAuth {
  id: string;
  provider: string;
  type: string;
  isExternal: boolean;
}

export interface ChannelsResponse {
  chat: ChannelChat[];
  auth: ChannelAuth[];
}

export type AddChannelBody = { channel: string } & Record<string, string>;
export type RemoveChannelQuery = { account?: string };

export type ChannelOpResult = { ok: boolean; error?: string };

export type List = RequestHandler<never, ChannelsResponse, never, never>;
export type Add = RequestHandler<never, ChannelOpResult, AddChannelBody, never>;
export type Remove = RequestHandler<{ name: string }, ChannelOpResult, never, RemoveChannelQuery>;
