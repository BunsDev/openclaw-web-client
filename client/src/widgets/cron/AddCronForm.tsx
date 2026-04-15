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

export default function AddCronForm({ onDone }: { onDone: () => void }) {
  const [addCron, { isLoading }] = useAddCronJobMutation();
  const { data: agentsData } = useGetAgentsQuery();
  const [name, setName] = useState('');
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('cron');
  const [scheduleValue, setScheduleValue] = useState('');
  const [atDatetime, setAtDatetime] = useState('');
  const [message, setMessage] = useState('');
  const [agent, setAgent] = useState('');
  const [session, setSession] = useState('isolated');
  const [tz, setTz] = useState('');
  const [error, setError] = useState('');

  const agents = agentsData?.items ?? [];
  const selectedAgent = agents.find((a) => (a.openclawAgentId || a.name) === agent);
  const { data: convData } = useGetConversationsQuery(selectedAgent?._id ?? '', {
    skip: !selectedAgent,
  });
  const conversations = convData?.items ?? [];

  const handleSubmit = async () => {
    setError('');
    const opts: Record<string, string> = {};
    if (name) opts.name = name;
    if (message) opts.message = message;
    if (agent) opts.agent = agent;
    if (session === 'main' || session === 'isolated') {
      opts.session = session;
    } else if (session) {
      opts['session-key'] = session;
      opts.session = `session:${session}`;
    }
    if (tz) opts.tz = tz;

    if (scheduleKind === 'at') {
      if (!atDatetime) return;
      opts.at = new Date(atDatetime).toISOString();
    } else {
      if (!scheduleValue.trim()) return;
      opts[scheduleKind] = scheduleValue;
    }

    try {
      await addCron(opts).unwrap();
      onDone();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      setError(msg || 'Failed to add cron job');
    }
  };

  const hasSchedule = scheduleKind === 'at' ? !!atDatetime : !!scheduleValue.trim();
  const canSubmit = hasSchedule && (name.trim() || message.trim());

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

      <TextField
        fullWidth
        size="small"
        label="Job Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        sx={inputSx}
      />

      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel sx={{ fontSize: '0.85rem' }}>Schedule Type</InputLabel>
        <Select
          value={scheduleKind}
          label="Schedule Type"
          onChange={(e) => {
            const kind = e.target.value as ScheduleKind;
            setScheduleKind(kind);
            if (kind === 'every') setTz('');
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

      {scheduleKind === 'at' ? (
        <TextField
          fullWidth
          size="small"
          type="datetime-local"
          label="Run At"
          value={atDatetime}
          onChange={(e) => setAtDatetime(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={inputSx}
        />
      ) : (
        <TextField
          fullWidth
          size="small"
          label={
            scheduleKind === 'cron'
              ? 'Cron Expression (e.g. 0 */6 * * *)'
              : 'Interval (e.g. 30m, 2h)'
          }
          value={scheduleValue}
          onChange={(e) => setScheduleValue(e.target.value)}
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
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        sx={inputSx}
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <FormControl fullWidth size="small">
          <InputLabel sx={{ fontSize: '0.85rem' }}>Agent (optional)</InputLabel>
          <Select
            value={agent}
            label="Agent (optional)"
            onChange={(e) => {
              setAgent(e.target.value);
              setSession('isolated');
            }}
            sx={{ fontSize: '0.85rem', borderRadius: 1.5 }}
          >
            <MenuItem value="" sx={{ fontSize: '0.85rem' }}>
              <em>None</em>
            </MenuItem>
            {agents.map((a) => (
              <MenuItem key={a._id} value={a.openclawAgentId || a.name} sx={{ fontSize: '0.85rem' }}>
                {a.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {scheduleKind !== 'every' && (
          <Autocomplete
            fullWidth
            size="small"
            freeSolo
            options={COMMON_TIMEZONES}
            value={tz || null}
            onChange={(_e, val) => setTz(val || '')}
            onInputChange={(_e, val) => setTz(val || '')}
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

      {agent && (
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>Session</InputLabel>
          <Select
            value={session}
            label="Session"
            onChange={(e) => setSession(e.target.value)}
            sx={{ fontSize: '0.85rem', borderRadius: 1.5 }}
          >
            <MenuItem value="isolated" sx={{ fontSize: '0.85rem' }}>Isolated (new session)</MenuItem>
            <MenuItem value="main" sx={{ fontSize: '0.85rem' }}>Main session</MenuItem>
            {conversations
              .filter((c) => c.sessionKey)
              .map((c) => (
                <MenuItem
                  key={c._id}
                  value={`agent:${agent}:${c.sessionKey}`}
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
        variant="contained"
        size="small"
        disabled={!canSubmit || isLoading}
        onClick={handleSubmit}
        sx={{ textTransform: 'none', fontSize: '0.8rem' }}
      >
        {isLoading ? <CircularProgress size={16} /> : 'Add Job'}
      </Button>
    </Box>
  );
}
