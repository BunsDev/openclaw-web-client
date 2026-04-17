import { RequestHandler } from 'express';

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  version: string;
  status: string;
  origin: string;
  enabled: boolean;
  toolNames: string[];
  hookNames: string[];
}

export type TogglePluginBody = { enable: boolean };

export type ToggleResult = { ok: boolean; error?: string };

export type List = RequestHandler<never, PluginInfo[], never, never>;
export type Toggle = RequestHandler<{ id: string }, ToggleResult, TogglePluginBody, never>;
