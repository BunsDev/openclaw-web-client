import { Box } from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import { ModelIcon, modelMappings } from '@lobehub/icons';

interface ProviderLogoProps {
  modelId: string | null | undefined;
  size?: number;
  fallback?: React.ReactNode;
}

function hasKnownModelIcon(modelId: string): boolean {
  const model = modelId.toLowerCase();
  return modelMappings.some((item) =>
    item.keywords.some((keyword) => new RegExp(keyword, 'i').test(model)),
  );
}

export default function ProviderLogo({ modelId, size = 14, fallback }: ProviderLogoProps) {
  const robot = fallback ?? <SmartToy sx={{ fontSize: size }} />;

  if (!modelId?.trim() || !hasKnownModelIcon(modelId)) {
    return <>{robot}</>;
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        lineHeight: 0,
        flexShrink: 0,
        '& svg': { display: 'block' },
      }}
    >
      <ModelIcon model={modelId} size={size} type="color" />
    </Box>
  );
}
