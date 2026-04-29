import { Box, Stack, Typography } from '@mui/material';
import { type AgentUsageResponse } from '../../../../entities/agent';
import { formatCost, formatRelative, formatTokens } from '../lib/format';

interface SessionListProps {
  rows: AgentUsageResponse['sessions'];
}

export default function SessionList({ rows }: SessionListProps) {
  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="text.disabled">
        No sessions yet.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.5}>
      {rows.map((s) => (
        <Box
          key={s.key}
          sx={{
            borderRadius: 1,
            p: 1,
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label || 'Untitled session'}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.disabled', fontSize: '0.7rem' }}
            >
              {[s.channel, s.modelProvider && s.model ? `${s.modelProvider}/${s.model}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
              {' · '}
              {formatRelative(s.updatedAt)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTokens(s.totalTokens)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatCost(s.totalCost)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Stack>
  );
}
