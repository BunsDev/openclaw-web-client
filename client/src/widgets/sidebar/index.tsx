import { useState, useEffect, useRef } from 'react';
import {
  Box,
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
  Select,
  MenuItem,
  InputAdornment,
  Divider,
} from '@mui/material';
import {
  People,
  Add,
  Search,
  KeyboardDoubleArrowUp,
  SwapVert,
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router';
import {
  useGetAgentsQuery,
  useCreateAgentMutation,
  useSyncAgentsMutation,
} from '../../entities/agent/api';
import { useGetAllConversationsQuery } from '../../entities/conversation/api';
import ThemePicker from '../../features/theme/ThemePicker';
import UpdateBanner from './UpdateBanner';
import AgentSection from './AgentSection';
import TerminalPanel from './TerminalPanel';

export const SIDEBAR_WIDTH = 240;

const menuItems = [{ text: 'USERS', icon: <People />, path: '/users' }];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const theme = useTheme();
  const { sidebar } = theme.palette;

  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [createMode, setCreateMode] = useState<'quick' | 'configure'>('quick');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapseKey, setCollapseKey] = useState(0);
  const [sortAlpha, setSortAlpha] = useState(false);
  const [terminalAgent, setTerminalAgent] = useState<{ slug: string; dbId: string } | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  const { data: agentsData, isLoading: agentsLoading } = useGetAgentsQuery();
  const { data: convData } = useGetAllConversationsQuery();
  const [createAgent, { isLoading: isCreating }] = useCreateAgentMutation();
  const [syncAgents, { isLoading: isSyncing }] = useSyncAgentsMutation();
  const [syncDone, setSyncDone] = useState(false);
  const syncDoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncCalled = useRef(false);

  const allConversations = convData?.items ?? [];
  const agents = sortAlpha
    ? [...(agentsData?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    : (agentsData?.items ?? []);

  useEffect(() => {
    if (syncCalled.current) return;
    if (agentsLoading || !agentsData) return;
    syncCalled.current = true;
    syncAgents().then(() => {
      setSyncDone(true);
      syncDoneTimer.current = setTimeout(() => setSyncDone(false), 2500);
    });
    return () => {
      if (syncDoneTimer.current) clearTimeout(syncDoneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentsLoading]);

  const [createError, setCreateError] = useState('');

  const handleCreateAgent = async () => {
    const name = newAgentName.trim();
    if (!name) return;
    setCreateError('');
    try {
      const interactive = createMode === 'configure';
      const saved = await createAgent({ name, interactive }).unwrap();
      const slug =
        saved.openclawAgentId ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      setNewAgentName('');
      setShowNewAgent(false);
      if (interactive) {
        setTerminalAgent({ slug, dbId: saved._id });
      }
    } catch (err: unknown) {
      const data = (err as { data?: Record<string, string[]> })?.data;
      const msg =
        data?.name?.[0] || Object.values(data || {}).flat()[0] || 'Failed to create agent';
      setCreateError(msg as string);
    }
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
        height: '100vh',
        bgcolor: sidebar.background,
        borderRight: 'none',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
      }}
    >
      <Box
        sx={{
          p: 3,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Box component="img" src="/openclaw.png" alt="OpenClaw" sx={{ width: 28, height: 28 }} />
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
              startAdornment: <Search sx={{ fontSize: 16, color: sidebar.text, mr: 0.5 }} />,
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
          const isSelected =
            location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={onNavigate}
                selected={isSelected}
                sx={{
                  borderRadius: 2,
                  py: 1.5,
                  px: 2,
                  textDecoration: 'none',
                  position: 'relative',
                  '&:hover': {
                    bgcolor: sidebar.hover,
                    '& .MuiListItemText-primary': { color: sidebar.selectedText },
                    '& .MuiListItemIcon-root': { color: sidebar.selectedText },
                  },
                  '&.Mui-selected': {
                    bgcolor: sidebar.selectedBg,
                    boxShadow: '0 2px 8px rgba(44, 44, 40, 0.06)',
                    '&:hover': { bgcolor: sidebar.selectedBg },
                    '& .MuiListItemText-primary': { color: sidebar.selectedText },
                    '& .MuiListItemIcon-root': { color: sidebar.selectedBorder },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: sidebar.text }}>{item.icon}</ListItemIcon>
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
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: sidebar.selectedBorder,
                      ml: 1,
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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
            flexShrink: 0,
          }}
        >
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
            {isSyncing && <CircularProgress size={11} sx={{ color: sidebar.text, opacity: 0.6 }} />}
            {!isSyncing && syncDone && (
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  opacity: 1,
                  animation: 'fadeOut 2.5s ease-in forwards',
                  '@keyframes fadeOut': {
                    '0%': { opacity: 1 },
                    '60%': { opacity: 1 },
                    '100%': { opacity: 0 },
                  },
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
              onClick={() => {
                setShowNewAgent((prev) => {
                  if (!prev) setCreateMode('quick');
                  return !prev;
                });
              }}
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
                  '0%': { width: '0%', marginLeft: '0%' },
                  '50%': { width: '60%', marginLeft: '20%' },
                  '100%': { width: '0%', marginLeft: '100%' },
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
              onChange={(e) => {
                setNewAgentName(e.target.value);
                setCreateError('');
              }}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              error={!!createError}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end" sx={{ ml: 0 }}>
                      <Divider
                        orientation="vertical"
                        flexItem
                        sx={{ mx: 0.5, borderColor: sidebar.border }}
                      />
                      <Select
                        size="small"
                        value={createMode}
                        onChange={(e) => setCreateMode(e.target.value as 'quick' | 'configure')}
                        variant="standard"
                        disableUnderline
                        sx={{
                          fontSize: '0.7rem',
                          color: sidebar.selectedText,
                          '& .MuiSelect-select': { py: 0, pr: '18px !important', pl: 0.5 },
                          '& .MuiSvgIcon-root': { color: sidebar.text, fontSize: 14, right: 0 },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              bgcolor: sidebar.background,
                              border: `1px solid ${sidebar.border}`,
                              '& .MuiMenuItem-root': {
                                fontSize: '0.7rem',
                                color: sidebar.text,
                                py: 0.5,
                                '&.Mui-selected': {
                                  bgcolor: sidebar.hover,
                                  color: sidebar.selectedText,
                                },
                                '&:hover': { bgcolor: sidebar.hover },
                              },
                            },
                          },
                        }}
                      >
                        <MenuItem value="quick">Quick add</MenuItem>
                        <MenuItem value="configure">Configure</MenuItem>
                      </Select>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: sidebar.hover,
                  borderRadius: 1.5,
                  pr: 0.5,
                  '& fieldset': { borderColor: createError ? 'error.main' : 'transparent' },
                  '&:hover fieldset': { borderColor: createError ? 'error.main' : sidebar.text },
                  '&.Mui-focused fieldset': {
                    borderColor: createError ? 'error.main' : sidebar.selectedBorder,
                  },
                  '& input': { color: sidebar.selectedText, fontSize: '0.8rem', py: 0.8, px: 1.5 },
                },
              }}
            />
            {createError && (
              <Typography sx={{ color: 'error.main', fontSize: '0.65rem', mx: 0.5, mt: 0.25 }}>
                {createError}
              </Typography>
            )}
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
              <CircularProgress size={18} sx={{ color: sidebar.text }} />
            </Box>
          ) : (
            <List disablePadding>
              {agents.map((agent) => (
                <AgentSection
                  key={agent._id}
                  agent={agent}
                  conversations={allConversations.filter((c) => c.agentId === agent._id)}
                  searchQuery={searchQuery || undefined}
                  collapseKey={collapseKey}
                  onNavigate={onNavigate}
                  disabled={deletingAgentId === agent._id}
                />
              ))}
            </List>
          )}
        </Box>
      </Box>

      <UpdateBanner />

      <ThemePicker />

      {terminalAgent && (
        <TerminalPanel
          agentName={terminalAgent.slug}
          agentDbId={terminalAgent.dbId}
          open
          onClose={() => setTerminalAgent(null)}
          onDeleting={setDeletingAgentId}
        />
      )}
    </Box>
  );
}
