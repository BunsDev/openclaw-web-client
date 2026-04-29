import { useMemo } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useGetAgentUsageQuery } from '../../../../entities/agent';
import { AgentLimitsEditor } from '../../limits';
import {
  formatCost,
  formatDate,
  formatDuration,
  formatRelative,
  formatTokens,
} from '../lib/format';
import StatCard from './StatCard';
import DailyChart from './DailyChart';
import ModelTable from './ModelTable';
import ToolList from './ToolList';
import SessionList from './SessionList';

interface AgentUsageProps {
  agentId: string;
}

export default function AgentUsage({ agentId }: AgentUsageProps) {
  const { data, isLoading, isFetching, isError, refetch } = useGetAgentUsageQuery(agentId, {
    skip: !agentId,
  });

  const totalsCard = useMemo(() => {
    if (!data) return null;
    return {
      tokens: formatTokens(data.totals.totalTokens),
      cost: formatCost(data.totals.totalCost),
      sessions: data.sessionCount.toLocaleString(),
      messages: data.messageCounts.total.toLocaleString(),
    };
  }, [data]);

  if (isLoading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Alert
        severity="error"
        action={
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Could not load agent usage.
      </Alert>
    );
  }

  const rangeLabel =
    data.range.startDate && data.range.endDate
      ? `${formatDate(data.range.startDate)} – ${formatDate(data.range.endDate)}`
      : null;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Agent usage
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Token, cost, and activity totals across this agent's sessions
            {rangeLabel ? ` (${rangeLabel})` : ''}.
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() => refetch()}
          disabled={isFetching}
          startIcon={isFetching ? <CircularProgress size={12} /> : null}
        >
          {isFetching ? 'Refreshing' : 'Refresh'}
        </Button>
      </Stack>

      <Box sx={{ mb: 1.5 }}>
        <AgentLimitsEditor agentId={agentId} />
      </Box>

      {data.sessionCount === 0 ? (
        <Alert severity="info" variant="outlined">
          No sessions recorded for this agent yet. Send a message to start collecting usage stats.
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <StatCard
              label="Total tokens"
              value={totalsCard?.tokens ?? '0'}
              hint={`${formatTokens(data.totals.input)} in · ${formatTokens(
                data.totals.output
              )} out${data.totals.cacheRead > 0 ? ` · ${formatTokens(data.totals.cacheRead)} cache` : ''}`}
            />
            <StatCard
              label="Estimated cost"
              value={totalsCard?.cost ?? '$0.00'}
              hint={data.totals.totalCost > 0 ? 'Includes cache reads/writes' : undefined}
            />
            <StatCard
              label="Sessions"
              value={totalsCard?.sessions ?? '0'}
              hint={data.lastActivity ? `Last: ${formatRelative(data.lastActivity)}` : undefined}
            />
            <StatCard
              label="Messages"
              value={totalsCard?.messages ?? '0'}
              hint={`${data.messageCounts.user.toLocaleString()} user · ${data.messageCounts.assistant.toLocaleString()} assistant`}
            />
          </Stack>

          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
              bgcolor: 'background.paper',
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                Tokens per day
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                {data.daily.length} day{data.daily.length === 1 ? '' : 's'} of activity
              </Typography>
            </Stack>
            <DailyChart points={data.daily} />
          </Box>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            alignItems="stretch"
            sx={{ width: '100%' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Models
              </Typography>
              <ModelTable rows={data.models} totalTokens={data.totals.totalTokens} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Tools
              </Typography>
              <ToolList rows={data.tools} />
              {data.latency.count > 0 && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
                    Latency
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontVariantNumeric: 'tabular-nums',
                      display: 'block',
                    }}
                  >
                    avg {formatDuration(data.latency.avgMs)} · p95{' '}
                    {formatDuration(data.latency.p95Ms)} · {data.latency.count.toLocaleString()}{' '}
                    turn{data.latency.count === 1 ? '' : 's'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Recent sessions
            </Typography>
            <SessionList rows={data.sessions.slice(0, 12)} />
          </Box>
        </Stack>
      )}
    </Box>
  );
}
