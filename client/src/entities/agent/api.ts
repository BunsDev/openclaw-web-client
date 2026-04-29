import { baseApi } from '../../shared/api/baseApi';

export interface Agent {
  _id: string;
  name: string;
  openclawAgentId: string;
  createdAt: string;
  updatedAt: string;
  /** OpenClaw model id from config; included on GET /agent list and GET /agent/:id */
  model?: string | null;
}

export interface AgentsResponse {
  total: number;
  items: Agent[];
}

export interface SyncAgentsResponse {
  syncedAgents: number;
  syncedConversations: number;
  syncedMessages: number;
}

export interface WorkspaceMetaResponse {
  ok: boolean;
  workspacePath: string;
  files: { name: string; exists: boolean }[];
}

export interface WorkspaceFileResponse {
  ok: boolean;
  path: string;
  exists: boolean;
  content: string;
}

export interface SessionSettings {
  thinkingLevel: string;
  fastMode: boolean | null;
  verboseLevel: string;
  reasoningLevel: string;
}

export interface SessionSettingsResponse {
  ok: boolean;
  settings: Partial<SessionSettings>;
}

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

export interface AgentBudgetMutationResponse {
  ok: boolean;
  error?: string;
  budget?: AgentBudgetResponse;
}

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

export interface AgentSkillsMutationResponse {
  ok: boolean;
  error?: string;
  config?: AgentSkillsResponse;
}

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

export interface AgentSubagentsMutationResponse {
  ok: boolean;
  error?: string;
  config?: AgentSubagentsResponse;
}

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

export interface AgentProviderModelMutationResponse {
  ok: boolean;
  error?: string;
  restartHint?: string | null;
  config?: AgentProviderModelsResponse;
}

export interface AgentUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
}

export interface AgentUsageMessageCounts {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  errors: number;
}

export interface AgentUsageLatency {
  count: number;
  avgMs: number;
  p95Ms: number;
}

export interface AgentUsageDailyPoint {
  date: string;
  tokens: number;
  cost: number;
}

export interface AgentUsageModelRow {
  provider: string;
  model: string;
  count: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
}

export interface AgentUsageToolRow {
  name: string;
  count: number;
}

export interface AgentUsageSessionRow {
  key: string;
  label: string | null;
  channel: string | null;
  updatedAt: number | null;
  totalTokens: number;
  totalCost: number;
  modelProvider: string | null;
  model: string | null;
}

export interface AgentUsageResponse {
  agentId: string;
  known: boolean;
  range: { startDate: string | null; endDate: string | null };
  sessionCount: number;
  firstActivity: number | null;
  lastActivity: number | null;
  totals: AgentUsageTotals;
  messageCounts: AgentUsageMessageCounts;
  latency: AgentUsageLatency;
  daily: AgentUsageDailyPoint[];
  models: AgentUsageModelRow[];
  tools: AgentUsageToolRow[];
  sessions: AgentUsageSessionRow[];
}

export type AgentLimitWindow = 'daily' | 'monthly' | 'total';

export interface AgentLimitWindowState {
  limit: number | null;
  spent: number;
  ratio: number | null;
  exceeded: boolean;
  nearLimit: boolean;
}

export interface AgentLimitsResponse {
  agentId: string;
  today: string;
  thisMonth: string;
  windows: Record<AgentLimitWindow, AgentLimitWindowState>;
  stored: {
    costLimitDaily: number | null;
    costLimitMonthly: number | null;
    costLimitTotal: number | null;
  };
}

export interface AgentLimitsPatch {
  costLimitDaily?: number | null;
  costLimitMonthly?: number | null;
  costLimitTotal?: number | null;
}

export const WORKSPACE_TAB_FILES = [
  { label: 'AGENTS', file: 'AGENTS.md' },
  { label: 'SOUL', file: 'SOUL.md' },
  { label: 'TOOLS', file: 'TOOLS.md' },
  { label: 'IDENTITY', file: 'IDENTITY.md' },
  { label: 'USER', file: 'USER.md' },
  { label: 'HEARTBEAT', file: 'HEARTBEAT.md' },
  { label: 'BOOTSTRAP', file: 'BOOTSTRAP.md' },
  { label: 'MEMORY', file: 'MEMORY.md' },
] as const;

export const agentsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAgents: build.query<AgentsResponse, void>({
      query: () => '/agent',
      providesTags: ['Agent'],
    }),
    getAgent: build.query<Agent, string>({
      query: (id) => `/agent/${id}`,
      providesTags: ['Agent'],
    }),
    createAgent: build.mutation<
      Agent,
      { name: string; openclawAgentId?: string; interactive?: boolean }
    >({
      query: (body) => ({
        url: '/agent',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Agent'],
    }),
    updateAgent: build.mutation<Agent, { id: string; name: string }>({
      query: ({ id, ...body }) => ({
        url: `/agent/${id}`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Agent'],
    }),
    deleteAgent: build.mutation<void, string>({
      query: (id) => ({
        url: `/agent/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Agent'],
    }),
    syncAgents: build.mutation<SyncAgentsResponse, void>({
      query: () => ({
        url: '/agent/sync',
        method: 'POST',
      }),
      invalidatesTags: ['Agent'],
    }),
    getWorkspaceMeta: build.query<WorkspaceMetaResponse, string>({
      query: (agentId) => `/agent/${agentId}/workspace`,
      providesTags: (_res, _err, agentId) => [{ type: 'Workspace', id: agentId }],
    }),
    getWorkspaceFile: build.query<WorkspaceFileResponse, { agentId: string; filename: string }>({
      query: ({ agentId, filename }) =>
        `/agent/${agentId}/workspace/file/${encodeURIComponent(filename)}`,
      providesTags: (_res, _err, { agentId, filename }) => [
        { type: 'WorkspaceFile', id: `${agentId}:${filename}` },
      ],
    }),
    saveWorkspaceFile: build.mutation<
      Record<string, unknown>,
      { agentId: string; filename: string; content: string }
    >({
      query: ({ agentId, filename, content }) => ({
        url: `/agent/${agentId}/workspace/file/${encodeURIComponent(filename)}`,
        method: 'PUT',
        body: { content },
      }),
      invalidatesTags: (_res, _err, { agentId, filename }) => [
        { type: 'WorkspaceFile', id: `${agentId}:${filename}` },
        { type: 'Workspace', id: agentId },
      ],
    }),
    getSessionSettings: build.query<
      SessionSettingsResponse,
      { agentId: string; conversationId: string }
    >({
      query: ({ agentId, conversationId }) =>
        `/agent/${agentId}/conversation/${conversationId}/session-settings`,
      providesTags: (_res, _err, { conversationId }) => [
        { type: 'SessionSettings', id: conversationId },
      ],
    }),
    patchSessionSettings: build.mutation<
      { ok: boolean },
      { agentId: string; conversationId: string; settings: Partial<SessionSettings> }
    >({
      query: ({ agentId, conversationId, settings }) => ({
        url: `/agent/${agentId}/conversation/${conversationId}/session-settings`,
        method: 'PATCH',
        body: settings,
      }),
      invalidatesTags: (_res, _err, { conversationId }) => [
        { type: 'SessionSettings', id: conversationId },
      ],
    }),
    getAgentBudget: build.query<AgentBudgetResponse, string>({
      query: (agentId) => `/agent/${agentId}/budget`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentBudget', id: agentId }],
    }),
    updateAgentBudget: build.mutation<
      AgentBudgetMutationResponse,
      { agentId: string; patch: AgentBudgetPatch }
    >({
      query: ({ agentId, patch }) => ({
        url: `/agent/${agentId}/budget`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_res, _err, { agentId }) => [{ type: 'AgentBudget', id: agentId }],
    }),
    getAgentSkills: build.query<AgentSkillsResponse, string>({
      query: (agentId) => `/agent/${agentId}/skills`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentSkills', id: agentId }],
    }),
    updateAgentSkills: build.mutation<
      AgentSkillsMutationResponse,
      { agentId: string; skills: string[] | null }
    >({
      query: ({ agentId, skills }) => ({
        url: `/agent/${agentId}/skills`,
        method: 'PATCH',
        body: { skills },
      }),
      invalidatesTags: (_res, _err, { agentId }) => [{ type: 'AgentSkills', id: agentId }],
    }),
    getAgentSubagents: build.query<AgentSubagentsResponse, string>({
      query: (agentId) => `/agent/${agentId}/subagents`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentSubagents', id: agentId }],
    }),
    updateAgentSubagents: build.mutation<
      AgentSubagentsMutationResponse,
      { agentId: string; patch: AgentSubagentsPatch }
    >({
      query: ({ agentId, patch }) => ({
        url: `/agent/${agentId}/subagents`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_res, _err, { agentId }) => [{ type: 'AgentSubagents', id: agentId }],
    }),
    getAgentProviderModels: build.query<AgentProviderModelsResponse, string>({
      query: (agentId) => `/agent/${agentId}/provider-models`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentProviderModels', id: agentId }],
    }),
    getAgentUsage: build.query<AgentUsageResponse, string>({
      query: (agentId) => `/agent/${agentId}/usage`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentUsage', id: agentId }],
    }),
    getAgentLimits: build.query<AgentLimitsResponse, string>({
      query: (agentId) => `/agent/${agentId}/limits`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentLimits', id: agentId }],
      // The chat-header ring should reflect the agent's true spend on every
      // navigation — caching a stale value would make the indicator
      // misleading after a turn completes. Drop the cached payload as soon
      // as no component subscribes so the next mount always re-fetches.
      keepUnusedDataFor: 0,
    }),
    updateAgentLimits: build.mutation<
      AgentLimitsResponse,
      { agentId: string; patch: AgentLimitsPatch }
    >({
      query: ({ agentId, patch }) => ({
        url: `/agent/${agentId}/limits`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: (_res, _err, { agentId }) => [
        { type: 'AgentLimits', id: agentId },
        { type: 'AgentUsage', id: agentId },
      ],
    }),
    updateAgentProviderModel: build.mutation<
      AgentProviderModelMutationResponse,
      { agentId: string; model: string; conversationId?: number | string }
    >({
      query: ({ agentId, model, conversationId }) => ({
        url: `/agent/${agentId}/provider-models`,
        method: 'PATCH',
        body: { model, ...(conversationId !== undefined ? { conversationId } : {}) },
      }),
      invalidatesTags: (_res, _err, { agentId }) => [
        { type: 'AgentProviderModels', id: agentId },
        'Agent',
      ],
    }),
  }),
});

export const {
  useGetAgentsQuery,
  useGetAgentQuery,
  useCreateAgentMutation,
  useUpdateAgentMutation,
  useDeleteAgentMutation,
  useSyncAgentsMutation,
  useGetWorkspaceMetaQuery,
  useGetWorkspaceFileQuery,
  useSaveWorkspaceFileMutation,
  useGetSessionSettingsQuery,
  usePatchSessionSettingsMutation,
  useGetAgentBudgetQuery,
  useUpdateAgentBudgetMutation,
  useGetAgentSkillsQuery,
  useUpdateAgentSkillsMutation,
  useGetAgentSubagentsQuery,
  useUpdateAgentSubagentsMutation,
  useGetAgentProviderModelsQuery,
  useUpdateAgentProviderModelMutation,
  useGetAgentUsageQuery,
  useGetAgentLimitsQuery,
  useUpdateAgentLimitsMutation,
} = agentsApi;
