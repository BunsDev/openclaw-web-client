import { useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { CheckCircle, ExpandMore, WarningAmber } from '@mui/icons-material';
import {
  useGetAgentProviderModelsQuery,
  useUpdateAgentProviderModelMutation,
  type AgentProviderModel,
} from '../../../../entities/agent';

interface AgentModelPickerProps {
  agentId: string;
  currentModel?: string | null;
  conversationId?: number | string;
}

function stripProvider(key: string): string {
  const idx = key.indexOf('/');
  return idx > 0 ? key.slice(idx + 1) : key;
}

function parseProvider(key: string | null | undefined): string | null {
  if (!key) return null;
  const idx = key.indexOf('/');
  return idx > 0 ? key.slice(0, idx) : null;
}

function labelFor(model: AgentProviderModel | null | undefined, fallback: string): string {
  if (!model) return fallback;
  return model.name || stripProvider(model.key);
}

/** `1000000` → `1M`, `272000` → `272k`, `4096` → `4k`. */
function formatCtx(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export default function AgentModelPicker({
  agentId,
  currentModel,
  conversationId,
}: AgentModelPickerProps) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const [prevAgentId, setPrevAgentId] = useState(agentId);
  if (agentId !== prevAgentId) {
    setPrevAgentId(agentId);
    if (open) setOpen(false);
    if (pendingKey !== null) setPendingKey(null);
    if (hint !== null) setHint(null);
  }

  const { currentData, isFetching } = useGetAgentProviderModelsQuery(agentId, {
    skip: !agentId || !open,
  });
  const [update, { isLoading: saving }] = useUpdateAgentProviderModelMutation();

  const provider = parseProvider(currentModel);
  if (!agentId || !currentModel || !provider) return null;

  const data = currentData && currentData.provider === provider ? currentData : null;
  const effectiveCurrent = data?.currentModel ?? currentModel;
  const matched = data?.models.find((m) => m.key === effectiveCurrent) ?? null;
  const currentLabel = labelFor(matched, stripProvider(effectiveCurrent));

  async function handlePick(model: AgentProviderModel) {
    if (model.key === effectiveCurrent || saving) return;
    setPendingKey(model.key);
    setHint(null);
    try {
      const result = await update({ agentId, model: model.key, conversationId }).unwrap();
      setHint(result.restartHint ?? null);
      setOpen(false);
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'data' in err
          ? ((err as { data?: { error?: string } }).data?.error ?? 'Failed to change model.')
          : 'Failed to change model.';
      setHint(msg);
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title={`Switch ${provider} model`} placement="bottom-start">
        <ButtonBase
          ref={anchorRef}
          onClick={() => setOpen(true)}
          disabled={saving}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            color: 'text.secondary',
            fontSize: '0.7rem',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            transition: 'all 0.12s',
            '&:hover': {
              bgcolor: 'action.selected',
              color: 'text.primary',
            },
            '&.Mui-disabled': {
              opacity: 0.6,
            },
          }}
        >
          <Box
            component="span"
            sx={{ color: 'text.disabled', textTransform: 'lowercase', mr: 0.25 }}
          >
            {provider}
          </Box>
          <Box component="span">{currentLabel}</Box>
          {saving ? (
            <CircularProgress size={10} sx={{ ml: 0.5 }} />
          ) : (
            <ExpandMore sx={{ fontSize: 14, ml: 0.25 }} />
          )}
        </ButtonBase>
      </Tooltip>

      {hint && (
        <Tooltip title={hint}>
          <WarningAmber sx={{ fontSize: 14, color: 'warning.main' }} />
        </Tooltip>
      )}

      <Menu
        anchorEl={anchorRef.current}
        open={open}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              mt: 0.5,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (theme) =>
                theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
              backgroundImage: 'none',
            },
          },
          list: {
            sx: {
              py: 0,
              maxHeight: 420,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'divider',
                borderRadius: 3,
              },
            },
          },
        }}
      >
        {isFetching && !data && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 2 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Loading {provider} models…
            </Typography>
          </Box>
        )}

        {data && data.models.length === 0 && !isFetching && (
          <Box sx={{ px: 2, py: 2 }}>
            <Typography variant="caption" color="text.secondary">
              No {provider} models available.
            </Typography>
          </Box>
        )}

        {data?.models.map((m, idx) => {
          const selected = m.key === effectiveCurrent;
          const isPending = pendingKey === m.key;
          const displayName = labelFor(m, stripProvider(m.key));
          return (
            <Box key={m.key}>
              {idx > 0 && <Divider sx={{ borderStyle: 'dashed', opacity: 0.5 }} />}
              <MenuItem
                onClick={() => void handlePick(m)}
                selected={selected}
                disabled={saving}
                sx={{
                  px: 1.5,
                  py: 1,
                  alignItems: 'center',
                  gap: 1.25,
                  bgcolor: 'transparent',
                  transition: 'background-color 0.12s',
                  '&:hover': {
                    bgcolor: 'action.selected',
                  },
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    '&:hover': {
                      bgcolor: 'action.selected',
                    },
                  },
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: selected ? 600 : 500,
                        color: selected ? 'success.main' : 'text.primary',
                        lineHeight: 1.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                      }}
                    >
                      {displayName}
                    </Typography>
                    {selected && (
                      <CheckCircle sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'text.disabled',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.66rem',
                      lineHeight: 1.4,
                      mt: 0.25,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.key}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {m.local && (
                    <Chip
                      label="local"
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        borderColor: 'divider',
                        color: 'text.secondary',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  )}
                  {m.contextWindow ? (
                    <Chip
                      label={formatCtx(m.contextWindow)}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                        '& .MuiChip-label': { px: 0.9 },
                      }}
                    />
                  ) : null}
                  {isPending && <CircularProgress size={14} sx={{ ml: 0.5 }} />}
                </Box>
              </MenuItem>
            </Box>
          );
        })}
      </Menu>
    </Box>
  );
}
