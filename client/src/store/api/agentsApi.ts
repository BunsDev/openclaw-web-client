import { baseApi } from './baseApi';

export interface Agent {
  _id: string;
  name: string;
  openclawAgentId: string;
  createdAt: string;
  updatedAt: string;
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
    createAgent: build.mutation<Agent, { name: string; openclawAgentId?: string }>({
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
      invalidatesTags: ['Agent', 'Conversation', 'Message'],
    }),
    getWorkspaceMeta: build.query<WorkspaceMetaResponse, string>({
      query: (agentId) => `/agent/${agentId}/workspace`,
      providesTags: (_res, _err, agentId) => [{ type: 'Workspace', id: agentId }],
    }),
    getWorkspaceFile: build.query<WorkspaceFileResponse, { agentId: string; filename: string }>({
      query: ({ agentId, filename }) =>
        `/agent/${agentId}/workspace/file/${encodeURIComponent(filename)}`,
      providesTags: (_res, _err, { agentId, filename }) =>
        [{ type: 'WorkspaceFile', id: `${agentId}:${filename}` }],
    }),
    saveWorkspaceFile: build.mutation<Record<string, unknown>, { agentId: string; filename: string; content: string }>({
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
} = agentsApi;
