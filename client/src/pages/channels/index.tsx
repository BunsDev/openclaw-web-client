import { useState } from 'react';
import { Box, Typography, CircularProgress, IconButton, Collapse } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useListChannelsQuery, useRemoveChannelMutation } from '../../entities/channel/api';
import ChatRow from '../../widgets/channels/ChatRow';
import AuthRow from '../../widgets/channels/AuthRow';
import AddChannelForm from '../../widgets/channels/AddChannelForm';

export default function ChannelsPage() {
  const { data, isLoading, isFetching } = useListChannelsQuery();
  const [removeChannel] = useRemoveChannelMutation();
  const [showAdd, setShowAdd] = useState(false);
  const [pendingOp, setPendingOp] = useState(false);

  const busy = isLoading || pendingOp || isFetching;

  const chat = data?.chat ?? [];
  const auth = data?.auth ?? [];

  const handleRemove = async (name: string) => {
    setPendingOp(true);
    try {
      await removeChannel({ name }).unwrap();
    } catch {
      /* handled by RTK */
    } finally {
      setPendingOp(false);
    }
  };

  const handleAdded = () => {
    setShowAdd(false);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          Channels
        </Typography>
        {!busy && (
          <Typography variant="body2" color="text.secondary">
            {chat.length} chat · {auth.length} auth
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={() => setShowAdd((prev) => !prev)}
          sx={{
            bgcolor: showAdd ? 'primary.main' : 'action.hover',
            color: showAdd ? 'primary.contrastText' : 'text.primary',
            '&:hover': { bgcolor: showAdd ? 'primary.dark' : 'action.selected' },
          }}
        >
          <Add sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Collapse in={showAdd}>
        <AddChannelForm onDone={handleAdded} />
      </Collapse>

      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          {chat.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography
                variant="overline"
                sx={{ px: 2, color: 'text.secondary', fontWeight: 700 }}
              >
                Chat Channels
              </Typography>
              {chat.map((c) => (
                <ChatRow key={c.id} channel={c} onRemove={handleRemove} />
              ))}
            </Box>
          )}

          {auth.length > 0 && (
            <Box>
              <Typography
                variant="overline"
                sx={{ px: 2, color: 'text.secondary', fontWeight: 700 }}
              >
                Auth Profiles
              </Typography>
              {auth.map((a) => (
                <AuthRow key={a.id} profile={a} />
              ))}
            </Box>
          )}

          {chat.length === 0 && auth.length === 0 && (
            <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              No channels configured
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
