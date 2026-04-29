import { useMemo, useState, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { ReportProblemOutlined } from '@mui/icons-material';
import {
  useGetAgentLimitsQuery,
  useUpdateAgentLimitsMutation,
  type AgentLimitWindow,
  type AgentLimitWindowState,
} from '../../../../entities/agent';

interface AgentLimitsEditorProps {
  agentId: string;
}

interface WindowMeta {
  id: AgentLimitWindow;
  field: 'costLimitDaily' | 'costLimitMonthly' | 'costLimitTotal';
  label: string;
  caption: (today: string, thisMonth: string) => string;
}

const WINDOWS: WindowMeta[] = [
  {
    id: 'daily',
    field: 'costLimitDaily',
    label: 'Daily cap',
    caption: (today) => `Resets each day · today is ${today}`,
  },
  {
    id: 'monthly',
    field: 'costLimitMonthly',
    label: 'Monthly cap',
    caption: (_, thisMonth) => `Resets on the 1st · current bucket ${thisMonth}`,
  },
  {
    id: 'total',
    field: 'costLimitTotal',
    label: 'All-time cap',
    caption: () => 'Lifetime spend; never resets',
  },
];

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '$0.00';
  if (n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

const compactButtonSx = {
  fontSize: '0.7rem',
  lineHeight: 1.4,
  py: 0.25,
  px: 1,
  minWidth: 'auto',
  textTransform: 'none' as const,
};

/** Map a 0..1+ ratio to a colour bucket. Matches `AgentUsageBar`. */
function ratioColour(state: AgentLimitWindowState): 'secondary' | 'warning' | 'error' | 'primary' {
  if (state.exceeded) return 'error';
  if (state.nearLimit) return 'warning';
  if (state.ratio == null) return 'primary';
  return 'secondary';
}

type DraftState = Record<WindowMeta['field'], string>;

function toDraft(
  stored:
    | Partial<{
        costLimitDaily: number | null;
        costLimitMonthly: number | null;
        costLimitTotal: number | null;
      }>
    | null
    | undefined
): DraftState {
  const s = stored ?? {};
  const fmt = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    costLimitDaily: fmt(s.costLimitDaily),
    costLimitMonthly: fmt(s.costLimitMonthly),
    costLimitTotal: fmt(s.costLimitTotal),
  };
}

function parseDraft(d: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = d.trim();
  if (!trimmed) return { ok: true, value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'Must be a non-negative number' };
  }
  return { ok: true, value: n };
}

export default function AgentLimitsEditor({ agentId }: AgentLimitsEditorProps) {
  const { data, isLoading, isFetching, isError, refetch } = useGetAgentLimitsQuery(agentId, {
    skip: !agentId,
  });
  const [updateLimits, { isLoading: isSaving }] = useUpdateAgentLimitsMutation();

  const [edits, setEdits] = useState<Partial<DraftState>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setEdits({});
  }

  const stored = useMemo(() => toDraft(data?.stored), [data]);
  const draft: DraftState = useMemo(() => ({ ...stored, ...edits }), [stored, edits]);

  const dirty = useMemo(() => {
    if (!data) return false;
    return WINDOWS.some((w) => {
      const storedValue = data.stored?.[w.field] ?? null;
      const parsed = parseDraft(draft[w.field]);
      if (!parsed.ok) return true;
      return parsed.value !== storedValue;
    });
  }, [data, draft]);

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
        Could not load agent limits.
      </Alert>
    );
  }

  const handleChange = (field: WindowMeta['field']) => (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEdits((prev) => ({ ...prev, [field]: value }));
    setErrorMsg(null);
  };

  const handleSave = async () => {
    const patch: Partial<Record<WindowMeta['field'], number | null>> = {};
    const errors: string[] = [];
    WINDOWS.forEach((w) => {
      const parsed = parseDraft(draft[w.field]);
      if (!parsed.ok) {
        errors.push(`${w.label}: ${parsed.error}`);
        return;
      }
      const storedValue = data.stored?.[w.field] ?? null;
      if (parsed.value !== storedValue) {
        patch[w.field] = parsed.value;
      }
    });
    if (errors.length > 0) {
      setErrorMsg(errors.join(' · '));
      return;
    }
    // Nothing to persist — silently no-op (the Save button is also disabled
    // when nothing's dirty, so this branch is mostly defensive).
    if (Object.keys(patch).length === 0) {
      setErrorMsg(null);
      return;
    }
    try {
      await updateLimits({ agentId, patch }).unwrap();
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleReset = () => {
    setEdits({});
    setErrorMsg(null);
  };

  return (
    <Box
      sx={{
        borderRadius: 1,
        p: 1.5,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Spend limits
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Cap this agent's USD spend per window. Leave empty for no limit.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {isFetching && !isSaving && <CircularProgress size={14} />}
          {dirty && (
            <Button size="small" onClick={handleReset} disabled={isSaving} sx={compactButtonSx}>
              Reset
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={handleSave}
            disabled={!dirty || isSaving}
            startIcon={isSaving ? <CircularProgress size={10} color="inherit" /> : null}
            sx={compactButtonSx}
          >
            Save
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          mb: 1.25,
          p: 1,
          borderRadius: 1,
          bgcolor: 'rgba(255, 167, 38, 0.10)',
        }}
      >
        <ReportProblemOutlined sx={{ fontSize: 18, color: 'warning.main', flexShrink: 0 }} />
        <Typography
          variant="caption"
          sx={{
            color: (theme) => (theme.palette.mode === 'dark' ? 'warning.light' : 'warning.dark'),
            lineHeight: 1.4,
            fontSize: '0.75rem',
          }}
        >
          These limits do{' '}
          <Box component="span" sx={{ textDecoration: 'underline' }}>
            not
          </Box>{' '}
          stop the agent or throttle its performance — they're an advisory budget so you can watch
          your preferred spend per window. The agent will keep running even after a cap is reached.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        {WINDOWS.map((w) => {
          const state = data.windows[w.id];
          const colour = ratioColour(state);
          const ratioPct = state.ratio == null ? 0 : Math.min(100, state.ratio * 100);
          return (
            <Box
              key={w.id}
              sx={{
                flex: 1,
                minWidth: 0,
                borderRadius: 1,
                p: 1.25,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    fontWeight: 600,
                  }}
                >
                  {w.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', color: 'text.disabled', fontSize: '0.65rem' }}
                >
                  {w.caption(data.today, data.thisMonth)}
                </Typography>
              </Box>
              <TextField
                size="small"
                type="number"
                placeholder="No limit"
                value={draft[w.field]}
                onChange={handleChange(w.field)}
                disabled={isSaving}
                inputProps={{ min: 0, step: 0.01 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                fullWidth
              />
              <Tooltip
                placement="top"
                title={
                  state.limit == null
                    ? `Spent ${fmtUsd(state.spent)} so far · no cap`
                    : `${fmtUsd(state.spent)} of ${fmtUsd(state.limit)} (${(
                        (state.ratio ?? 0) * 100
                      ).toFixed(1)}%)`
                }
              >
                <Box>
                  <LinearProgress
                    variant="determinate"
                    value={ratioPct}
                    color={colour}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'action.hover',
                      ...(state.limit == null && { opacity: 0.4 }),
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 0.5,
                      display: 'block',
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: '0.7rem',
                      color: state.exceeded
                        ? 'error.main'
                        : state.nearLimit
                          ? 'warning.main'
                          : 'text.secondary',
                    }}
                  >
                    {fmtUsd(state.spent)} spent
                    {state.limit != null && ` / ${fmtUsd(state.limit)}`}
                    {state.ratio != null && ` · ${(state.ratio * 100).toFixed(0)}%`}
                  </Typography>
                </Box>
              </Tooltip>
            </Box>
          );
        })}
      </Stack>

      {errorMsg && (
        <Alert
          severity="error"
          variant="outlined"
          sx={{ mt: 1.25 }}
          onClose={() => setErrorMsg(null)}
        >
          {errorMsg}
        </Alert>
      )}
    </Box>
  );
}
