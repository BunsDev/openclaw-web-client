/* eslint-disable no-console */
import { SkillInfo } from '../../@types/skill';
import { ocExec } from '../openclawGateway';
import { withCache } from '../../utils/cache';
import { errMsg } from '../../utils/errors';

const SKILLS_CACHE_TTL = 5 * 60 * 1000;

interface RawSkill {
  name?: string;
  description?: string;
  emoji?: string;
  eligible?: boolean;
  disabled?: boolean;
  blockedByAllowlist?: boolean;
  source?: string;
  bundled?: boolean;
  homepage?: string;
  missing?: {
    bins?: unknown;
    anyBins?: unknown;
    env?: unknown;
    config?: unknown;
    os?: unknown;
  };
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function parseSkillList(raw: string): SkillInfo[] {
  const parsed = JSON.parse(raw) as { skills?: RawSkill[] };
  return (parsed.skills || []).map((s) => ({
    name: String(s.name || ''),
    description: String(s.description || ''),
    emoji: String(s.emoji || ''),
    eligible: Boolean(s.eligible),
    disabled: Boolean(s.disabled),
    blockedByAllowlist: Boolean(s.blockedByAllowlist),
    source: String(s.source || 'unknown'),
    bundled: Boolean(s.bundled),
    homepage: s.homepage ? String(s.homepage) : undefined,
    missing: {
      bins: toStringArray(s.missing?.bins),
      anyBins: toStringArray(s.missing?.anyBins),
      env: toStringArray(s.missing?.env),
      config: toStringArray(s.missing?.config),
      os: toStringArray(s.missing?.os),
    },
  }));
}

const skillsCache = withCache<SkillInfo[]>(SKILLS_CACHE_TTL, () => {
  const raw = ocExec(['skills', 'list', '--json', '--verbose'], {
    encoding: 'utf-8',
    timeout: 30000,
  });
  return parseSkillList(raw);
});

// eslint-disable-next-line import/prefer-default-export
export function listSkills(): SkillInfo[] {
  try {
    return skillsCache.get();
  } catch (err) {
    console.error('[skills] failed to list skills:', errMsg(err));
    return skillsCache.peek() ?? [];
  }
}
