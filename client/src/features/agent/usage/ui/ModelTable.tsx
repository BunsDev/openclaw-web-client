import { Box, Stack, Typography } from '@mui/material';
import { type AgentUsageModelRow } from '../../../../entities/agent';
import { formatCost, formatTokens } from '../lib/format';

interface ModelTableProps {
  rows: AgentUsageModelRow[];
  totalTokens: number;
}

export default function ModelTable({ rows, totalTokens }: ModelTableProps) {
  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="text.disabled">
        No model usage recorded.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.75}>
      {rows.map((row) => {
        const share = totalTokens > 0 ? (row.totalTokens / totalTokens) * 100 : 0;
        return (
          <Box
            key={`${row.provider}/${row.model}`}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 0.75,
                    flexWrap: 'wrap',
                    rowGap: 0,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={600}
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}
                  >
                    {row.model || row.provider || '—'}
                  </Typography>
                  {row.provider && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.disabled',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.7rem',
                      }}
                    >
                      {row.provider}
                    </Typography>
                  )}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: '0.7rem',
                  }}
                >
                  {row.count.toLocaleString()} turn{row.count === 1 ? '' : 's'} · in{' '}
                  {formatTokens(row.input)} · out {formatTokens(row.output)}
                  {row.cacheRead > 0 ? ` · cache ${formatTokens(row.cacheRead)}` : ''}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatTokens(row.totalTokens)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCost(row.totalCost)}
                  {share > 0 ? ` · ${share.toFixed(0)}%` : ''}
                </Typography>
              </Box>
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
