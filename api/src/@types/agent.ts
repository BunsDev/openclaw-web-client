import { RequestHandler } from 'express';
import { QueryFilters, RequestParams, APIResponse } from './shared';

export type IAgent = {
  _id: number;
  name: string;
  openclawAgentId: string;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string | null;
  deletedAt: Date | string | null;
};

export type CAgent = Omit<IAgent, 'deletedAt'> | null;

export type AgentFilters = QueryFilters<'name' | 'createdAt' | 'updatedAt'>;

export type AgentRequestBody = {
  name?: string;
  openclawAgentId?: string;
};

export type List = RequestHandler<never, APIResponse<CAgent>, never, AgentFilters>;
export type Get = RequestHandler<RequestParams, CAgent, never, never>;
export type Create = RequestHandler<never, CAgent, AgentRequestBody, never>;
export type Update = RequestHandler<RequestParams, CAgent, AgentRequestBody, never>;
export type Destroy = RequestHandler<RequestParams, null, never, never>;
