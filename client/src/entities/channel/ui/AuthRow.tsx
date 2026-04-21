import { Box, Typography, Chip } from '@mui/material';
import type { ChannelAuth } from '../api';
import ChannelLogo from './ChannelLogo';

export default function AuthRow({ profile }: { profile: ChannelAuth }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 2,
        borderRadius: 1.5,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <ChannelLogo provider={profile.provider} size={18} fallback="🔑" />
      </Box>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: 'success.main',
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {profile.provider}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{profile.id}</Typography>
      </Box>
      <Chip
        label={profile.type.replace(/_/g, ' ')}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 1 },
        }}
      />
      {profile.isExternal && (
        <Chip
          label="external"
          size="small"
          color="info"
          variant="outlined"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 600,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      )}
    </Box>
  );
}
