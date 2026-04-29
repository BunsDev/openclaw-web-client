import { Box, Tooltip, Typography } from '@mui/material';
import { type AgentUsageDailyPoint } from '../../../../entities/agent';
import { formatCost, formatDate, formatTokens } from '../lib/format';

interface DailyChartProps {
  points: AgentUsageDailyPoint[];
}

export default function DailyChart({ points }: DailyChartProps) {
  const max = points.reduce((acc, p) => Math.max(acc, p.tokens), 0);
  if (points.length === 0 || max === 0) {
    return (
      <Typography variant="caption" color="text.disabled">
        No daily activity yet.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0.5,
        height: 120,
        overflowX: 'auto',
        py: 0.5,
        px: 0.25,
      }}
    >
      {points.map((p) => {
        const ratio = max > 0 ? p.tokens / max : 0;
        const heightPct = Math.max(p.tokens > 0 ? 4 : 0, ratio * 100);
        return (
          <Tooltip
            key={p.date}
            placement="top"
            title={
              <Box sx={{ fontSize: '0.7rem' }}>
                <Box>{formatDate(p.date)}</Box>
                <Box>{formatTokens(p.tokens)} tokens</Box>
                <Box>{formatCost(p.cost)}</Box>
              </Box>
            }
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 22,
                height: '100%',
              }}
            >
              <Box
                sx={{
                  flex: 1,
                  width: 10,
                  display: 'flex',
                  alignItems: 'flex-end',
                  minHeight: 0,
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: `${heightPct}%`,
                    bgcolor: 'primary.main',
                    opacity: 0.7,
                    borderRadius: 0.5,
                    transition: 'height 0.2s',
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.disabled',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {formatDate(p.date)}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
