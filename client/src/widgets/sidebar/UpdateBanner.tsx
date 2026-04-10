import { useState } from 'react';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { SystemUpdateAlt } from '@mui/icons-material';
import { useCheckUpdateQuery, useApplyUpdateMutation } from '../../entities/update/api';

export default function UpdateBanner() {
  const theme = useTheme();
  const { sidebar } = theme.palette;
  const [phase, setPhase] = useState<'idle' | 'applying' | 'restarting'>('idle');

  const { data } = useCheckUpdateQuery(undefined, { pollingInterval: 7_200_000 });
  const [applyUpdate] = useApplyUpdateMutation();

  const handleClick = async () => {
    if (phase !== 'idle') return;
    setPhase('applying');
    try {
      const result = await applyUpdate().unwrap();
      if (result.ok) {
        setPhase('restarting');
        const poll = setInterval(async () => {
          try {
            const res = await fetch(
              `${window.location.origin.replace(':18800', ':18802')}/api/update/status`,
            );
            if (res.ok) {
              clearInterval(poll);
              window.location.reload();
            }
          } catch { /* server still restarting */ }
        }, 3000);
        setTimeout(() => clearInterval(poll), 120000);
      } else {
        setPhase('idle');
      }
    } catch {
      setPhase('idle');
    }
  };

  if (!data?.available && phase === 'idle') return null;

  return (
    <Box
      onClick={handleClick}
      sx={{
        mx: 2,
        mb: 0.5,
        px: 1.5,
        py: 0.75,
        borderRadius: 1.5,
        bgcolor: phase === 'idle' ? 'success.main' : sidebar.hover,
        color: phase === 'idle' ? '#fff' : sidebar.text,
        fontSize: '0.7rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        cursor: phase === 'idle' ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'opacity 0.2s',
        '&:hover': phase === 'idle' ? { opacity: 0.85 } : {},
      }}
    >
      {phase === 'idle' && (
        <>
          <SystemUpdateAlt sx={{ fontSize: 14 }} />
          v{data?.latest} available
        </>
      )}
      {phase === 'applying' && (
        <>
          <CircularProgress size={12} sx={{ color: sidebar.text }} />
          Updating...
        </>
      )}
      {phase === 'restarting' && (
        <>
          <CircularProgress size={12} sx={{ color: sidebar.text }} />
          Restarting...
        </>
      )}
    </Box>
  );
}
