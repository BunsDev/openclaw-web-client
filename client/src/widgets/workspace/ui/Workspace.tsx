import { useState, type ReactElement } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Box, IconButton, Typography, CircularProgress, Tab, Tabs } from '@mui/material';
import { ArrowBack, Extension, FolderOpen, Group, Tune } from '@mui/icons-material';
import { useGetAgentQuery } from '../../../entities/agent';
import { AgentBudgets } from '../../../features/agent/budgets';
import { AgentSkills } from '../../../features/agent/skills';
import { AgentSubagents } from '../../../features/agent/subagents';
import WorkspaceFileTabs from './WorkspaceFileTabs';

interface WorkspaceProps {
  agentId: string;
}

type SectionId = 'files' | 'budgets' | 'skills' | 'subagents';

const SECTIONS: { id: SectionId; label: string; icon: ReactElement; caption: string }[] = [
  {
    id: 'files',
    label: 'Workspace',
    icon: <FolderOpen sx={{ fontSize: 18 }} />,
    caption: 'Workspace files',
  },
  {
    id: 'budgets',
    label: 'Budgets',
    icon: <Tune sx={{ fontSize: 18 }} />,
    caption: 'Per-agent character budgets',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: <Extension sx={{ fontSize: 18 }} />,
    caption: 'Per-agent skill allowlist',
  },
  {
    id: 'subagents',
    label: 'Subagents',
    icon: <Group sx={{ fontSize: 18 }} />,
    caption: 'Child-agent defaults',
  },
];

export default function Workspace({ agentId }: WorkspaceProps) {
  const [searchParams] = useSearchParams();
  const returnConv = searchParams.get('return');
  const { data: agent, isLoading } = useGetAgentQuery(agentId, { skip: !agentId });
  const [section, setSection] = useState<SectionId>('files');

  const backHref = returnConv ? `/agent/${agentId}/chat/${returnConv}` : '/';
  const activeCaption = SECTIONS.find((s) => s.id === section)?.caption ?? '';

  if (isLoading && !agent) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}
      >
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
            {activeCaption}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
          px: { xs: 1, md: 2 },
        }}
      >
        <Tabs
          value={section}
          onChange={(_, v: SectionId) => setSection(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.82rem',
              px: 1.5,
            },
          }}
        >
          {SECTIONS.map((s) => (
            <Tab key={s.id} value={s.id} iconPosition="start" icon={s.icon} label={s.label} />
          ))}
        </Tabs>
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
        {section === 'files' && <WorkspaceFileTabs agentId={agentId} />}
        {section === 'budgets' && agent?._id && <AgentBudgets agentId={String(agent._id)} />}
        {section === 'skills' && agent?._id && <AgentSkills agentId={String(agent._id)} />}
        {section === 'subagents' && agent?._id && <AgentSubagents agentId={String(agent._id)} />}
      </Box>
    </Box>
  );
}
