import { useState, useEffect, useRef } from "react";
import {
  Box,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  TextField,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { People, ChatBubbleOutline, Add, ExpandMore, ExpandLess, SmartToy, DeleteOutline, Search, Edit, Check, KeyboardDoubleArrowUp, SwapVert } from "@mui/icons-material";
import { Link, useLocation, useNavigate } from "react-router";
import {
  useGetAgentsQuery,
  useCreateAgentMutation,
  useDeleteAgentMutation,
  useGetConversationsQuery,
  useCreateConversationMutation,
  useUpdateConversationMutation,
  useDeleteConversationMutation,
  useGetMessagesQuery,
  useSyncAgentsMutation,
} from "../store";
import DeleteButton from "./DeleteButton";
import ThemePicker from "./ThemePicker";

export const SIDEBAR_WIDTH = 240;

const menuItems = [
  { text: "USERS", icon: <People />, path: "/users" },
];

function useFirstMessage(conversationId: string) {
  const { data } = useGetMessagesQuery(conversationId);
  const messages = data?.items ?? [];
  const firstUserMsg = messages.find((m) => m.role === 'user');
  return firstUserMsg?.text ?? null;
}

function ConversationItem({ agentId, conversation, onNavigate }: { agentId: string; conversation: { _id: string; title: string | null; createdAt: string }; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { sidebar } = theme.palette;
  const firstMessage = useFirstMessage(conversation._id);
  const isActive = location.pathname === `/agent/${agentId}/chat/${conversation._id}`;
  const title = conversation.title || firstMessage || 'New chat';
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [updateConversation] = useUpdateConversationMutation();
  const [deleteConversation] = useDeleteConversationMutation();

  const handleDelete = async () => {
    await deleteConversation({ id: conversation._id, agentId });
    if (isActive) navigate('/');
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditValue(title);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      updateConversation({ id: conversation._id, agentId, title: trimmed });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <ListItem
        disablePadding
        sx={{ mb: 0.2, px: 1.5, pl: 4 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0.3 }}>
          <TextField
            variant="standard"
            size="small"
            autoFocus
            fullWidth
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={handleSaveEdit}
            slotProps={{ input: { disableUnderline: false, sx: { fontSize: '0.75rem', color: sidebar.selectedText, py: 0.3 } } }}
            sx={{ '& .MuiInput-underline:after': { borderColor: sidebar.selectedBorder } }}
          />
          <IconButton 
            size="small"
            onClick={handleSaveEdit}
            sx={{ p: 0.2, color: 'success.main' }}
          >
            <Check sx={{ fontSize: 12 }} />
          </IconButton>
        </Box>
      </ListItem>
    );
  }

  return (
    <ListItem
      disablePadding
      sx={{ mb: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ListItemButton
        component={Link}
        to={`/agent/${agentId}/chat/${conversation._id}`}
        selected={isActive}
        onClick={onNavigate}
        sx={{
          borderRadius: 1.5,
          py: 0.5,
          px: 1.5,
          pl: 4,
          textDecoration: 'none',
          "&:hover": { bgcolor: sidebar.hover },
          "&.Mui-selected": {
            bgcolor: sidebar.hover,
            "&:hover": { bgcolor: sidebar.hover },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 20, color: isActive ? sidebar.selectedBorder : sidebar.text }}>
          <ChatBubbleOutline sx={{ fontSize: 13 }} />
        </ListItemIcon>
        <ListItemText
          primary={title}
          sx={{
            '& .MuiListItemText-primary': {
              color: isActive ? sidebar.selectedText : sidebar.text,
              fontSize: '0.75rem',
              fontWeight: isActive ? 600 : 400,
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          }}
        />
        {(hovered || isActive) && (
          <>
            <IconButton
              size="small"
              onClick={handleStartEdit}
              sx={{ p: 0.2, color: sidebar.text, opacity: 0.6, '&:hover': { opacity: 1 } }}
            >
              <Edit sx={{ fontSize: 12 }} />
            </IconButton>
            <DeleteButton
              onConfirm={handleDelete}
              message="Delete this conversation?"
              renderTrigger={(onClick) => (
                <IconButton
                  size="small"
                  onClick={onClick}
                  sx={{
                    p: 0.2,
                    color: sidebar.text,
                    opacity: 0.6,
                    '&:hover': { color: '#f44336', opacity: 1 },
                  }}
                >
                  <DeleteOutline sx={{ fontSize: 13 }} />
                </IconButton>
              )}
            />
          </>
        )}
      </ListItemButton>
    </ListItem>
  );
}

function AgentSection({ agent, searchQuery, collapseKey, onNavigate }: { agent: { _id: string; name: string }; searchQuery?: string; collapseKey?: number; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { sidebar } = theme.palette;
  const [expanded, setExpanded] = useState(() =>
    location.pathname.startsWith(`/agent/${agent._id}/`)
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (collapseKey && !isAgentActive) setExpanded(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseKey]);
  const [hovered, setHovered] = useState(false);

  const { data: convData } = useGetConversationsQuery(agent._id);
  const [createConversation] = useCreateConversationMutation();
  const [deleteAgent] = useDeleteAgentMutation();

  const conversations = convData?.items ?? [];

  const isSearchActive = Boolean(searchQuery);
  const agentNameMatches = searchQuery ? agent.name.toLowerCase().includes(searchQuery.toLowerCase()) : true;

  if (isSearchActive && !agentNameMatches) {
    return null;
  }

  const handleNewChat = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await createConversation({ agentId: agent._id });
    if ('data' in result && result.data) {
      setExpanded(true);
      navigate(`/agent/${agent._id}/chat/${result.data._id}`);
      onNavigate?.();
    }
  };

  const handleDeleteAgent = async () => {
    await deleteAgent(agent._id);
    if (location.pathname.startsWith(`/agent/${agent._id}`)) {
      navigate('/');
    }
  };

  const isAgentActive = location.pathname.startsWith(`/agent/${agent._id}/`);

  return (
    <>
      <ListItem
        disablePadding
        sx={{ mb: 0.2 }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <ListItemButton
          onClick={() => setExpanded(!expanded)}
          sx={{
            borderRadius: 1.5,
            py: 0.6,
            px: 1.5,
            "&:hover": { bgcolor: sidebar.hover },
          }}
        >
          <ListItemIcon sx={{ minWidth: 24, color: isAgentActive ? sidebar.selectedBorder : sidebar.text }}>
            <SmartToy sx={{ fontSize: 16 }} />
          </ListItemIcon>
          <ListItemText
            primary={agent.name}
            sx={{
              '& .MuiListItemText-primary': {
                color: isAgentActive ? sidebar.selectedText : sidebar.text,
                fontSize: '0.78rem',
                fontWeight: isAgentActive ? 600 : 500,
                textTransform: 'capitalize',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              },
            }}
          />
          {hovered && (
            <DeleteButton
              onConfirm={handleDeleteAgent}
              message="Delete this agent and all its conversations?"
              renderTrigger={(onClick) => (
                <IconButton
                  size="small"
                  onClick={onClick}
                  sx={{
                    p: 0.2,
                    mr: 0.2,
                    color: sidebar.text,
                    opacity: 0.6,
                    '&:hover': { color: '#f44336', opacity: 1 },
                  }}
                >
                  <DeleteOutline sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            />
          )}
          <IconButton
            size="small"
            onClick={handleNewChat}
            sx={{ color: sidebar.text, p: 0.3, mr: 0.3, '&:hover': { color: 'success.main' } }}
          >
            <Add sx={{ fontSize: 14 }} />
          </IconButton>
          {expanded ? (
            <ExpandLess sx={{ fontSize: 16, color: sidebar.text }} />
          ) : (
            <ExpandMore sx={{ fontSize: 16, color: sidebar.text }} />
          )}
        </ListItemButton>
      </ListItem>
      <Collapse
        in={isSearchActive ? true : expanded}
        timeout="auto"
        unmountOnExit
      >
        <List disablePadding>
          {conversations.length === 0 && !isSearchActive ? (
            <Typography
              sx={{
                pl: 5,
                py: 0.5,
                color: sidebar.text,
                fontSize: '0.7rem',
                fontStyle: 'italic',
                opacity: 0.7,
              }}
            >
              No chats yet
            </Typography>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv._id}
                agentId={agent._id}
                conversation={conv}
                onNavigate={onNavigate}
              />
            ))
          )}
        </List>
      </Collapse>
    </>
  );
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const theme = useTheme();
  const { sidebar } = theme.palette;

  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapseKey, setCollapseKey] = useState(0);
  const [sortAlpha, setSortAlpha] = useState(false);

  const { data: agentsData, isLoading: agentsLoading } = useGetAgentsQuery();
  const [createAgent, { isLoading: isCreating }] = useCreateAgentMutation();
  const [syncAgents, { isLoading: isSyncing }] = useSyncAgentsMutation();
  const [syncDone, setSyncDone] = useState(false);
  const syncDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agents = sortAlpha
    ? [...(agentsData?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    : (agentsData?.items ?? []);

  useEffect(() => {
    syncAgents().then(() => {
      setSyncDone(true);
      syncDoneTimer.current = setTimeout(() => setSyncDone(false), 2500);
    });
    return () => {
      if (syncDoneTimer.current) clearTimeout(syncDoneTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateAgent = async () => {
    const name = newAgentName.trim();
    if (!name) return;
    try {
      await createAgent({ name }).unwrap();
    } catch {
      // mutation failed
    }
    setNewAgentName('');
    setShowNewAgent(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateAgent();
    }
    if (e.key === 'Escape') {
      setShowNewAgent(false);
      setNewAgentName('');
    }
  };

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: "100vh",
        bgcolor: sidebar.background,
        borderRight: 'none',
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
      }}
    >
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Box
          component="img"
          src="/openclaw.png"
          alt="OpenClaw"
          sx={{ width: 28, height: 28 }}
        />
        <Typography
          variant="h6"
          component="span"
          sx={{ fontWeight: 700, letterSpacing: '1px', color: 'error.main' }}
        >
          OpenClaw
        </Typography>
        <Typography
          variant="h6"
          component="span"
          sx={{ fontWeight: 700, letterSpacing: '1px', color: sidebar.selectedText }}
        >
          Client
        </Typography>
      </Box>

      <Box sx={{ px: 2, mb: 1, flexShrink: 0 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <Search sx={{ fontSize: 16, color: sidebar.text, mr: 0.5 }} />
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: sidebar.hover,
              borderRadius: 1.5,
              '& fieldset': { borderColor: 'transparent' },
              '&:hover fieldset': { borderColor: sidebar.text },
              '&.Mui-focused fieldset': { borderColor: sidebar.selectedBorder },
              '& input': { color: sidebar.selectedText, fontSize: '0.78rem', py: 0.7, px: 0.5 },
            },
          }}
        />
      </Box>

      <List sx={{ px: 2, flexShrink: 0 }}>
        {menuItems.map((item) => {
          const isSelected = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <ListItem
              key={item.text}
              disablePadding
              sx={{ mb: 0.5 }}
            >
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={onNavigate}
                selected={isSelected}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  textDecoration: "none",
                  position: 'relative',
                  "&:hover": {
                    bgcolor: sidebar.hover,
                    "& .MuiListItemText-primary": { color: sidebar.selectedText },
                    "& .MuiListItemIcon-root": { color: sidebar.selectedText },
                  },
                  "&.Mui-selected": {
                    bgcolor: sidebar.selectedBg,
                    boxShadow: '0 2px 8px rgba(44, 44, 40, 0.06)',
                    "&:hover": { bgcolor: sidebar.selectedBg },
                    "& .MuiListItemText-primary": { color: sidebar.selectedText },
                    "& .MuiListItemIcon-root": { color: sidebar.selectedBorder },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: sidebar.text }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      color: sidebar.text,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '1px',
                    },
                  }}
                />
                {isSelected && (
                  <Box
                    sx={{
                      width: 8, height: 8, borderRadius: '50%',
                      bgcolor: sidebar.selectedBorder, ml: 1,
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box
        sx={{
          px: 2,
          mt: 1,
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexShrink: 0 }}>
          <Typography
            sx={{
              color: sidebar.text,
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            Agents
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {isSyncing && (
              <CircularProgress
                size={11}
                sx={{ color: sidebar.text, opacity: 0.6 }}
              />
            )}
            {!isSyncing && syncDone && (
              <Box
                sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  bgcolor: 'success.main',
                  opacity: 1,
                  animation: 'fadeOut 2.5s ease-in forwards',
                  '@keyframes fadeOut': { '0%': { opacity: 1 }, '60%': { opacity: 1 }, '100%': { opacity: 0 } },
                }}
              />
            )}
            <IconButton
              size="small"
              onClick={() => setSortAlpha((v) => !v)}
              title={sortAlpha ? 'Unsort' : 'Sort A–Z'}
              sx={{
                color: sortAlpha ? 'primary.main' : sidebar.text,
                p: 0.3,
                '&:hover': { color: 'primary.main' },
              }}
            >
              <SwapVert sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setCollapseKey((k) => k + 1)}
              title="Collapse all"
              sx={{ color: sidebar.text, p: 0.3, '&:hover': { color: sidebar.selectedText } }}
            >
              <KeyboardDoubleArrowUp sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setShowNewAgent(!showNewAgent)}
              sx={{ color: sidebar.text, p: 0.3, '&:hover': { color: 'success.main' } }}
            >
              <Add sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        {isSyncing && (
          <Box
            sx={{
              mb: 1,
              px: 0.5,
              overflow: 'hidden',
              height: 2,
              borderRadius: 1,
              bgcolor: sidebar.border,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                height: '100%',
                borderRadius: 1,
                bgcolor: sidebar.selectedBorder,
                animation: 'indeterminate 1.4s ease-in-out infinite',
                '@keyframes indeterminate': {
                  '0%':   { width: '0%',   marginLeft: '0%' },
                  '50%':  { width: '60%',  marginLeft: '20%' },
                  '100%': { width: '0%',   marginLeft: '100%' },
                },
              }}
            />
          </Box>
        )}

        {showNewAgent && (
          <Box sx={{ mb: 1, flexShrink: 0 }}>
            <TextField
              fullWidth
              size="small"
              autoFocus
              placeholder="Agent name"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: sidebar.hover,
                  borderRadius: 1.5,
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: sidebar.text },
                  '&.Mui-focused fieldset': { borderColor: sidebar.selectedBorder },
                  '& input': { color: sidebar.selectedText, fontSize: '0.8rem', py: 0.8, px: 1.5 },
                },
              }}
            />
          </Box>
        )}

        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: sidebar.border,
              borderRadius: 2,
              '&:hover': { bgcolor: sidebar.text },
            },
          }}
        >
          {agentsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress
                size={18}
                sx={{ color: sidebar.text }}
              />
            </Box>
          ) : (
            <List disablePadding>
              {agents.map((agent) => (
                <AgentSection
                  key={agent._id}
                  agent={agent}
                  searchQuery={searchQuery || undefined}
                  collapseKey={collapseKey}
                  onNavigate={onNavigate}
                />
              ))}
            </List>
          )}
        </Box>
      </Box>

      <ThemePicker />
    </Box>
  );
}
