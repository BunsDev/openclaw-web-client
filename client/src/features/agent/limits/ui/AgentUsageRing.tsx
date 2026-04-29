import { useEffect, useMemo } from 'react';
import { Box, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import {
  useGetAgentLimitsQuery,
  type AgentLimitWindow,
  type AgentLimitWindowState,
} from '../../../../entities/agent';

interface AgentUsageRingProps {
  agentId: string;
  conversationId?: string | number | null;
  size?: number;
}

interface WindowRow {
  id: AgentLimitWindow;
  label: string;
  state: AgentLimitWindowState;
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0.00';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

function ratioColour(state: AgentLimitWindowState): 'secondary' | 'warning' | 'error' | 'primary' {
  if (state.exceeded) return 'error';
  if (state.nearLimit) return 'warning';
  return state.limit == null ? 'primary' : 'secondary';
}

/** Pick the configured window with the highest fill ratio. */
function pickHotWindow(rows: WindowRow[]): WindowRow {
  const configured = rows.filter((r) => r.state.limit != null);
  if (configured.length === 0) return rows[0];
  return configured.reduce((acc, r) => ((r.state.ratio ?? 0) > (acc.state.ratio ?? 0) ? r : acc));
}

export default function AgentUsageRing({
  agentId,
  conversationId,
  size = 32,
}: AgentUsageRingProps) {
  const { data, refetch, isFetching } = useGetAgentLimitsQuery(agentId, {
    skip: !agentId,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (!agentId) return;
    refetch();
  }, [agentId, conversationId, refetch]);

  const rows = useMemo<WindowRow[]>(() => {
    if (!data) return [];
    return [
      { id: 'daily', label: 'Daily', state: data.windows.daily },
      { id: 'monthly', label: 'Monthly', state: data.windows.monthly },
      { id: 'total', label: 'All-time', state: data.windows.total },
    ];
  }, [data]);

  if (isFetching) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={size - 8} thickness={2} sx={{ color: 'text.disabled' }} />
      </Box>
    );
  }

  if (!data || rows.length === 0) return null;

  const anyConfigured = rows.some((r) => r.state.limit != null);
  if (!anyConfigured) return null;

  const hot = pickHotWindow(rows);
  const colour = ratioColour(hot.state);
  const pct = hot.state.ratio == null ? 0 : Math.min(100, hot.state.ratio * 100);
  const labelPct = hot.state.exceeded
    ? '100+'
    : `${Math.round(hot.state.ratio == null ? 0 : hot.state.ratio * 100)}`;

  const popoverTitle = (
    <Box sx={{ minWidth: 220, py: 0.25, px: 0.5 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          display: 'block',
          mb: 0.75,
          color: 'text.primary',
          fontSize: '0.75rem',
        }}
      >
        Spend vs. cap
      </Typography>
      <Stack spacing={0.5}>
        {rows.map((r) => {
          const overLimit = r.state.exceeded;
          const nearLimit = r.state.nearLimit;
          return (
            <Box
              key={r.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  fontWeight: 500,
                }}
              >
                {r.label}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.72rem',
                  fontWeight: overLimit || nearLimit ? 700 : 500,
                  color: overLimit ? 'error.main' : nearLimit ? 'warning.main' : 'text.primary',
                }}
              >
                {fmtUsd(r.state.spent)}
                {r.state.limit != null
                  ? ` / ${fmtUsd(r.state.limit)} (${((r.state.ratio ?? 0) * 100).toFixed(0)}%)`
                  : ' / no cap'}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );

  return (
    <Tooltip
      placement="bottom-start"
      arrow
      title={popoverTitle}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            px: 1.5,
            py: 1,
            maxWidth: 320,
          },
        },
        arrow: {
          sx: {
            color: 'background.paper',
            '&::before': {
              border: '1px solid',
              borderColor: 'divider',
            },
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        <CircularProgress
          variant="determinate"
          value={100}
          size={size}
          thickness={4}
          sx={{
            position: 'absolute',
            inset: 0,
            color: 'action.hover',
          }}
        />
        <CircularProgress
          variant="determinate"
          value={pct}
          color={colour}
          size={size}
          thickness={4}
          sx={{
            position: 'absolute',
            inset: 0,
            transition: 'all 0.3s',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontSize: size <= 28 ? '0.6rem' : '0.65rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            color: hot.state.exceeded
              ? 'error.main'
              : hot.state.nearLimit
                ? 'warning.main'
                : 'text.secondary',
          }}
        >
          {labelPct}
          {!hot.state.exceeded && (
            <Box component="span" sx={{ fontSize: '0.55em', ml: 0.1 }}>
              %
            </Box>
          )}
        </Typography>
      </Box>
    </Tooltip>
  );
}
