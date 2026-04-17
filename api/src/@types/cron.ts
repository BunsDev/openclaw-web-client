import { RequestHandler } from 'express';

export interface CronSchedule {
  kind: string;
  at?: string;
  cron?: string;
  every?: string;
}

export interface CronPayload {
  kind: string;
  message?: string;
  systemEvent?: string;
}

export interface CronState {
  lastRunAtMs?: number;
  lastRunStatus?: string;
  lastStatus?: string;
  lastDurationMs?: number;
  lastError?: string;
  consecutiveErrors?: number;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  deleteAfterRun: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: string;
  wakeMode: string;
  payload: CronPayload;
  delivery: Record<string, unknown>;
  state: CronState;
}

export interface CronListResponse {
  jobs: CronJob[];
  total: number;
}

export type AddCronBody = Record<string, string>;
export type ToggleCronBody = { enable: boolean };

export type CronOpResult = { ok: boolean; error?: string };

export type List = RequestHandler<never, CronListResponse, never, never>;
export type Add = RequestHandler<never, CronOpResult, AddCronBody, never>;
export type Remove = RequestHandler<{ id: string }, CronOpResult, never, never>;
export type Toggle = RequestHandler<{ id: string }, CronOpResult, ToggleCronBody, never>;
