import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
} from '@mui/material';
import { RestartAlt } from '@mui/icons-material';
import {
  useGetAgentBudgetQuery,
  useUpdateAgentBudgetMutation,
  type AgentBudgetField,
  type AgentBudgetKey,
  type AgentBudgetPatch,
} from '../../../../entities/agent';

interface AgentBudgetsProps {
  agentId: string;
}

type DraftMap = Partial<Record<AgentBudgetKey, string>>;

function formatPlaceholder(field: AgentBudgetField): string {
  if (field.default != null) return `default ${field.default.toLocaleString()}`;
  return 'inherits default';
}

function parseDraft(value: string | undefined): number | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return undefined;
  return num;
}

export default function AgentBudgets({ agentId }: AgentBudgetsProps) {
  const { data, isLoading, isError, refetch } = useGetAgentBudgetQuery(agentId, { skip: !agentId });
  const [update, { isLoading: saving, error: saveError }] = useUpdateAgentBudgetMutation();

  const [drafts, setDrafts] = useState<DraftMap>({});
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AgentBudgetKey, string>>>({});
  // Reseed drafts whenever the server-provided data identity changes. Done
  // during render (the React-recommended alternative to a sync setState inside
  // useEffect) so we skip an extra commit cycle.
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) {
      const next: DraftMap = {};
      data.fields.forEach((f) => {
        next[f.key] = f.override == null ? '' : String(f.override);
      });
      setDrafts(next);
      setFieldErrors({});
    }
  }

  const patch = useMemo<AgentBudgetPatch>(() => {
    if (!data) return {};
    const result: AgentBudgetPatch = {};
    data.fields.forEach((f) => {
      const current = f.override == null ? '' : String(f.override);
      const draft = drafts[f.key] ?? '';
      if (draft === current) return;
      const parsed = parseDraft(draft);
      if (parsed === undefined) return;
      result[f.key] = parsed;
    });
    return result;
  }, [data, drafts]);

  const dirty = Object.keys(patch).length > 0;

  function validate(): boolean {
    if (!data) return false;
    const errs: Partial<Record<AgentBudgetKey, string>> = {};
    data.fields.forEach((f) => {
      const draft = drafts[f.key] ?? '';
      if (draft.trim() === '') return;
      const parsed = parseDraft(draft);
      if (parsed === undefined || parsed === null) {
        errs[f.key] = 'Must be an integer.';
        return;
      }
      if (parsed < f.min) errs[f.key] = `Must be ≥ ${f.min.toLocaleString()}.`;
      else if (parsed > f.max && f.max < Number.MAX_SAFE_INTEGER)
        errs[f.key] = `Must be ≤ ${f.max.toLocaleString()}.`;
    });
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    if (!dirty) return;
    try {
      await update({ agentId, patch }).unwrap();
    } catch (err) {
      console.error('Save agent budgets failed:', err);
    }
  }

  function handleReset() {
    if (!data) return;
    const next: DraftMap = {};
    data.fields.forEach((f) => {
      next[f.key] = f.override == null ? '' : String(f.override);
    });
    setDrafts(next);
    setFieldErrors({});
  }

  function handleResetField(key: AgentBudgetKey) {
    setDrafts((prev) => ({ ...prev, [key]: '' }));
    setFieldErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
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
        Could not load agent budgets.
      </Alert>
    );
  }

  const rpcError =
    saveError && typeof saveError === 'object' && 'data' in saveError
      ? ((saveError as { data?: { error?: string } }).data?.error ?? 'Failed to save budgets.')
      : null;

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
            Per-agent budgets
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Character budgets that bound injected context and tool output for this agent. Leave a
            field empty to inherit the system default.
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

      <Stack spacing={1.25}>
        {data.fields.map((field) => {
          const draft = drafts[field.key] ?? '';
          const hasOverride = draft.trim() !== '';
          const err = fieldErrors[field.key];
          return (
            <Box
              key={field.key}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.25,
                bgcolor: 'background.paper',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                spacing={1.25}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 1,
                      flexWrap: 'wrap',
                      rowGap: 0,
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {field.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.7rem',
                      }}
                    >
                      {field.effective != null && (
                        <>
                          <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                            {field.effective.toLocaleString()}
                          </Box>
                          <Box component="span" sx={{ opacity: 0.55, mx: 0.75 }}>
                            ·
                          </Box>
                        </>
                      )}
                      {field.default != null && (
                        <>
                          default {field.default.toLocaleString()}
                          <Box component="span" sx={{ opacity: 0.55, mx: 0.75 }}>
                            ·
                          </Box>
                        </>
                      )}
                      range {field.min.toLocaleString()}
                      {field.max < Number.MAX_SAFE_INTEGER ? `–${field.max.toLocaleString()}` : '+'}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25 }}
                  >
                    {field.description}
                  </Typography>
                </Box>

                <TextField
                  size="small"
                  type="number"
                  value={draft}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDrafts((prev) => ({ ...prev, [field.key]: v }));
                    setFieldErrors((prev) =>
                      Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field.key))
                    );
                  }}
                  placeholder={formatPlaceholder(field)}
                  error={Boolean(err)}
                  helperText={err}
                  slotProps={{
                    input: {
                      endAdornment: hasOverride ? (
                        <InputAdornment position="end">
                          <Tooltip title="Clear override (use default)">
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() => handleResetField(field.key)}
                              aria-label={`Reset ${field.key} to default`}
                            >
                              <RestartAlt fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ) : null,
                    },
                    htmlInput: {
                      min: field.min,
                      max: field.max < Number.MAX_SAFE_INTEGER ? field.max : undefined,
                      step: 1,
                      inputMode: 'numeric',
                    },
                  }}
                  sx={{ width: { xs: '100%', sm: 220 } }}
                />
              </Stack>
            </Box>
          );
        })}
      </Stack>

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
