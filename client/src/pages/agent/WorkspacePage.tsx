import { Link, useParams, useSearchParams } from 'react-router';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useGetAgentQuery } from '../../app/store';
import WorkspaceFileTabs from './WorkspaceFileTabs';

export default function AgentWorkspacePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [searchParams] = useSearchParams();
  const returnConv = searchParams.get('return');
  const { data: agent, isLoading } = useGetAgentQuery(agentId!, { skip: !agentId });

  const backHref =
    agentId && returnConv
      ? `/agent/${agentId}/chat/${returnConv}`
      : '/';

  if (!agentId) {
    return null;
  }

  if (isLoading && !agent) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: { xs: '100vh', md: 'calc(100vh - 48px)' },
        minWidth: 0,
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 1.5,
          pl: { xs: 7, md: 2 },
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minWidth: 0,
        }}
      >
        <IconButton
          component={Link}
          to={backHref}
          size="small"
          aria-label="Back"
          sx={{ flexShrink: 0 }}
        >
          <ArrowBack sx={{ fontSize: 22 }} />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" fontWeight={600} noWrap>
            {agent?.name ?? 'Agent'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Workspace files
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          px: { xs: 2, md: 3 },
          py: 2,
        }}
      >
        <WorkspaceFileTabs agentId={agentId} />
      </Box>
    </Box>
  );
}
