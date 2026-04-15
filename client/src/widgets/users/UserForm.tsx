import { useEffect, useState } from 'react';
import { Box, Typography, IconButton, TextField, Button, CircularProgress } from '@mui/material';
import { Close } from '@mui/icons-material';
import {
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
} from '../../entities/user/api';

type FieldErrors = Record<string, string[]>;

function parseFieldErrors(err: unknown): FieldErrors | null {
  const typed = err as { status?: number; data?: Record<string, unknown> } | undefined;
  if (typed?.status === 422 && typed.data && typeof typed.data === 'object') {
    return typed.data as FieldErrors;
  }
  return null;
}

function fieldError(errors: FieldErrors | null, field: string): string {
  if (!errors || !errors[field]) return '';
  return errors[field].join('. ');
}

const inputSx = {
  mb: 1.5,
  '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
  '& input': { fontSize: '0.85rem' },
  '& label': { fontSize: '0.85rem' },
  '& .MuiFormHelperText-root': { fontSize: '0.7rem', mx: 0.5 },
};

export default function UserForm({
  userId,
  onDone,
}: {
  userId: string | null;
  onDone: () => void;
}) {
  const isEdit = Boolean(userId);
  const { data: existing, isLoading: loadingUser } = useGetUserQuery(userId!, { skip: !userId });
  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [generalError, setGeneralError] = useState('');

  useEffect(() => {
    if (isEdit && existing) {
      setName(existing.name || '');
      setLastName(existing.lastName || '');
      setEmail(existing.email || '');
      setPhone(existing.phone || '');
      setPassword('');
    } else if (!isEdit) {
      setName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setPhone('');
    }
    setErrors(null);
    setGeneralError('');
  }, [existing, isEdit, userId]);

  const handleSubmit = async () => {
    setErrors(null);
    setGeneralError('');
    try {
      if (isEdit && userId) {
        const data: Record<string, string> = { name, lastName, email, phone };
        if (password) data.password = password;
        await updateUser({ id: userId, data }).unwrap();
      } else {
        await createUser({ name, lastName, email, password, phone }).unwrap();
      }
      onDone();
    } catch (err: unknown) {
      const fe = parseFieldErrors(err);
      if (fe) {
        setErrors(fe);
      } else {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setGeneralError(msg || (isEdit ? 'Failed to update user' : 'Failed to create user'));
      }
    }
  };

  const saving = isCreating || isUpdating;

  return (
    <Box sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1 }}>
          {isEdit ? 'Edit User' : 'Add User'}
        </Typography>
        <IconButton size="small" onClick={onDone}>
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {loadingUser ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label="First Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!fieldError(errors, 'name')}
              helperText={fieldError(errors, 'name')}
              sx={inputSx}
            />
            <TextField
              fullWidth
              size="small"
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={!!fieldError(errors, 'lastName')}
              helperText={fieldError(errors, 'lastName')}
              sx={inputSx}
            />
          </Box>

          <TextField
            fullWidth
            size="small"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!fieldError(errors, 'email')}
            helperText={fieldError(errors, 'email')}
            sx={inputSx}
          />

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label={isEdit ? 'Password (leave empty to keep)' : 'Password'}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!fieldError(errors, 'password')}
              helperText={fieldError(errors, 'password')}
              sx={inputSx}
            />
            <TextField
              fullWidth
              size="small"
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={!!fieldError(errors, 'phone')}
              helperText={fieldError(errors, 'phone')}
              sx={inputSx}
            />
          </Box>

          {generalError && (
            <Typography sx={{ fontSize: '0.75rem', color: 'error.main', mb: 1 }}>
              {generalError}
            </Typography>
          )}

          <Button
            variant="contained"
            size="small"
            disabled={saving}
            onClick={handleSubmit}
            sx={{ textTransform: 'none', fontSize: '0.8rem' }}
          >
            {saving ? <CircularProgress size={16} /> : isEdit ? 'Save' : 'Create User'}
          </Button>
        </>
      )}
    </Box>
  );
}
