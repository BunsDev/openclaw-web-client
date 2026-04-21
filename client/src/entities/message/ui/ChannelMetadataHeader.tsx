import { Box, Typography } from '@mui/material';
import { ChannelLogo } from '../../channel';
import type {
  ChannelConversationMetadata,
  ChannelSenderMetadata,
} from '../lib/parseChannelMetadata';

interface ChannelMetadataHeaderProps {
  sender: ChannelSenderMetadata | null;
  conversation: ChannelConversationMetadata | null;
}

function guessProvider(
  sender: ChannelSenderMetadata | null,
  conversation: ChannelConversationMetadata | null
): string | null {
  const explicit = (sender as { provider?: string } | null)?.provider;
  if (explicit) return explicit;

  const id = String(sender?.id ?? conversation?.sender_id ?? '');
  if (!id) return null;
  if (/^@[^:]+:[^@]+$/.test(id)) return 'matrix';
  if (/^U[A-Z0-9]{8,}$/.test(id)) return 'slack';
  if (/^\d{17,19}$/.test(id)) return 'discord';
  if (/^\d{8,12}$/.test(id)) return 'telegram';
  return null;
}

export default function ChannelMetadataHeader({
  sender,
  conversation,
}: ChannelMetadataHeaderProps) {
  if (!sender && !conversation) return null;

  const label =
    sender?.label ||
    sender?.name ||
    (typeof conversation?.sender === 'string' ? conversation.sender : null) ||
    (sender?.id ? String(sender.id) : null);

  const provider = guessProvider(sender, conversation);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        mb: 0.5,
        opacity: 0.75,
      }}
    >
      <ChannelLogo provider={provider} size={16} fallback="📡" />
      {label && (
        <Typography
          component="span"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            lineHeight: 1,
            color: 'inherit',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );
}
