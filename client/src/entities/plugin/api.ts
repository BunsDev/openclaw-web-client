import { baseApi } from '../../shared/api/baseApi';

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

export const pluginsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listPlugins: build.query<PluginInfo[], void>({
      query: () => '/plugin',
      providesTags: ['Plugin'],
      keepUnusedDataFor: 300,
    }),
    togglePlugin: build.mutation<{ ok: boolean }, { id: string; enable: boolean }>({
      query: ({ id, enable }) => ({
        url: `/plugin/${encodeURIComponent(id)}`,
        method: 'POST',
        body: { enable },
      }),
    }),
  }),
});

export const { useListPluginsQuery, useTogglePluginMutation } = pluginsApi;
