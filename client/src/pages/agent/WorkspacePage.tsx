import { useParams } from 'react-router';
import { Workspace } from '../../widgets/workspace';

export default function AgentWorkspacePage() {
  const { agentId } = useParams<{ agentId: string }>();
  if (!agentId) return null;
  return <Workspace agentId={agentId} />;
}
