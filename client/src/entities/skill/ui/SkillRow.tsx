import { Box, Typography, Chip, Tooltip } from '@mui/material';
import type { SkillInfo } from '../api';

function sourceLabel(source: string, bundled: boolean): string {
  if (bundled) return 'built-in';
  if (source === 'clawhub') return 'clawhub';
  return source;
}

function missingItems(skill: SkillInfo): string[] {
  const items: string[] = [];
  skill.missing.bins.forEach((b) => items.push(`bin: ${b}`));
  skill.missing.anyBins.forEach((b) => items.push(`any-bin: ${b}`));
  skill.missing.env.forEach((e) => items.push(`env: ${e}`));
  skill.missing.config.forEach((c) => items.push(`config: ${c}`));
  skill.missing.os.forEach((o) => items.push(`os: ${o}`));
  return items;
}

export default function SkillRow({ skill }: { skill: SkillInfo }) {
  const missing = missingItems(skill);
  const hasMissing = missing.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        px: 2,
        borderRadius: 1.5,
        opacity: skill.eligible ? 1 : 0.55,
        '&:hover': { bgcolor: 'action.hover', opacity: 1 },
        transition: 'opacity 0.15s',
      }}
    >
      <Typography sx={{ fontSize: '1.1rem', flexShrink: 0, width: 24, textAlign: 'center' }}>
        {skill.emoji || '📦'}
      </Typography>

      <Tooltip
        title={!skill.eligible && hasMissing ? `Missing: ${missing.join(', ')}` : ''}
        arrow
        placement="top"
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            bgcolor: skill.disabled
              ? 'error.main'
              : skill.eligible
                ? 'success.main'
                : 'warning.main',
          }}
        />
      </Tooltip>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {skill.name}
          </Typography>
          {skill.homepage && (
            <Typography
              component="a"
              href={skill.homepage}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                fontSize: '0.65rem',
                color: 'text.secondary',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' },
                flexShrink: 0,
              }}
            >
              ↗
            </Typography>
          )}
        </Box>
        {skill.description && (
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            {skill.description}
          </Typography>
        )}
      </Box>

      {hasMissing && (
        <Tooltip title={missing.join(', ')} arrow placement="top">
          <Chip
            label={`${missing.length} missing`}
            size="small"
            color="warning"
            variant="outlined"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 600,
              '& .MuiChip-label': { px: 1 },
            }}
          />
        </Tooltip>
      )}

      <Chip
        label={sourceLabel(skill.source, skill.bundled)}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.65rem',
          fontWeight: 600,
          '& .MuiChip-label': { px: 1 },
        }}
      />
    </Box>
  );
}
