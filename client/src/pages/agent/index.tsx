import { useState } from 'react';
import { useParams } from 'react-router';
import { Box, Typography } from '@mui/material';
import useChat from '../../features/chat/useChat';
import ChatHeader from '../../widgets/chat/ChatHeader';
import SessionSettingsBar from '../../widgets/chat/SessionSettingsBar';
import MessageList from '../../widgets/chat/MessageList';
import ChatInput from '../../widgets/chat/ChatInput';

export default function AgentChat() {
  const { agentId, conversationId } = useParams<{ agentId: string; conversationId: string }>();
  const [showSessionSettings, setShowSessionSettings] = useState(false);
  const chat = useChat(conversationId);

  if (!conversationId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">Select a conversation to start chatting</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: {
          xs: '100vh',
          md: 'calc(100vh - 48px)',
        },
        minWidth: 0,
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      {agentId && (
        <ChatHeader
          agentId={agentId}
          conversationId={conversationId}
          showSessionSettings={showSessionSettings}
          onToggleSessionSettings={() => setShowSessionSettings((v) => !v)}
        />
      )}
      {showSessionSettings && agentId && (
        <SessionSettingsBar agentId={agentId} conversationId={conversationId} />
      )}
      <MessageList chat={chat} />
      <ChatInput onSend={chat.send} isStreaming={chat.isStreaming} />
    </Box>
  );
}
