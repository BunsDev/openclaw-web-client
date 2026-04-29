import { Chip, Stack, Typography } from '@mui/material';

interface ToolListProps {
  rows: { name: string; count: number }[];
}

export default function ToolList({ rows }: ToolListProps) {
  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="text.disabled">
        No tool calls in this range.
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
      {rows.map((t) => (
        <Chip
          key={t.name}
          size="small"
          variant="outlined"
          label={`${t.name} · ${t.count.toLocaleString()}`}
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.7rem',
          }}
        />
      ))}
    </Stack>
  );
}
