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
  }),
});

export const {
  useGetAgentsQuery,
  useGetAgentQuery,
  useCreateAgentMutation,
  useUpdateAgentMutation,
  useDeleteAgentMutation,
} = agentsApi;
