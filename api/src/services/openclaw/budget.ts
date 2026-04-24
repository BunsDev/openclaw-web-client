/* eslint-disable no-console */
import fs from 'fs';
import os from 'os';
import {
  AgentBudgetField,
  AgentBudgetKey,
  AgentBudgetPatch,
  AgentBudgetResponse,
  OpenclawConfig,
} from '../../@types/openclaw';
import { ocExec } from '../openclawGateway';
import { openclawConfigPath } from './paths';
import { execErrText } from '../../utils/errors';

const CLI_OPTS = {
  cwd: os.homedir(),
  env: { ...process.env, NO_COLOR: '1' },
  timeout: 15000,
};

type Bucket = 'contextLimits' | 'skillsLimits';

interface BudgetFieldSpec {
  key: AgentBudgetKey;
  bucket: Bucket;
  label: string;
  description: string;
  min: number;
  max: number;
}

export const BUDGET_FIELDS: BudgetFieldSpec[] = [
  {
    key: 'memoryGetMaxChars',
    bucket: 'contextLimits',
    label: 'memory_get — max characters',
    description:
      'Max characters returned by memory_get before truncation. Larger values give richer excerpts at higher token cost.',
    min: 1,
    max: 250000,
  },
  {
    key: 'memoryGetDefaultLines',
    bucket: 'contextLimits',
    label: 'memory_get — default line window',
    description:
      'Default number of source lines selected when memory_get omits the lines parameter (capped by max chars).',
    min: 1,
    max: 5000,
  },
  {
    key: 'toolResultMaxChars',
    bucket: 'contextLimits',
    label: 'Tool result — max characters',
    description:
      'Per-tool-call result budget. Longer outputs are truncated before being persisted or injected back into the prompt.',
    min: 1,
    max: 250000,
  },
  {
    key: 'postCompactionMaxChars',
    bucket: 'contextLimits',
    label: 'Post-compaction context — max characters',
    description:
      'Budget for AGENTS.md re-injection after compaction. Lower values make recovery cheaper; higher values preserve more startup guidance.',
    min: 1,
    max: 50000,
  },
  {
    key: 'maxSkillsPromptChars',
    bucket: 'skillsLimits',
    label: 'Skills prompt — max characters',
    description:
      'Cap on the combined skills section injected into the agent prompt. Higher values let more skills surface at greater token cost.',
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  },
];

function readConfig(): OpenclawConfig | null {
  try {
    return JSON.parse(fs.readFileSync(openclawConfigPath(), 'utf-8')) as OpenclawConfig;
  } catch {
    return null;
  }
}

function findAgentIndex(config: OpenclawConfig | null, openclawAgentId: string): number {
  const list = config?.agents?.list ?? [];
  return list.findIndex((a) => a?.id === openclawAgentId);
}

function valueFromConfig(
  config: OpenclawConfig | null,
  agentIndex: number,
  spec: BudgetFieldSpec
): { override: number | null; defaultValue: number | null } {
  const list = config?.agents?.list ?? [];
  const defaults = config?.agents?.defaults as
    | { contextLimits?: Record<string, number>; skillsLimits?: Record<string, number> }
    | undefined;
  const entry = agentIndex >= 0 ? list[agentIndex] : undefined;
  const entryBucket = entry?.[spec.bucket] as Record<string, number> | undefined;
  const defaultBucket = defaults?.[spec.bucket];

  const override =
    entryBucket && typeof entryBucket[spec.key] === 'number' ? entryBucket[spec.key] : null;
  const defaultValue =
    defaultBucket && typeof defaultBucket[spec.key] === 'number'
      ? (defaultBucket[spec.key] as number)
      : null;

  return { override, defaultValue };
}

export function getAgentBudget(openclawAgentId: string): AgentBudgetResponse {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);

  const fields: AgentBudgetField[] = BUDGET_FIELDS.map((spec) => {
    const { override, defaultValue } = valueFromConfig(config, agentIndex, spec);
    return {
      key: spec.key,
      label: spec.label,
      description: spec.description,
      min: spec.min,
      max: spec.max,
      override,
      default: defaultValue,
      effective: override ?? defaultValue,
    };
  });

  return { agentId: openclawAgentId, known: agentIndex >= 0, fields };
}

export interface SetAgentBudgetResult {
  ok: boolean;
  error?: string;
  budget?: AgentBudgetResponse;
}

export function setAgentBudget(
  openclawAgentId: string,
  patch: AgentBudgetPatch
): SetAgentBudgetResult {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  if (agentIndex < 0) {
    return { ok: false, error: `Agent "${openclawAgentId}" not found in openclaw config.` };
  }

  const specByKey = new Map(BUDGET_FIELDS.map((s) => [s.key, s]));
  const entries = (Object.entries(patch) as [AgentBudgetKey, number | null | undefined][]).filter(
    ([key]) => specByKey.has(key)
  );

  const failure = entries.reduce<{ ok: false; error: string } | null>((acc, [key, rawValue]) => {
    if (acc) return acc;
    const spec = specByKey.get(key)!;
    const path = `agents.list[${agentIndex}].${spec.bucket}.${spec.key}`;

    try {
      if (rawValue === null || rawValue === undefined) {
        try {
          ocExec(['config', 'unset', path], CLI_OPTS);
        } catch (err) {
          const stderr = execErrText(err);
          if (!/not found|does not exist/i.test(stderr)) throw err;
        }
      } else {
        if (!Number.isFinite(rawValue) || !Number.isInteger(rawValue)) {
          return { ok: false, error: `"${key}" must be an integer.` };
        }
        if (rawValue < spec.min || rawValue > spec.max) {
          return {
            ok: false,
            error: `"${key}" must be between ${spec.min} and ${spec.max}.`,
          };
        }
        ocExec(['config', 'set', path, String(rawValue), '--strict-json'], CLI_OPTS);
      }
    } catch (err) {
      const stderr = execErrText(err);
      console.error(`[budget] failed to set ${path}:`, stderr);
      return { ok: false, error: stderr || `Failed to update ${key}.` };
    }
    return null;
  }, null);

  if (failure) return failure;

  return { ok: true, budget: getAgentBudget(openclawAgentId) };
}
