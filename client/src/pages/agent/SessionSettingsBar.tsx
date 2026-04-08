import { memo, useCallback } from 'react';
import { Box, Typography, Select, MenuItem, type SelectChangeEvent } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useGetSessionSettingsQuery, usePatchSessionSettingsMutation } from '../../app/store';

const THINKING_OPTIONS = ['inherit', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
const FAST_OPTIONS = [
  { value: 'inherit', label: 'inherit' },
  { value: 'true', label: 'on' },
  { value: 'false', label: 'off' },
] as const;
const VERBOSE_OPTIONS = [
  { value: 'inherit', label: 'inherit' },
  { value: 'off', label: 'off (explicit)' },
  { value: 'on', label: 'on' },
  { value: 'full', label: 'full' },
] as const;
const REASONING_OPTIONS = ['inherit', 'off', 'on', 'stream'] as const;

function SettingChip({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly (string | { value: string; label: string })[];
  onChange: (v: string) => void;
}) {
  const isActive = value !== 'inherit';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : 'divider',
        bgcolor: (t) => isActive ? alpha(t.palette.primary.main, 0.06) : 'transparent',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: isActive ? 'primary.main' : 'text.disabled',
          pl: 1,
          pr: 0.3,
          whiteSpace: 'nowrap',
          userSelect: 'none',
        }}
      >
        {label}
      </Typography>
      <Select
        size="small"
        value={value}
        onChange={(e: SelectChangeEvent) => onChange(e.target.value)}
        variant="standard"
        disableUnderline
        sx={{
          fontSize: '0.72rem',
          fontWeight: 500,
          color: isActive ? 'text.primary' : 'text.secondary',
          minWidth: 40,
          '& .MuiSelect-select': {
            py: '2px',
            pl: '2px',
            pr: '18px !important',
          },
          '& .MuiSvgIcon-root': { fontSize: 14, right: 2, color: 'text.disabled' },
        }}
      >
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <MenuItem
              key={val}
              value={val}
              sx={{ fontSize: '0.75rem', minHeight: 28 }}
            >
              {lbl}
            </MenuItem>
          );
        })}
      </Select>
    </Box>
  );
}

interface SessionSettingsBarProps {
  agentId: string;
  conversationId: string;
}

const SessionSettingsBar = memo(function SessionSettingsBar({ agentId, conversationId }: SessionSettingsBarProps) {
  const { data } = useGetSessionSettingsQuery({ agentId, conversationId }, { skip: !agentId || !conversationId });
  const [patchSettings] = usePatchSessionSettingsMutation();
  const settings = data?.settings;

  const handleChange = useCallback((field: string, value: string) => {
    const body: Record<string, unknown> = {};
    if (field === 'fastMode') {
      body[field] = value === 'inherit' ? null : value === 'true';
    } else {
      body[field] = value;
    }
    patchSettings({ agentId, conversationId, settings: body });
  }, [agentId, conversationId, patchSettings]);

  const thinking = settings?.thinkingLevel || 'inherit';
  const fast = settings?.fastMode === true ? 'true' : settings?.fastMode === false ? 'false' : 'inherit';
  const verbose = settings?.verboseLevel || 'inherit';
  const reasoning = settings?.reasoningLevel || 'inherit';

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: 0.75,
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        flexWrap: 'wrap',
      }}
    >
      <SettingChip
        label="Thinking"
        value={thinking}
        options={THINKING_OPTIONS}
        onChange={(v) => handleChange('thinkingLevel', v)}
      />
      <SettingChip
        label="Fast"
        value={fast}
        options={FAST_OPTIONS}
        onChange={(v) => handleChange('fastMode', v)}
      />
      <SettingChip
        label="Verbose"
        value={verbose}
        options={VERBOSE_OPTIONS}
        onChange={(v) => handleChange('verboseLevel', v)}
      />
      <SettingChip
        label="Reasoning"
        value={reasoning}
        options={REASONING_OPTIONS}
        onChange={(v) => handleChange('reasoningLevel', v)}
      />
    </Box>
  );
});

export default SessionSettingsBar;
