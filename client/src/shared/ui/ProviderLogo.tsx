import { Box } from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import { ModelIcon, ModelProvider, ProviderIcon, modelMappings } from '@lobehub/icons';

interface ProviderLogoProps {
  modelId: string | null | undefined;
  size?: number;
  fallback?: React.ReactNode;
}

function getProvider(modelId: string | null | undefined): string {
  if (!modelId) return '';
  const slash = modelId.indexOf('/');
  return slash > 0 ? modelId.slice(0, slash) : '';
}

/**
 * ModelIcon matches "llama" (Meta) inside "ollama/..." — use ProviderIcon for ollama instead.
 */
function hasKnownModelIcon(modelId: string): boolean {
  const provider = getProvider(modelId);
  if (provider === 'ollama') return true;

  const model = modelId.toLowerCase();
  return modelMappings.some((item) =>
    item.keywords.some((keyword) => new RegExp(keyword, 'i').test(model))
  );
}

export default function ProviderLogo({ modelId, size = 14, fallback }: ProviderLogoProps) {
  const robot = fallback ?? <SmartToy sx={{ fontSize: size }} />;

  if (!modelId?.trim() || !hasKnownModelIcon(modelId)) {
    return <>{robot}</>;
  }

  const provider = getProvider(modelId);

  const boxSx = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    lineHeight: 0,
    flexShrink: 0,
    '& svg': { display: 'block' },
  };

  if (provider === 'ollama') {
    return (
      <Box sx={boxSx}>
        <ProviderIcon provider={ModelProvider.Ollama} size={size} type="color" />
      </Box>
    );
  }

  return (
    <Box sx={boxSx}>
      <ModelIcon model={modelId} size={size} type="color" />
    </Box>
  );
}
