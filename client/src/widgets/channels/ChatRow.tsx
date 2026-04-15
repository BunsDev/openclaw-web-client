import { Box, Typography, Chip, IconButton } from '@mui/material';
import { Delete } from '@mui/icons-material';
import type { ChannelChat } from '../../entities/channel/api';
import providerEmoji from './providerEmoji';

export default function ChatRow({
  channel,
  onRemove,
}: {
  channel: ChannelChat;
  onRemove: (name: string) => void;
}) {
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
      <Typography sx={{ fontSize: '1.1rem', flexShrink: 0, width: 24, textAlign: 'center' }}>
        {providerEmoji[channel.provider] || '📡'}
      </Typography>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          bgcolor: channel.enabled ? 'success.main' : 'error.main',
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
          {channel.provider}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{channel.id}</Typography>
      </Box>
      <Chip
        label={channel.enabled ? 'connected' : 'disconnected'}
        size="small"
        color={channel.enabled ? 'success' : 'default'}
        variant="outlined"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 1 },
        }}
      />
      <IconButton
        size="small"
        onClick={() => onRemove(channel.provider)}
        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
      >
        <Delete sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
}
