import { useState } from 'react';
import {
  Box,
  ButtonBase,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { ExpandMore, Check } from '@mui/icons-material';
import {
  useGetAgentModelConfigQuery,
  useUpdateAgentModelConfigMutation,
} from '../../../../entities/agent';

interface AgentModelPickerProps {
  agentId: string;
}

function shortenModel(key: string | null): string {
  if (!key) return 'no model';
  const slash = key.indexOf('/');
  return slash >= 0 ? key.slice(slash + 1) : key;
}

export default function AgentModelPicker({ agentId }: AgentModelPickerProps) {
  const { data, isLoading } = useGetAgentModelConfigQuery(agentId, { skip: !agentId });
  const [update, { isLoading: saving }] = useUpdateAgentModelConfigMutation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (isLoading && !data) {
    return <CircularProgress size={12} sx={{ ml: 0.25 }} />;
  }
  if (!data) return null;

  const effective = data.effective;
  const override = data.override;
  const label = shortenModel(effective);

  async function handlePick(model: string | null) {
    setAnchor(null);
    if (!data?.known) return;
    if ((override ?? null) === (model ?? null)) return;
    try {
      await update({ agentId, model }).unwrap();
    } catch (err) {
      console.error('Agent model update failed:', err);
    }
  }

  const canEdit = data.known && !saving;

  return (
    <>
      <Tooltip
        title={
          data.known
            ? effective
              ? `Model: ${effective}${override ? '' : ' (inherited default)'}`
              : 'Pick a model'
            : 'Agent not in openclaw config'
        }
        placement="bottom-start"
      >
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}
        >
          <ButtonBase
            onClick={(e) => canEdit && setAnchor(e.currentTarget)}
            disabled={!canEdit}
            focusRipple
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.35,
              px: 0.6,
              py: 0.15,
              ml: -0.6,
              borderRadius: 0.75,
              maxWidth: '100%',
              color: 'text.secondary',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.7rem',
              lineHeight: 1.3,
              opacity: data.known ? 1 : 0.6,
              cursor: canEdit ? 'pointer' : 'default',
              '&:hover': canEdit ? { bgcolor: 'action.hover', color: 'text.primary' } : undefined,
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 1,
              },
            }}
          >
            <Box
              component="span"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {label}
            </Box>
            {!override && effective && (
              <Box component="span" sx={{ opacity: 0.55, fontSize: '0.65rem' }}>
                (default)
              </Box>
            )}
            {saving ? (
              <CircularProgress size={10} sx={{ ml: 0.25 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 14, opacity: canEdit ? 0.7 : 0.3 }} />
            )}
          </ButtonBase>
        </Box>
      </Tooltip>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 260, maxWidth: 360 } } }}
      >
        <MenuItem onClick={() => handlePick(null)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
            <Box sx={{ width: 16, flexShrink: 0 }}>
              {override === null && <Check sx={{ fontSize: 16 }} />}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">Inherit default</Typography>
              {data.systemDefault && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.68rem',
                  }}
                >
                  {data.systemDefault}
                </Typography>
              )}
            </Box>
          </Box>
        </MenuItem>
        <Divider />
        {data.available.length === 0 && (
          <MenuItem disabled>
            <Typography variant="caption" color="text.secondary">
              No models configured. Run <code>openclaw models</code>.
            </Typography>
          </MenuItem>
        )}
        {data.available.map((m) => {
          const isActive = override === m.key;
          return (
            <MenuItem key={m.key} selected={isActive} onClick={() => handlePick(m.key)}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                <Box sx={{ width: 16, flexShrink: 0 }}>
                  {isActive && <Check sx={{ fontSize: 16 }} />}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.82rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.key}
                  </Typography>
                  {m.alias && (
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', fontSize: '0.68rem' }}
                    >
                      alias {m.alias}
                    </Typography>
                  )}
                </Box>
              </Box>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
