import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import { SkillRow, useListSkillsQuery } from '../../entities/skill';

type SkillFilter = 'all' | 'eligible' | 'missing';

export default function SkillsPanel() {
  const { data: skills, isLoading } = useListSkillsQuery();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SkillFilter>('all');

  const all = useMemo(() => skills ?? [], [skills]);
  const filtered = useMemo(() => {
    return all.filter((s) => {
      if (filter === 'eligible' && !s.eligible) return false;
      if (filter === 'missing' && s.eligible) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [all, filter, search]);

  const eligibleCount = useMemo(() => all.filter((s) => s.eligible).length, [all]);

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
