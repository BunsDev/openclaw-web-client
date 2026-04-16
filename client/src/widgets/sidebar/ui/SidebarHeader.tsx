import { Box, Typography, useTheme } from '@mui/material';

export default function SidebarHeader() {
  const { sidebar } = useTheme().palette;
  return (
    <Box
      sx={{
        p: 3,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 1,
        flexShrink: 0,
      }}
    >
      <Box component="img" src="/logo_128.png" alt="OpenClaw" sx={{ width: 16, height: 16 }} />
      <Typography
        variant="h6"
        component="span"
        sx={{ fontWeight: 700, letterSpacing: '1px', color: 'error.main' }}
      >
        OpenClaw
      </Typography>
      <Typography
        variant="h6"
        component="span"
        sx={{ fontWeight: 700, letterSpacing: '1px', color: sidebar.selectedText }}
      >
        Client
      </Typography>
    </Box>
  );
}
