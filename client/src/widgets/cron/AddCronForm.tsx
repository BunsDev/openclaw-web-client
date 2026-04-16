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
  Autocomplete,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useAddCronJobMutation } from '../../entities/cron/api';
import { useGetAgentsQuery } from '../../entities/agent/api';
import { useGetConversationsQuery } from '../../entities/conversation/api';

type ScheduleKind = 'cron' | 'every' | 'at';

const SCHEDULE_KINDS: { value: ScheduleKind; label: string }[] = [
  { value: 'cron', label: 'Cron Expression' },
  { value: 'every', label: 'Every (interval)' },
  { value: 'at', label: 'At (one-shot)' },
];

const COMMON_TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Berlin',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney',
    ];

const inputSx = {
  mb: 1.5,
  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
  '& input': { fontSize: '0.85rem' },
  '& label': { fontSize: '0.85rem' },
  '& textarea': { fontSize: '0.85rem' },
};

interface CronFormValues {
  name: string;
  scheduleKind: ScheduleKind;
  scheduleValue: string;
  atDatetime: string;
  message: string;
  agent: string;
  session: string;
  tz: string;
}

const initialValues: CronFormValues = {
  name: '',
  scheduleKind: 'cron',
  scheduleValue: '',
  atDatetime: '',
  message: '',
  agent: '',
  session: 'isolated',
  tz: '',
};

export default function AddCronForm({ onDone }: { onDone: () => void }) {
  const [addCron, { isLoading }] = useAddCronJobMutation();
  const { data: agentsData } = useGetAgentsQuery();
  const [error, setError] = useState('');

  const formik = useFormik<CronFormValues>({
    initialValues,
    onSubmit: async (values) => {
      setError('');
      const opts: Record<string, string> = {};
      if (values.name) opts.name = values.name;
      if (values.message) opts.message = values.message;
      if (values.agent) opts.agent = values.agent;
      if (values.session === 'main' || values.session === 'isolated') {
        opts.session = values.session;
      } else if (values.session) {
        opts['session-key'] = values.session;
        opts.session = `session:${values.session}`;
      }
      if (values.tz) opts.tz = values.tz;

      if (values.scheduleKind === 'at') {
        if (!values.atDatetime) return;
        opts.at = new Date(values.atDatetime).toISOString();
      } else {
        if (!values.scheduleValue.trim()) return;
        opts[values.scheduleKind] = values.scheduleValue;
      }

      try {
        await addCron(opts).unwrap();
        onDone();
      } catch (err: unknown) {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setError(msg || 'Failed to add cron job');
      }
    },
  });

  const agents = agentsData?.items ?? [];
  const selectedAgent = agents.find((a) => (a.openclawAgentId || a.name) === formik.values.agent);
  const { data: convData } = useGetConversationsQuery(selectedAgent?._id ?? '', {
    skip: !selectedAgent,
  });
  const conversations = convData?.items ?? [];

  const hasSchedule =
    formik.values.scheduleKind === 'at'
      ? !!formik.values.atDatetime
      : !!formik.values.scheduleValue.trim();
  const canSubmit = hasSchedule && (formik.values.name.trim() || formik.values.message.trim());

  return (
    <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1 }}>
          Add Cron Job
        </Typography>
        <IconButton size="small" onClick={onDone}>
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <form onSubmit={formik.handleSubmit}>
        <TextField
          fullWidth
          size="small"
          label="Job Name"
          {...formik.getFieldProps('name')}
          sx={inputSx}
        />

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>Schedule Type</InputLabel>
          <Select
            value={formik.values.scheduleKind}
            label="Schedule Type"
            onChange={(e) => {
              const kind = e.target.value as ScheduleKind;
              formik.setFieldValue('scheduleKind', kind);
              if (kind === 'every') formik.setFieldValue('tz', '');
            }}
            sx={{ fontSize: '0.85rem' }}
          >
            {SCHEDULE_KINDS.map((s) => (
              <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.85rem' }}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {formik.values.scheduleKind === 'at' ? (
          <TextField
            fullWidth
            size="small"
            type="datetime-local"
            label="Run At"
            {...formik.getFieldProps('atDatetime')}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={inputSx}
          />
        ) : (
          <TextField
            fullWidth
            size="small"
            label={
              formik.values.scheduleKind === 'cron'
                ? 'Cron Expression (e.g. 0 */6 * * *)'
                : 'Interval (e.g. 30m, 2h)'
            }
            {...formik.getFieldProps('scheduleValue')}
            sx={inputSx}
          />
        )}

        <TextField
          fullWidth
          size="small"
          label="Message (agent prompt)"
          multiline
          minRows={2}
          maxRows={4}
          {...formik.getFieldProps('message')}
          sx={inputSx}
        />

        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '0.85rem' }}>Agent (optional)</InputLabel>
            <Select
              value={formik.values.agent}
              label="Agent (optional)"
              onChange={(e) => {
                formik.setFieldValue('agent', e.target.value);
                formik.setFieldValue('session', 'isolated');
              }}
              sx={{ fontSize: '0.85rem', borderRadius: 1.5 }}
            >
              <MenuItem value="" sx={{ fontSize: '0.85rem' }}>
                <em>None</em>
              </MenuItem>
              {agents.map((a) => (
                <MenuItem
                  key={a._id}
                  value={a.openclawAgentId || a.name}
                  sx={{ fontSize: '0.85rem' }}
                >
                  {a.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {formik.values.scheduleKind !== 'every' && (
            <Autocomplete
              fullWidth
              size="small"
              freeSolo
              options={COMMON_TIMEZONES}
              value={formik.values.tz || null}
              onChange={(_e, val) => formik.setFieldValue('tz', val || '')}
              onInputChange={(_e, val) => formik.setFieldValue('tz', val || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Timezone (optional)"
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                    '& input': { fontSize: '0.85rem' },
                    '& label': { fontSize: '0.85rem' },
                  }}
                />
              )}
            />
          )}
        </Box>

        {formik.values.agent && (
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel sx={{ fontSize: '0.85rem' }}>Session</InputLabel>
            <Select
              value={formik.values.session}
              label="Session"
              onChange={(e) => formik.setFieldValue('session', e.target.value)}
              sx={{ fontSize: '0.85rem', borderRadius: 1.5 }}
            >
              <MenuItem value="isolated" sx={{ fontSize: '0.85rem' }}>
                Isolated (new session)
              </MenuItem>
              <MenuItem value="main" sx={{ fontSize: '0.85rem' }}>Main session</MenuItem>
              {conversations
                .filter((c) => c.sessionKey)
                .map((c) => (
                  <MenuItem
                    key={c._id}
                    value={`agent:${formik.values.agent}:${c.sessionKey}`}
                    sx={{ fontSize: '0.85rem' }}
                  >
                    {c.title || `Session ${c.sessionKey}`}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        )}

        {error && (
          <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mb: 1 }}>{error}</Typography>
        )}

        <Button
          type="submit"
          variant="contained"
          size="small"
          disabled={!canSubmit || isLoading}
          sx={{ textTransform: 'none', fontSize: '0.8rem' }}
        >
          {isLoading ? <CircularProgress size={16} /> : 'Add Job'}
        </Button>
      </form>
    </Box>
  );
}
