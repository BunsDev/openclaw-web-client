import { useFormik } from 'formik';
import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import {
  useAddChannelMutation,
  CHANNEL_PROVIDERS,
  CHANNEL_FIELDS,
  type ChannelProvider,
} from '../../entities/channel/api';
import providerEmoji from './providerEmoji';

const inputSx = {
  mb: 1.5,
  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
  '& input': { fontSize: '0.85rem' },
  '& label': { fontSize: '0.85rem' },
};

export default function AddChannelForm({ onDone }: { onDone: () => void }) {
  const [addChannel, { isLoading }] = useAddChannelMutation();
  const [error, setError] = useState('');

  const formik = useFormik({
    initialValues: {
      provider: '' as ChannelProvider | '',
      fields: {} as Record<string, string>,
    },
    onSubmit: async (values) => {
      if (!values.provider) return;
      setError('');
      try {
        await addChannel({ channel: values.provider, ...values.fields }).unwrap();
        onDone();
      } catch (err: unknown) {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setError(msg || 'Failed to add channel');
      }
    },
  });

  const fieldDefs = formik.values.provider
    ? (CHANNEL_FIELDS[formik.values.provider] ?? [])
    : [];

  const hasRequired = fieldDefs
    .filter((f) => f.required)
    .every((f) => formik.values.fields[f.key]?.trim());

  const handleProviderChange = (val: string) => {
    formik.setValues({ provider: val as ChannelProvider, fields: {} });
    setError('');
  };

  const handleFieldChange = (key: string, val: string) => {
    formik.setFieldValue('fields', { ...formik.values.fields, [key]: val });
  };

  return (
    <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1 }}>Add Channel</Typography>
        <IconButton size="small" onClick={onDone}>
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <form onSubmit={formik.handleSubmit}>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>Channel Provider</InputLabel>
          <Select
            value={formik.values.provider}
            label="Channel Provider"
            onChange={(e) => handleProviderChange(e.target.value)}
            sx={{ fontSize: '0.85rem' }}
          >
            {CHANNEL_PROVIDERS.map((p) => (
              <MenuItem key={p} value={p} sx={{ fontSize: '0.85rem' }}>
                {providerEmoji[p] || '📡'} {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {fieldDefs.map((f) => (
          <TextField
            key={f.key}
            fullWidth
            size="small"
            label={f.label}
            type={f.secret ? 'password' : 'text'}
            required={f.required}
            value={formik.values.fields[f.key] || ''}
            onChange={(e) => handleFieldChange(f.key, e.target.value)}
            sx={inputSx}
          />
        ))}

        {error && (
          <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mb: 1 }}>{error}</Typography>
        )}

        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={!formik.values.provider || !hasRequired || isLoading}
          sx={{ textTransform: 'none', fontSize: '0.8rem' }}
        >
          {isLoading ? <CircularProgress size={16} /> : 'Add Channel'}
        </Button>
      </form>
    </Box>
  );
}
