import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  CircularProgress,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { useListSkillsQuery, type SkillInfo } from '../../entities/skill/api';

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

function SkillRow({ skill }: { skill: SkillInfo }) {
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

export default function SkillsPage() {
  const { data: skills, isLoading } = useListSkillsQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'eligible' | 'missing'>('all');

  const all = skills ?? [];
  const filtered = all.filter((s) => {
    if (filter === 'eligible' && !s.eligible) return false;
    if (filter === 'missing' && s.eligible) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
  });

  const eligibleCount = all.filter((s) => s.eligible).length;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          Skills
        </Typography>
        {!isLoading && (
          <Typography variant="body2" color="text.secondary">
            {eligibleCount} of {all.length} eligible
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5,
              '& input': { fontSize: '0.85rem', py: 1 },
            },
          }}
        />
        {(['all', 'eligible', 'missing'] as const).map((f) => (
          <Chip
            key={f}
            label={f}
            size="small"
            variant="filled"
            onClick={() => setFilter(f)}
            sx={{
              height: 32,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'capitalize',
              bgcolor: filter === f ? 'primary.main' : 'transparent',
              color: filter === f ? 'primary.contrastText' : 'text.secondary',
              '&:hover': {
                bgcolor: filter === f ? 'primary.dark' : 'action.hover',
              },
            }}
          />
        ))}
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box>
          {filtered.map((s) => (
            <SkillRow key={s.name} skill={s} />
          ))}
          {filtered.length === 0 && (
            <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              {search ? 'No skills match your search' : 'No skills found'}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
