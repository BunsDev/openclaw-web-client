import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:18802/api';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

const baseQueryWithAuth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  // Extract token from response header
  const token = result.meta?.response?.headers.get('access-token');
  if (token) {
    const tokenValue = token.startsWith('Bearer ') ? token.slice(7) : token;
    localStorage.setItem('token', tokenValue);
  }

  // Handle 401 Unauthorized
  if (result.error?.status === 401) {
    localStorage.removeItem('token');
    api.dispatch({ type: 'auth/logout' });
    
    // Redirect to login page
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithAuth,
  tagTypes: ['User', 'Agent', 'Conversation', 'Message', 'Workspace', 'WorkspaceFile', 'SessionSettings'],
  endpoints: () => ({}),
});
