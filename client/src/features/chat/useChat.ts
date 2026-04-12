import { useState, useRef, useEffect, useCallback } from 'react';
import type { MessageFile } from '../../entities/message/api';
import { API_BASE_URL, baseApi } from '../../shared/api/baseApi';
import { useAppDispatch } from '../../app/store/hooks';
import { useGetMessagesQuery } from '../../entities/message/api';
import type { MessagesResponse } from '../../entities/message/api';

export interface ChatState {
  messages: ReturnType<typeof useGetMessagesQuery>['data'] extends infer D
    ? D extends { items: infer I }
      ? I extends (infer M)[]
        ? M[]
        : never
      : never
    : never;
  isLoading: boolean;
  isFetching: boolean;
  hasMore: boolean;
  isStreaming: boolean;
  streamingText: string;
  streamingThinking: string;
  pendingUserText: string;
  pendingFilesPreviews: MessageFile[];
  send: (text: string, files: File[]) => Promise<void>;
  loadMore: () => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
}

export default function useChat(conversationId: string | undefined) {
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingUserText, setPendingUserText] = useState('');
  const [pendingFilesPreviews, setPendingFilesPreviews] = useState<MessageFile[]>([]);
  const [loadMoreCursor, setLoadMoreCursor] = useState<string | undefined>();

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingMore = useRef(false);
  const prevScrollHeight = useRef(0);
  const initialScrollDone = useRef(false);
  const lastConvId = useRef(conversationId);
  const scrollTickRef = useRef(0);

  const dispatch = useAppDispatch();

  const { data, isLoading, isFetching, refetch } = useGetMessagesQuery(
    { conversationId: conversationId!, before: loadMoreCursor },
    { skip: !conversationId }
  );

  const messages = data?.items ?? [];
  const hasMore = (data as MessagesResponse | undefined)?.hasMore ?? false;

  useEffect(() => {
    if (lastConvId.current !== conversationId) {
      lastConvId.current = conversationId;
      initialScrollDone.current = false;
    }
    if (isLoadingMore.current) {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeight.current;
        prevScrollHeight.current = 0;
      }
      isLoadingMore.current = false;
      return;
    }
    if (!initialScrollDone.current && messages.length > 0) {
      initialScrollDone.current = true;
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 80);
      return;
    }
    if (pendingUserText || pendingFilesPreviews.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    }
  }, [messages, conversationId, pendingUserText, pendingFilesPreviews]);

  useEffect(() => {
    if (!streamingText && !streamingThinking) return;
    const now = Date.now();
    if (now - scrollTickRef.current < 200) return;
    scrollTickRef.current = now;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, streamingThinking]);

  useEffect(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
    setStreamingThinking('');
    setPendingUserText('');
    setPendingFilesPreviews([]);
    setLoadMoreCursor(undefined);
  }, [conversationId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingMore.current || isFetching || !hasMore || isStreaming) return;
    if (container.scrollTop < 150 && messages.length > 0) {
      isLoadingMore.current = true;
      prevScrollHeight.current = container.scrollHeight;
      setLoadMoreCursor(messages[0].createdAt);
    }
  }, [isFetching, hasMore, isStreaming, messages]);

  const send = useCallback(
    async (text: string, files: File[]) => {
      const trimmed = text.trim();
      if ((!trimmed && files.length === 0) || !conversationId || isStreaming) return;

      const previews: MessageFile[] = files.map((f) => ({
        filename: f.name,
        originalName: f.name,
        mimetype: f.type,
        size: f.size,
        url: URL.createObjectURL(f),
      }));

      setPendingUserText(trimmed);
      setPendingFilesPreviews(previews);
      setStreamingText('');
      setStreamingThinking('');
      setIsStreaming(true);

      const token = localStorage.getItem('token');
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const form = new FormData();
        form.append('conversationId', conversationId);
        if (trimmed) form.append('text', trimmed);
        files.forEach((f) => form.append('files', f));

        const res = await fetch(`${API_BASE_URL}/message/chat`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: form,
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          console.error('Chat request failed:', res.status);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let lineBuf = '';
        let accText = '';
        let accThinking = '';

        const processLine = (line: string) => {
          if (!line.startsWith('data: ')) return;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') return;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'response.output_text.delta' && event.delta) {
              accText += event.delta;
              setStreamingText(accText);
            } else if (event.type === 'response.thinking.delta' && event.delta) {
              accThinking += event.delta;
              setStreamingThinking(accThinking);
            }
          } catch {
            /* skip */
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            if (lineBuf.trim()) processLine(lineBuf);
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          lineBuf += chunk;
          const parts = lineBuf.split('\n');
          lineBuf = parts.pop()!;
          parts.forEach(processLine);
        }

        await refetch();
        if (messages.length === 0) {
          dispatch(baseApi.util.invalidateTags(['Conversation']));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Stream error:', err);
      } finally {
        setIsStreaming(false);
        setStreamingText('');
        setStreamingThinking('');
        setPendingUserText('');
        setPendingFilesPreviews((prev) => {
          prev.forEach((f) => URL.revokeObjectURL(f.url));
          return [];
        });
        abortRef.current = null;
      }
    },
    [conversationId, isStreaming, refetch, dispatch, messages.length]
  );

  const loadMore = useCallback(() => {
    if (messages.length > 0) {
      isLoadingMore.current = true;
      prevScrollHeight.current = scrollContainerRef.current?.scrollHeight ?? 0;
      setLoadMoreCursor(messages[0].createdAt);
    }
  }, [messages]);

  return {
    messages,
    isLoading,
    isFetching,
    hasMore,
    isStreaming,
    streamingText,
    streamingThinking,
    pendingUserText,
    pendingFilesPreviews,
    send,
    loadMore,
    scrollContainerRef,
    messagesEndRef,
    handleScroll,
    loadMoreCursor,
  };
}
