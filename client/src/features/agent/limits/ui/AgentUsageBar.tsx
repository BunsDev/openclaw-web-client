import { useMemo } from 'react';
import { Box, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import {
  useGetAgentLimitsQuery,
  type AgentLimitWindow,
  type AgentLimitWindowState,
} from '../../../../entities/agent';

interface AgentUsageBarProps {
  agentId: string;
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

function pickHotWindow(rows: WindowRow[]): WindowRow {
  const configured = rows.filter((r) => r.state.limit != null);
  if (configured.length === 0) return rows[0];
  return configured.reduce((acc, r) => ((r.state.ratio ?? 0) > (acc.state.ratio ?? 0) ? r : acc));
}

export default function AgentUsageBar({ agentId }: AgentUsageBarProps) {
  const { data } = useGetAgentLimitsQuery(agentId, { skip: !agentId });

  const rows = useMemo<WindowRow[]>(() => {
    if (!data) return [];
    return [
      { id: 'daily', label: 'Daily', state: data.windows.daily },
      { id: 'monthly', label: 'Monthly', state: data.windows.monthly },
      { id: 'total', label: 'All-time', state: data.windows.total },
    ];
  }, [data]);

  if (!data || rows.length === 0) return null;

  const anyConfigured = rows.some((r) => r.state.limit != null);
  if (!anyConfigured) return null;

  const hot = pickHotWindow(rows);
  const colour = ratioColour(hot.state);
  const pct = hot.state.ratio == null ? 0 : Math.min(100, hot.state.ratio * 100);

  return (
    <Tooltip
      placement="bottom"
      title={
        <Box sx={{ fontSize: '0.7rem', minWidth: 180 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
            Spend vs. cap
          </Typography>
          <Stack spacing={0.5}>
            {rows.map((r) => (
              <Box key={r.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <span>{r.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtUsd(r.state.spent)}
                  {r.state.limit != null
                    ? ` / ${fmtUsd(r.state.limit)} (${((r.state.ratio ?? 0) * 100).toFixed(0)}%)`
                    : ' / no cap'}
                </span>
              </Box>
            ))}
          </Stack>
        </Box>
      }
    >
      <Box sx={{ width: '100%', cursor: 'help', userSelect: 'none' }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          color={colour}
          sx={{
            height: 2,
            borderRadius: 0,
            bgcolor: 'action.hover',
          }}
        />
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={0.75}
          sx={{ px: 1, pt: 0.25 }}
        >
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.65rem',
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              fontWeight: 600,
            }}
          >
            {hot.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.65rem',
              fontVariantNumeric: 'tabular-nums',
              color: hot.state.exceeded
                ? 'error.main'
                : hot.state.nearLimit
                  ? 'warning.main'
                  : 'text.secondary',
              fontWeight: hot.state.exceeded || hot.state.nearLimit ? 700 : 500,
            }}
          >
            {fmtUsd(hot.state.spent)}
            {hot.state.limit != null
              ? ` / ${fmtUsd(hot.state.limit)} · ${((hot.state.ratio ?? 0) * 100).toFixed(0)}%`
              : ''}
          </Typography>
        </Stack>
      </Box>
    </Tooltip>
  );
}
