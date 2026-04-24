import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import {
  useGetAgentModelConfigQuery,
  useUpdateAgentModelConfigMutation,
} from '../../../../entities/agent';

interface AgentModelConfigProps {
  agentId: string;
}

const INHERIT_VALUE = '__inherit__';

export default function AgentModelConfig({ agentId }: AgentModelConfigProps) {
  const { data, isLoading, isError, refetch } = useGetAgentModelConfigQuery(agentId, {
    skip: !agentId,
  });
  const [update, { isLoading: saving, error: saveError }] = useUpdateAgentModelConfigMutation();

  const [selection, setSelection] = useState<string>(INHERIT_VALUE);
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    if (data) setSelection(data.override ?? INHERIT_VALUE);
  }

  const dirty = data ? selection !== (data.override ?? INHERIT_VALUE) : false;

  async function handleSave() {
    try {
      await update({
        agentId,
        model: selection === INHERIT_VALUE ? null : selection,
      }).unwrap();
    } catch (err) {
      console.error('Save agent model failed:', err);
    }
  }

  function handleReset() {
    if (!data) return;
    setSelection(data.override ?? INHERIT_VALUE);
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
        Could not load agent model configuration.
      </Alert>
    );
  }

  const rpcError =
    saveError && typeof saveError === 'object' && 'data' in saveError
      ? ((saveError as { data?: { error?: string } }).data?.error ?? 'Failed to save model.')
      : null;

  const systemDefaultLabel = data.systemDefault ?? 'unset';

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
            Model
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Override the primary model for this agent. Leave as "Inherit default" to use the system
            default.
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
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          bgcolor: 'background.paper',
        }}
      >
        <Stack spacing={1.25}>
          <FormControl fullWidth size="small" disabled={!data.known}>
            <InputLabel id="agent-model-select-label">Primary model</InputLabel>
            <Select
              labelId="agent-model-select-label"
              label="Primary model"
              value={selection}
              onChange={(e) => setSelection(String(e.target.value))}
            >
              <MenuItem value={INHERIT_VALUE}>
                <Box component="span">
                  Inherit default{' '}
                  <Box
                    component="span"
                    sx={{
                      color: 'text.secondary',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.72rem',
                    }}
                  >
                    ({systemDefaultLabel})
                  </Box>
                </Box>
              </MenuItem>
              {data.available.length === 0 && (
                <MenuItem value="" disabled>
                  No models configured — add via <code>openclaw models</code>
                </MenuItem>
              )}
              {data.available.map((m) => (
                <MenuItem key={m.key} value={m.key}>
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '0.8rem',
                      }}
                    >
                      {m.key}
                    </Box>
                    {m.alias && (
                      <Box
                        component="span"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.72rem',
                        }}
                      >
                        alias {m.alias}
                      </Box>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.7rem',
            }}
          >
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
              effective {data.effective ?? '—'}
            </Box>
            <Box component="span" sx={{ opacity: 0.55, mx: 0.75 }}>
              ·
            </Box>
            system default {systemDefaultLabel}
          </Typography>
        </Stack>
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
