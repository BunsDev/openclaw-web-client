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

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  input: string;
  context: number;
  local: boolean;
  available: boolean;
  tags: string[];
}

export interface ModelsResponse {
  ok: boolean;
  models: ModelInfo[];
}

export interface AgentModelResponse {
  ok: boolean;
  model: string | null;
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
    createAgent: build.mutation<Agent, { name: string; openclawAgentId?: string; interactive?: boolean }>({
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
    listModels: build.query<ModelsResponse, void>({
      query: () => '/agent/models',
    }),
    getAgentModel: build.query<AgentModelResponse, string>({
      query: (agentId) => `/agent/${agentId}/model`,
      providesTags: (_res, _err, agentId) => [{ type: 'AgentModel', id: agentId }],
    }),
    setAgentModel: build.mutation<{ ok: boolean; model: string }, { agentId: string; model: string }>({
      query: ({ agentId, model }) => ({
        url: `/agent/${agentId}/model`,
        method: 'PATCH',
        body: { model },
      }),
      invalidatesTags: (_res, _err, { agentId }) => [{ type: 'AgentModel', id: agentId }, 'Agent'],
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
  useListModelsQuery,
  useGetAgentModelQuery,
  useSetAgentModelMutation,
} = agentsApi;
