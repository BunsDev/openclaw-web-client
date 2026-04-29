import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Search } from '@mui/icons-material';
import {
  useGetAgentSkillsQuery,
  useUpdateAgentSkillsMutation,
  type AgentSkillSummary,
} from '../../../../entities/agent';

interface AgentSkillsProps {
  agentId: string;
}

function skillEmoji(s: AgentSkillSummary): string {
  return s.emoji || '🧩';
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted1 = [...a].sort();
  const sorted2 = [...b].sort();
  return sorted1.every((x, i) => x === sorted2[i]);
}

export default function AgentSkills({ agentId }: AgentSkillsProps) {
  const { data, isLoading, isError, refetch } = useGetAgentSkillsQuery(agentId, {
    skip: !agentId,
  });
  const [update, { isLoading: saving, error: saveError }] = useUpdateAgentSkillsMutation();

  const [inherit, setInherit] = useState(true);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      if (data.override === null) {
        setInherit(true);
        setEnabled(new Set());
      } else {
        setInherit(false);
        setEnabled(new Set(data.override));
      }
    }
  }

  const filtered = useMemo(() => {
    const skills = data?.available ?? [];
    if (!query.trim()) return skills;
    const q = query.trim().toLowerCase();
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [data, query]);

  const dirty = useMemo(() => {
    if (!data) return false;
    if (inherit) return data.override !== null;
    if (data.override === null) return true;
    return !sameSet(data.override, [...enabled]);
  }, [data, inherit, enabled]);

  function toggleSkill(name: string, on: boolean) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  function enableAll() {
    setEnabled(new Set((data?.available ?? []).map((s) => s.name)));
  }

  function disableAll() {
    setEnabled(new Set());
  }

  async function handleSave() {
    try {
      await update({
        agentId,
        skills: inherit ? null : [...enabled],
      }).unwrap();
    } catch (err) {
      console.error('Save agent skills failed:', err);
    }
  }

  function handleReset() {
    if (!data) return;
    if (data.override === null) {
      setInherit(true);
      setEnabled(new Set());
    } else {
      setInherit(false);
      setEnabled(new Set(data.override));
    }
  }

  if (isLoading && !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Alert
        severity="error"
        action={
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      >
        Could not load agent skills.
      </Alert>
    );
  }

  const rpcError =
    saveError && typeof saveError === 'object' && 'data' in saveError
      ? ((saveError as { data?: { error?: string } }).data?.error ?? 'Failed to save skills.')
      : null;

  const disabled = inherit || !data.known || saving;
  const activeCount = enabled.size;
  const totalCount = data.available.length;

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Skills allowlist
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pick which skills this agent is allowed to use. Inherit to follow system defaults. An
            explicit list replaces the defaults rather than merging.
          </Typography>
        </Box>
        {!data.known && (
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label="Agent missing from openclaw config"
          />
        )}
      </Stack>

      {rpcError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {rpcError}
        </Alert>
      )}

      <Box
        sx={{
          borderRadius: 1,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <FormControlLabel
            control={
              <Switch
                checked={inherit}
                onChange={(_, v) => setInherit(v)}
                disabled={!data.known || saving}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Inherit defaults
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  When off, only the skills you toggle on below are allowed.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', m: 0 }}
          />
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <TextField
            size="small"
            placeholder="Search skills…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
              px: { xs: 0, sm: 1 },
            }}
          >
            {inherit ? 'inherit' : `${activeCount} / ${totalCount} on`}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Button size="small" onClick={enableAll} disabled={disabled}>
              All
            </Button>
            <Button size="small" onClick={disableAll} disabled={disabled}>
              None
            </Button>
          </Stack>
        </Stack>

        <List dense disablePadding sx={{ maxHeight: 520, overflow: 'auto' }}>
          {filtered.length === 0 && (
            <ListItem>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.secondary">
                    No skills match.
                  </Typography>
                }
              />
            </ListItem>
          )}
          {filtered.map((s) => {
            const on = enabled.has(s.name);
            return (
              <ListItem
                key={s.name}
                divider
                sx={{
                  alignItems: 'flex-start',
                  py: 1,
                  opacity: disabled ? 0.55 : 1,
                }}
                secondaryAction={
                  <Switch
                    edge="end"
                    size="small"
                    checked={on}
                    onChange={(_, v) => toggleSkill(s.name, v)}
                    disabled={disabled}
                    inputProps={{ 'aria-label': `Toggle ${s.name}` }}
                  />
                }
              >
                <Box sx={{ fontSize: '1.15rem', lineHeight: 1.2, pr: 1, pt: 0.25 }}>
                  {skillEmoji(s)}
                </Box>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      <Typography variant="body2" fontWeight={600}>
                        {s.name}
                      </Typography>
                      {!s.eligible && (
                        <Tooltip title="Skill is not eligible on this host (missing deps).">
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="ineligible"
                            sx={{
                              height: 18,
                              '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' },
                            }}
                          />
                        </Tooltip>
                      )}
                      {s.bundled && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label="bundled"
                          sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.65rem' } }}
                        />
                      )}
                    </Stack>
                  }
                  secondary={
                    s.description ? (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {s.description}
                      </Typography>
                    ) : null
                  }
                  sx={{ my: 0, pr: 4 }}
                />
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
        <Button size="small" onClick={handleReset} disabled={!dirty || saving}>
          Reset
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={!dirty || saving || !data.known}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Stack>
    </Box>
  );
}
