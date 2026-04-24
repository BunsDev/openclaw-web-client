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
} = agentsApi;
