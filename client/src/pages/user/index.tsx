import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  CircularProgress,
  InputAdornment,
  IconButton,
  Collapse,
} from '@mui/material';
import { Search, Add } from '@mui/icons-material';
import { useGetUsersQuery, useDeleteUserMutation } from '../../entities/user/api';
import UserRow from '../../widgets/users/UserRow';
import UserForm from '../../widgets/users/UserForm';

export default function UsersPage() {
  const { data, isLoading, isFetching } = useGetUsersQuery();
  const [deleteUser] = useDeleteUserMutation();
  const [search, setSearch] = useState('');
  const [formMode, setFormMode] = useState<'closed' | 'add' | string>('closed');
  const [pendingOp, setPendingOp] = useState(false);

  const busy = isLoading || pendingOp || isFetching;
  const users = data?.items ?? [];

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (id: string) => {
    setPendingOp(true);
    try {
      await deleteUser(id).unwrap();
    } catch {
      /* handled by RTK */
    } finally {
      setPendingOp(false);
    }
  };

  const handleFormDone = () => {
    setFormMode('closed');
  };

  const handleEdit = (id: string) => {
    setFormMode(id);
  };

  const showForm = formMode !== 'closed';
  const editUserId = formMode !== 'closed' && formMode !== 'add' ? formMode : null;

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          Users
        </Typography>
        {!busy && (
          <Typography variant="body2" color="text.secondary">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={() => setFormMode((prev) => (prev === 'add' ? 'closed' : 'add'))}
          sx={{
            bgcolor: formMode === 'add' ? 'primary.main' : 'action.hover',
            color: formMode === 'add' ? 'primary.contrastText' : 'text.primary',
            '&:hover': {
              bgcolor: formMode === 'add' ? 'primary.dark' : 'action.selected',
            },
          }}
        >
          <Add sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Collapse in={showForm}>
        <UserForm userId={editUserId} onDone={handleFormDone} />
      </Collapse>

      <TextField
        fullWidth
        size="small"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          mb: 2,
          '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            '& input': { fontSize: '0.85rem', py: 1 },
          },
        }}
      />

      {busy ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box>
          {filtered.map((user) => (
            <UserRow key={user._id} user={user} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
          {filtered.length === 0 && (
            <Typography sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
              {search ? 'No users match your search' : 'No users found'}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
