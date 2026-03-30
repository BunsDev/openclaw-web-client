import { baseApi } from './baseApi';

export interface MessageFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  text: string;
  thinking: string | null;
  files: MessageFile[];
  role: 'user' | 'assistant';
  createdAt: string;
}

export interface MessagesResponse {
  total: number;
  items: Message[];
}

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getMessages: build.query<MessagesResponse, string>({
      query: (conversationId) => `/message/conversation/${conversationId}`,
      providesTags: (_result, _error, conversationId) => [{ type: 'Message', id: conversationId }],
    }),
    createMessage: build.mutation<Message, { conversationId: string; text: string }>({
      query: (body) => ({
        url: '/message',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [{ type: 'Message', id: conversationId }],
    }),
    deleteMessage: build.mutation<void, { id: string; conversationId: string }>({
      query: ({ id }) => ({
        url: `/message/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [{ type: 'Message', id: conversationId }],
    }),
  }),
});

export const {
  useGetMessagesQuery,
  useCreateMessageMutation,
  useDeleteMessageMutation,
} = messagesApi;
