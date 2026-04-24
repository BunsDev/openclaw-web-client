/* eslint-disable no-console */
import fs from 'fs';
import os from 'os';
import { AgentSkillSummary, AgentSkillsResponse, OpenclawConfig } from '../../@types/openclaw';
import { ocExec } from '../openclawGateway';
import { openclawConfigPath } from './paths';
import { execErrText } from '../../utils/errors';
import { listSkills } from './skills';

const CLI_OPTS = {
  cwd: os.homedir(),
  env: { ...process.env, NO_COLOR: '1' },
  timeout: 15000,
};

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

function summarizeSkills(): AgentSkillSummary[] {
  try {
    return listSkills().map((s) => ({
      name: s.name,
      description: s.description,
      emoji: s.emoji,
      eligible: s.eligible,
      blockedByAllowlist: s.blockedByAllowlist,
      source: s.source,
      bundled: s.bundled,
    }));
  } catch {
    return [];
  }
}

export function getAgentSkillsConfig(openclawAgentId: string): AgentSkillsResponse {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  const entry = agentIndex >= 0 ? config?.agents?.list?.[agentIndex] : undefined;

  const raw = entry?.skills;
  const override = Array.isArray(raw) ? raw.map(String) : null;

  return {
    agentId: openclawAgentId,
    known: agentIndex >= 0,
    override,
    available: summarizeSkills(),
  };
}

export interface SetAgentSkillsResult {
  ok: boolean;
  error?: string;
  config?: AgentSkillsResponse;
}

export function setAgentSkills(
  openclawAgentId: string,
  skills: string[] | null
): SetAgentSkillsResult {
  const config = readConfig();
  const agentIndex = findAgentIndex(config, openclawAgentId);
  if (agentIndex < 0) {
    return { ok: false, error: `Agent "${openclawAgentId}" not found in openclaw config.` };
  }

  const path = `agents.list[${agentIndex}].skills`;

  try {
    if (skills === null) {
      try {
        ocExec(['config', 'unset', path], CLI_OPTS);
      } catch (err) {
        const stderr = execErrText(err);
        if (!/not found|does not exist/i.test(stderr)) throw err;
      }
    } else {
      const normalized = Array.from(new Set(skills.map((s) => String(s).trim()).filter(Boolean)));
      ocExec(['config', 'set', path, JSON.stringify(normalized), '--strict-json'], CLI_OPTS);
    }
  } catch (err) {
    const stderr = execErrText(err);
    console.error(`[agent-skills] failed to set ${path}:`, stderr);
    return { ok: false, error: stderr || 'Failed to update agent skills.' };
  }

  return { ok: true, config: getAgentSkillsConfig(openclawAgentId) };
}
