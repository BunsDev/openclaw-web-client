import { Box, Typography } from '@mui/material';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          fontWeight: 600,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}
