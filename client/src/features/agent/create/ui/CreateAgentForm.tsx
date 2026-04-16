import { useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Select,
  MenuItem,
  InputAdornment,
  Divider,
  useTheme,
} from '@mui/material';
import { useCreateAgentMutation } from '../../../../entities/agent';

export interface CreatedAgent {
  slug: string;
  dbId: string;
  interactive: boolean;
}

interface CreateAgentFormProps {
  onCreated: (agent: CreatedAgent) => void;
  onCancel: () => void;
}

export default function CreateAgentForm({ onCreated, onCancel }: CreateAgentFormProps) {
  const { sidebar } = useTheme().palette;
  const [createAgent, { isLoading: isCreating }] = useCreateAgentMutation();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'quick' | 'configure'>('quick');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError('');
    try {
      const interactive = mode === 'configure';
      const saved = await createAgent({ name: trimmed, interactive }).unwrap();
      const slug =
        saved.openclawAgentId ||
        trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setName('');
      onCreated({ slug, dbId: saved._id, interactive });
    } catch (err: unknown) {
      const data = (err as { data?: Record<string, string[]> })?.data;
      const msg =
        data?.name?.[0] || Object.values(data || {}).flat()[0] || 'Failed to create agent';
      setError(msg as string);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <Box sx={{ mb: 1, flexShrink: 0 }}>
      <TextField
        fullWidth
        size="small"
        autoFocus
        placeholder="Agent name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        onKeyDown={handleKeyDown}
        disabled={isCreating}
        error={!!error}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end" sx={{ ml: 0 }}>
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{ mx: 0.5, borderColor: sidebar.border }}
                />
                <Select
                  size="small"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'quick' | 'configure')}
                  variant="standard"
                  disableUnderline
                  sx={{
                    fontSize: '0.7rem',
                    color: sidebar.selectedText,
                    '& .MuiSelect-select': { py: 0, pr: '18px !important', pl: 0.5 },
                    '& .MuiSvgIcon-root': { color: sidebar.text, fontSize: 14, right: 0 },
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: sidebar.background,
                        border: `1px solid ${sidebar.border}`,
                        '& .MuiMenuItem-root': {
                          fontSize: '0.7rem',
                          color: sidebar.text,
                          py: 0.5,
                          '&.Mui-selected': {
                            bgcolor: sidebar.hover,
                            color: sidebar.selectedText,
                          },
                          '&:hover': { bgcolor: sidebar.hover },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="quick">Quick add</MenuItem>
                  <MenuItem value="configure">Configure</MenuItem>
                </Select>
              </InputAdornment>
            ),
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: sidebar.hover,
            borderRadius: 1.5,
            pr: 0.5,
            '& fieldset': { borderColor: error ? 'error.main' : 'transparent' },
            '&:hover fieldset': { borderColor: error ? 'error.main' : sidebar.text },
            '&.Mui-focused fieldset': {
              borderColor: error ? 'error.main' : sidebar.selectedBorder,
            },
            '& input': { color: sidebar.selectedText, fontSize: '0.8rem', py: 0.8, px: 1.5 },
          },
        }}
      />
      {error && (
        <Typography sx={{ color: 'error.main', fontSize: '0.65rem', mx: 0.5, mt: 0.25 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
