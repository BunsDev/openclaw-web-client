import { RequestHandler } from 'express';
import { QueryFilters, RequestParams, APIResponse } from './shared';

export type AgentResponse = {
  _id: number;
  name: string;
  openclawAgentId: string;
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string | null;
  /** Present on API list/get responses; not a DB column */
  model?: string | null;
} | null;

/** Single-agent JSON body (GET/PATCH responses) */
export type AgentJson = NonNullable<AgentResponse>;

export type AgentFilters = QueryFilters<'name' | 'createdAt' | 'updatedAt'>;

export type AgentRequestBody = {
  name?: string;
  openclawAgentId?: string;
  interactive?: boolean;
};

export type List = RequestHandler<never, APIResponse<AgentResponse>, never, AgentFilters>;
export type Get = RequestHandler<RequestParams, AgentResponse, never, never>;
export type Create = RequestHandler<never, AgentResponse, AgentRequestBody, never>;
export type Update = RequestHandler<RequestParams, AgentResponse, AgentRequestBody, never>;
export type Destroy = RequestHandler<RequestParams, null, never, never>;
