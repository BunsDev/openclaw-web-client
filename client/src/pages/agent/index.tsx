import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Send, AttachFile, Close, InsertDriveFileOutlined, ImageOutlined, Edit, Check, Settings, TuneOutlined } from '@mui/icons-material';
import { useGetMessagesQuery, useGetAgentQuery, useUpdateAgentMutation, useDeleteMessageMutation } from '../../app/store';
import type { MessageFile, MessagesResponse } from '../../entities/message/api';
import { API_BASE_URL, baseApi } from '../../shared/api/baseApi';
import { useAppDispatch } from '../../app/store/hooks';
import MessageBubble from './MessageBubble';
import SessionSettingsBar from './SessionSettingsBar';

const API_BASE = API_BASE_URL;

export default function AgentChat() {
  const { agentId, conversationId } = useParams<{ agentId: string; conversationId: string }>();
  const [text, setText] = useState('');
  const [pendingUserText, setPendingUserText] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFilesPreviews, setPendingFilesPreviews] = useState<MessageFile[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadMoreCursor, setLoadMoreCursor] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLoadingMore = useRef(false);
  const prevScrollHeight = useRef(0);

  const { data: agent } = useGetAgentQuery(agentId!, { skip: !agentId });
  const { data, isLoading, isFetching, refetch } = useGetMessagesQuery(
    { conversationId: conversationId!, before: loadMoreCursor },
    { skip: !conversationId },
  );
  const [updateAgent] = useUpdateAgentMutation();
  const [deleteMessage] = useDeleteMessageMutation();
  const dispatch = useAppDispatch();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showSessionSettings, setShowSessionSettings] = useState(false);

  const messages = useMemo(() => data?.items ?? [], [data?.items]);
  const hasMore = (data as MessagesResponse | undefined)?.hasMore ?? false;
  const initialScrollDone = useRef(false);
  const lastConvId = useRef(conversationId);

  useEffect(() => {
    if (lastConvId.current !== conversationId) {
      lastConvId.current = conversationId;
      initialScrollDone.current = false;
    }

    if (isLoadingMore.current) {
      const container = scrollContainerRef.current;
      if (container) {
        const newHeight = container.scrollHeight;
        container.scrollTop = newHeight - prevScrollHeight.current;
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, conversationId, pendingUserText, pendingFilesPreviews]);

  const scrollTickRef = useRef(0);
  useEffect(() => {
    if (!streamingText && !streamingThinking) return;
    const now = Date.now();
    if (now - scrollTickRef.current < 200) return;
    scrollTickRef.current = now;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamingText, streamingThinking]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingMore.current || isFetching || !hasMore || isStreaming) return;
    if (container.scrollTop < 150 && messages.length > 0) {
      isLoadingMore.current = true;
      prevScrollHeight.current = container.scrollHeight;
      setLoadMoreCursor(messages[0].createdAt);
    }
  }, [isFetching, hasMore, isStreaming, messages]);

  useEffect(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
    setStreamingThinking('');
    setPendingUserText('');
    setPendingFiles([]);
    setPendingFilesPreviews([]);
    setText('');
    setLoadMoreCursor(undefined);
  }, [conversationId]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleAttach = () => fileInputRef.current?.click();
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value), []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    setPendingFiles((prev) => [...prev, ...Array.from(selected)].slice(0, 5));
    e.target.value = '';
    inputRef.current?.focus();
  };

  const removeFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && pendingFiles.length === 0) || !conversationId || isStreaming) return;

    const filesToSend = [...pendingFiles];
    const previews: MessageFile[] = filesToSend.map((f) => ({
      filename: f.name,
      originalName: f.name,
      mimetype: f.type,
      size: f.size,
      url: URL.createObjectURL(f),
    }));
    setText('');
    setPendingFiles([]);
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
      filesToSend.forEach((f) => form.append('files', f));

      const res = await fetch(`${API_BASE}/message/chat`, {
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
        } catch { /* skip */ }
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
      setPendingFilesPreviews((prev) => { prev.forEach((f) => URL.revokeObjectURL(f.url)); return []; });
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [text, pendingFiles, conversationId, isStreaming, refetch, dispatch, messages.length]);

  const handleDelete = useCallback((msgId: string) => {
    deleteMessage({ id: msgId, conversationId: conversationId! });
  }, [deleteMessage, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversationId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">Select a conversation to start chatting</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: { xs: '100vh', md: 'calc(100vh - 48px)' }, minWidth: 0, width: '100%', overflowX: 'hidden' }}>
      {agent && (
        <Box sx={{ px: { xs: 1.5, md: 2 }, py: 1.5, pl: { xs: 7, md: 2 }, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexShrink: 0 }}>
          {editingName ? (
            <>
              <TextField
                variant="standard"
                size="small"
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmed = nameValue.trim();
                    if (trimmed && trimmed !== agent.name) updateAgent({ id: agent._id, name: trimmed });
                    setEditingName(false);
                  }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                slotProps={{ input: { disableUnderline: false, sx: { fontSize: '1.15rem', fontWeight: 600 } } }}
                sx={{ flex: 1 }}
              />
              <IconButton
                size="small"
                onClick={() => {
                  const trimmed = nameValue.trim();
                  if (trimmed && trimmed !== agent.name) updateAgent({ id: agent._id, name: trimmed });
                  setEditingName(false);
                }}
                sx={{ color: 'success.main' }}
              >
                <Check sx={{ fontSize: 18 }} />
              </IconButton>
            </>
          ) : (
            <>
              <Typography
                variant="h6"
                fontWeight={600}
                sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {agent.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setShowSessionSettings((v) => !v)}
                aria-label="Session settings"
                sx={{ opacity: showSessionSettings ? 1 : 0.4, '&:hover': { opacity: 1 } }}
              >
                <TuneOutlined sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                component={Link}
                to={`/agent/${agent._id}/workspace?return=${conversationId}`}
                size="small"
                aria-label="Workspace files"
                sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
              >
                <Settings sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => { setNameValue(agent.name); setEditingName(true); }}
                sx={{ opacity: 0.4, '&:hover': { opacity: 1 } }}
              >
                <Edit sx={{ fontSize: 16 }} />
              </IconButton>
            </>
          )}
        </Box>
      )}

      {showSessionSettings && agentId && conversationId && (
        <SessionSettingsBar
          agentId={agentId}
          conversationId={conversationId}
        />
      )}

      <Box
        ref={scrollContainerRef}
        onScroll={handleScroll}
        sx={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', px: { xs: 2, sm: 2, md: 3 }, py: 2 }}
      >
        {isLoading && !loadMoreCursor ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : messages.length === 0 && !isStreaming ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography color="text.secondary">No messages yet. Send the first one!</Typography>
          </Box>
        ) : (
          <>
            {hasMore && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                {isFetching && loadMoreCursor ? (
                  <CircularProgress size={20} />
                ) : (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                    onClick={() => {
                      if (messages.length > 0) {
                        isLoadingMore.current = true;
                        prevScrollHeight.current = scrollContainerRef.current?.scrollHeight ?? 0;
                        setLoadMoreCursor(messages[0].createdAt);
                      }
                    }}
                  >
                    Load older messages
                  </Typography>
                )}
              </Box>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={msg._id}
                message={msg}
                messageId={msg._id}
                onDelete={handleDelete}
              />
            ))}
            {isStreaming && (pendingUserText || pendingFilesPreviews.length > 0) && (
              <MessageBubble message={{ text: pendingUserText, role: 'user', files: pendingFilesPreviews }} />
            )}
            {isStreaming && (streamingText || streamingThinking) && (
              <MessageBubble
                message={{ text: streamingText, role: 'assistant' }}
                isStreaming
                thinkingText={streamingThinking}
              />
            )}
            {isStreaming && !streamingText && !streamingThinking && (
              <Box sx={{ display: 'flex', gap: 0.8, py: 1.5, px: 1 }}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: 'text.secondary',
                      opacity: 0.4,
                      animation: 'dotPulse 1.4s ease-in-out infinite',
                      animationDelay: `${i * 0.2}s`,
                      '@keyframes dotPulse': {
                        '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: 0.4 },
                        '40%': { transform: 'scale(1)', opacity: 1 },
                      },
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2, md: 3 }, pb: { xs: 'max(12px, env(safe-area-inset-bottom))', md: 2 }, pt: 1, minWidth: 0, flexShrink: 0 }}>
        {pendingFiles.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {pendingFiles.map((f, i) => (
              <Chip
                key={`${f.name}-${i}`}
                icon={f.type.startsWith('image/')
                  ? <ImageOutlined sx={{ fontSize: 14 }} />
                  : <InsertDriveFileOutlined sx={{ fontSize: 14 }} />}
                label={f.name}
                size="small"
                onDelete={() => removeFile(i)}
                deleteIcon={<Close sx={{ fontSize: 14 }} />}
                sx={{ maxWidth: 200, fontSize: '0.72rem' }}
              />
            ))}
          </Box>
        )}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            px: 1.5,
            py: 0.5,
            bgcolor: 'background.paper',
            '&:focus-within': {
              borderColor: 'primary.main',
            },
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={handleFileChange}
          />
          <IconButton
            onClick={handleAttach}
            disabled={isStreaming || pendingFiles.length >= 5}
            size="small"
            sx={{ mr: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
          >
            <AttachFile sx={{ fontSize: 18 }} />
          </IconButton>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            minRows={1}
            maxRows={8}
            variant="standard"
            placeholder="Type a message..."
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            slotProps={{ input: { disableUnderline: true, sx: { py: 1, fontSize: '0.9rem' } } }}
            sx={{ minWidth: 0, flex: 1 }}
          />
          <IconButton
            onClick={handleSend}
            disabled={(!text.trim() && pendingFiles.length === 0) || isStreaming}
            size="small"
            sx={{
              ml: 1,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
              width: 32,
              height: 32,
            }}
          >
            <Send sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
