import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams, Link } from 'react-router';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  CircularProgress,
  Collapse,
  Chip,
  useTheme,
  Select,
  MenuItem,
  type SelectChangeEvent,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Send, ExpandMore, AttachFile, Close, InsertDriveFileOutlined, ImageOutlined, DeleteOutline, Edit, Check, ContentCopy, Done, Settings, TuneOutlined } from '@mui/icons-material';
import { useGetMessagesQuery, useGetAgentQuery, useUpdateAgentMutation, useDeleteMessageMutation, useGetSessionSettingsQuery, usePatchSessionSettingsMutation } from '../../store';
import type { Message, MessageFile, MessagesResponse } from '../../store/api/messagesApi';
import { API_BASE_URL } from '../../store/api/baseApi';
import DeleteButton from '../../components/DeleteButton';
import MarkdownContent from '../../components/MarkdownContent';

const API_BASE = API_BASE_URL;

function ThinkingBlock({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  return (
    <Box sx={{ mb: 0.5 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'pointer',
          gap: 0.3,
          opacity: 0.6,
          '&:hover': { opacity: 0.9 },
        }}
      >
        <ExpandMore
          sx={{
            fontSize: 14,
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        />
        <Typography
          variant="caption"
          sx={{ fontStyle: 'italic', fontWeight: 500, fontSize: '0.7rem' }}
        >
          {isStreaming ? 'Thinking...' : 'Thought process'}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 0.5,
            pl: 1.5,
            borderLeft: '2px solid',
            borderColor: 'divider',
            fontStyle: 'italic',
            fontSize: '11px',
            color: 'text.secondary',
            '& *': { fontSize: 'inherit' },
          }}
        >
          <MarkdownContent isStreaming={isStreaming}>{text}</MarkdownContent>
        </Box>
      </Collapse>
    </Box>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileAttachments({ files, isUser }: { files: MessageFile[]; isUser: boolean }) {
  const theme = useTheme();
  const { userText } = theme.palette.chat;
  if (!files?.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 0.5 }}>
      {files.map((f) => {
        const isImage = f.mimetype.startsWith('image/');
        const fileUrl = f.url.startsWith('blob:') || f.url.startsWith('http')
          ? f.url
          : `${API_BASE.replace('/api', '')}${f.url}`;
        if (isImage) {
          return (
            <Box
              key={f.filename}
              component="a"
              href={fileUrl}
              target="_blank"
              rel="noopener"
              sx={{ display: 'block', maxWidth: 200, borderRadius: 1, overflow: 'hidden' }}
            >
              <Box
                component="img"
                src={fileUrl}
                alt={f.originalName}
                sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 160, objectFit: 'cover' }}
              />
            </Box>
          );
        }
        return (
          <Chip
            key={f.filename}
            component="a"
            href={fileUrl}
            target="_blank"
            rel="noopener"
            icon={<InsertDriveFileOutlined sx={{ fontSize: 14 }} />}
            label={`${f.originalName} (${formatFileSize(f.size)})`}
            size="small"
            clickable
            sx={{
              maxWidth: 220,
              bgcolor: isUser ? alpha(userText, 0.12) : 'background.paper',
              color: isUser ? userText : 'text.primary',
              fontSize: '0.72rem',
            }}
          />
        );
      })}
    </Box>
  );
}

type MessageLike = Message | { text: string; role: string; thinking?: string | null; files?: MessageFile[] };

const MessageBubble = memo(function MessageBubble({ message, isStreaming, thinkingText, messageId, onDelete }: {
  message: MessageLike;
  isStreaming?: boolean;
  thinkingText?: string;
  messageId?: string;
  onDelete?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const theme = useTheme();
  const isUser = message.role === 'user';
  const thinking = thinkingText || ('thinking' in message ? message.thinking : null);
  const files = ('files' in message ? message.files : undefined) ?? [];
  const hasTextContent = message.text && !message.text.startsWith('[Attached ');

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        mb: 1.5,
        width: '100%',
        minWidth: 0,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1,
          minWidth: 0,
          maxWidth: { xs: '90%', sm: '80%', md: 'min(70%, 100%)' },
          position: 'relative',
          bgcolor: isUser ? theme.palette.chat.userBubble : theme.palette.chat.assistantBubble,
          color: isUser ? theme.palette.chat.userText : 'text.primary',
          borderRadius: 3,
          borderTopRightRadius: isUser ? 4 : undefined,
          borderTopLeftRadius: isUser ? undefined : 4,
        }}
      >
        {hovered && (
          <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{ opacity: 0.5, '&:hover': { opacity: 1 }, p: 0.3 }}
            >
              {copied ? <Done sx={{ fontSize: 13, color: 'success.main' }} /> : <ContentCopy sx={{ fontSize: 13 }} />}
            </IconButton>
            {onDelete && messageId && (
              <DeleteButton
                onConfirm={() => onDelete(messageId)}
                message="Delete this message?"
                renderTrigger={(onClick) => (
                  <IconButton
                    size="small"
                    onClick={onClick}
                    sx={{ opacity: 0.5, '&:hover': { opacity: 1, color: 'error.main' }, p: 0.3 }}
                  >
                    <DeleteOutline sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              />
            )}
          </Box>
        )}
        {!isUser && thinking && (
          <ThinkingBlock
            text={thinking}
            isStreaming={isStreaming && !message.text}
          />
        )}
        {files.length > 0 && (
          <FileAttachments
            files={files}
            isUser={isUser}
          />
        )}
        {hasTextContent && (
          isUser ? (
            <MarkdownContent inheritColor>{message.text!}</MarkdownContent>
          ) : (
            <MarkdownContent isStreaming={isStreaming}>{message.text!}</MarkdownContent>
          )
        )}
        {isStreaming && !hasTextContent && (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 6,
              height: 16,
              bgcolor: 'text.secondary',
              animation: 'blink 1s step-end infinite',
              '@keyframes blink': { '50%': { opacity: 0 } },
            }}
          />
        )}
        {'createdAt' in message && (
          <Typography
            variant="caption"
            sx={{ opacity: 0.7 }}
          >
            {new Date(message.createdAt).toLocaleTimeString()}
          </Typography>
        )}
      </Paper>
    </Box>
  );
});

const THINKING_OPTIONS = ['inherit', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
const FAST_OPTIONS = [
  { value: 'inherit', label: 'inherit' },
  { value: 'true', label: 'on' },
  { value: 'false', label: 'off' },
] as const;
const VERBOSE_OPTIONS = [
  { value: 'inherit', label: 'inherit' },
  { value: 'off', label: 'off (explicit)' },
  { value: 'on', label: 'on' },
  { value: 'full', label: 'full' },
] as const;
const REASONING_OPTIONS = ['inherit', 'off', 'on', 'stream'] as const;

function SettingChip({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const isActive = value !== 'inherit';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : 'divider',
        bgcolor: (t) => isActive ? alpha(t.palette.primary.main, 0.06) : 'transparent',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: isActive ? 'primary.main' : 'text.disabled',
          pl: 1,
          pr: 0.3,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label}
      </Typography>
      <Select
        size="small"
        value={value}
        onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
        variant="standard"
        disableUnderline
        sx={{
          fontSize: '0.72rem',
          fontWeight: 500,
          color: isActive ? 'text.primary' : 'text.secondary',
          minWidth: 40,
          '& .MuiSelect-select': {
            py: '2px',
            pl: '2px',
            pr: '18px !important',
          },
          '& .MuiSvgIcon-root': { fontSize: 14, right: 2, color: 'text.disabled' },
        }}
      >
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <MenuItem
              key={val}
              value={val}
              sx={{ fontSize: '0.75rem', minHeight: 28 }}
            >
              {lbl}
            </MenuItem>
          );
        })}
      </Select>
    </Box>
  );
}

const SessionSettingsBar = memo(function SessionSettingsBar({ agentId, conversationId }: { agentId: string; conversationId: string }) {
  const { data } = useGetSessionSettingsQuery({ agentId, conversationId }, { skip: !agentId || !conversationId });
  const [patchSettings] = usePatchSessionSettingsMutation();
  const settings = data?.settings;

  const handleChange = useCallback((field: string, value: string) => {
    const body: Record<string, unknown> = {};
    if (field === 'fastMode') {
      body[field] = value === 'inherit' ? null : value === 'true';
    } else {
      body[field] = value;
    }
    patchSettings({ agentId, conversationId, settings: body });
  }, [agentId, conversationId, patchSettings]);

  const thinking = settings?.thinkingLevel || 'inherit';
  const fast = settings?.fastMode === true ? 'true' : settings?.fastMode === false ? 'false' : 'inherit';
  const verbose = settings?.verboseLevel || 'inherit';
  const reasoning = settings?.reasoningLevel || 'inherit';

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        flexWrap: 'wrap',
      }}
    >
      <SettingChip
        label="Thinking"
        value={thinking}
        options={THINKING_OPTIONS}
        onChange={(v) => handleChange('thinkingLevel', v)}
      />
      <SettingChip
        label="Fast"
        value={fast}
        options={FAST_OPTIONS}
        onChange={(v) => handleChange('fastMode', v)}
      />
      <SettingChip
        label="Verbose"
        value={verbose}
        options={VERBOSE_OPTIONS}
        onChange={(v) => handleChange('verboseLevel', v)}
      />
      <SettingChip
        label="Reasoning"
        value={reasoning}
        options={REASONING_OPTIONS}
        onChange={(v) => handleChange('reasoningLevel', v)}
      />
    </Box>
  );
});

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
  }, [text, pendingFiles, conversationId, isStreaming, refetch]);

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
