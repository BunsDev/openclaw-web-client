export interface SseEmitter {
  send: (type: string, delta: string) => void;
  done: () => void;
  error: (msg: string) => void;
}

export interface OpenClawMessage {
  externalId: string;
  role: string;
  text: string;
  thinking: string | null;
  timestamp: string | null;
}

export interface OpenClawSession {
  sessionKey: string;
  sessionId: string;
  updatedAt: number;
  label: string | null;
  firstMessage: string | null;
}

// ── Session file shapes ──

export interface SessionEntry {
  sessionId: string;
  sessionFile?: string;
  updatedAt: number;
  label?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
}

export type SessionsFile = Record<string, SessionEntry>;

// ── JSONL message file shapes ──

export interface JsonlTextPart {
  type: 'text';
  text: string;
}

export interface JsonlThinkingPart {
  type: 'thinking';
  thinking: string;
}

export interface JsonlOtherPart {
  type: string;
  [key: string]: unknown;
}

export type JsonlContentPart = JsonlTextPart | JsonlThinkingPart | JsonlOtherPart;

export interface JsonlMessageEntry {
  type: 'message';
  id: string;
  timestamp?: string | null;
  message: {
    role: 'user' | 'assistant' | string;
    content: JsonlContentPart[] | string;
  };
}

export interface JsonlEntry {
  type: string;
  id?: string;
  timestamp?: string | null;
  message?: {
    role: 'user' | 'assistant' | string;
    content: JsonlContentPart[] | string;
  };
  [key: string]: unknown;
}

// ── Session settings ──

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high' | 'inherit';
export type VerboseLevel = 'low' | 'medium' | 'high' | 'inherit';
export type ReasoningLevel = 'minimal' | 'low' | 'medium' | 'high' | 'inherit';

export interface SessionSettings {
  thinkingLevel: string;
  fastMode: boolean | null;
  verboseLevel: string;
  reasoningLevel: string;
}

export interface SessionSettingsPatchBody {
  thinkingLevel?: string;
  fastMode?: boolean | null;
  verboseLevel?: string;
  reasoningLevel?: string;
  label?: string | null;
}

// ── OpenClaw config (openclaw.json) ──

export interface OpenclawContextLimits {
  memoryGetMaxChars?: number;
  memoryGetDefaultLines?: number;
  toolResultMaxChars?: number;
  postCompactionMaxChars?: number;
}

export interface OpenclawSkillsLimits {
  maxSkillsPromptChars?: number;
}

export interface OpenclawSubagentsSection {
  allowAgents?: string[];
  thinking?: string;
  requireAgentId?: boolean;
}

export interface OpenclawAgentEntry {
  id?: string;
  name?: string;
  model?: string | { primary?: string } | null;
  contextLimits?: OpenclawContextLimits;
  skillsLimits?: OpenclawSkillsLimits;
  skills?: string[];
  subagents?: OpenclawSubagentsSection;
  [key: string]: unknown;
}

export interface OpenclawModelEntry {
  alias?: string;
  [key: string]: unknown;
}

export interface OpenclawAgentsSection {
  list?: OpenclawAgentEntry[];
  defaults?: {
    model?: { primary?: string } | null;
    models?: Record<string, OpenclawModelEntry>;
    contextLimits?: OpenclawContextLimits;
    skillsLimits?: OpenclawSkillsLimits;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── Agent budgets (context/skills limits) ──

export type AgentBudgetKey =
  | 'memoryGetMaxChars'
  | 'memoryGetDefaultLines'
  | 'toolResultMaxChars'
  | 'postCompactionMaxChars'
  | 'maxSkillsPromptChars';

export interface AgentBudgetField {
  key: AgentBudgetKey;
  label: string;
  description: string;
  min: number;
  max: number;
  override: number | null;
  default: number | null;
  effective: number | null;
}

export interface AgentBudgetResponse {
  agentId: string;
  known: boolean;
  fields: AgentBudgetField[];
}

export type AgentBudgetPatch = Partial<Record<AgentBudgetKey, number | null>>;

export interface AgentProviderModel {
  key: string;
  name: string;
  contextWindow: number | null;
  local: boolean;
  available: boolean;
  missing: boolean;
  tags: string[];
}

export interface AgentProviderModelsResponse {
  agentId: string;
  known: boolean;
  currentModel: string | null;
  provider: string | null;
  models: AgentProviderModel[];
}

// ── Agent skills (per-agent allowlist) ──

export interface AgentSkillSummary {
  name: string;
  description: string;
  emoji: string;
  eligible: boolean;
  blockedByAllowlist: boolean;
  source: string;
  bundled: boolean;
}

export interface AgentSkillsResponse {
  agentId: string;
  known: boolean;
  override: string[] | null;
  available: AgentSkillSummary[];
}

export interface AgentSkillsPatch {
  skills: string[] | null;
}

// ── Agent subagents ──

export type AgentSubagentsThinking = 'minimal' | 'low' | 'medium' | 'high' | 'inherit' | string;

export interface AgentSubagentsConfig {
  allowAgents: string[] | null;
  thinking: string | null;
  requireAgentId: boolean | null;
}

export interface AgentSubagentsResponse {
  agentId: string;
  known: boolean;
  config: AgentSubagentsConfig;
  availableAgents: { id: string; name: string | null }[];
}

export interface AgentSubagentsPatch {
  allowAgents?: string[] | null;
  thinking?: string | null;
  requireAgentId?: boolean | null;
}

export interface OpenclawConfig {
  agents?: OpenclawAgentsSection;
  gateway?: { port?: number };
  [key: string]: unknown;
}

// ── Chat runner ──

export interface ChatRunHandle {
  kill: () => void;
}
