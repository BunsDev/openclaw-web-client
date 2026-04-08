import { useEffect } from 'react';
import { useFormik } from 'formik';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Box,
} from '@mui/material';
import { useGetUserQuery, useCreateUserMutation, useUpdateUserMutation } from '../../app/store';
import { useValidationErrors } from '../../app/store/hooks';

interface UserFormProps {
  open: boolean;
  userId?: string | null;
  onClose: () => void;
}

export default function UserForm({ open, userId, onClose }: UserFormProps) {
  const isEdit = Boolean(userId);

  const { data: user, isLoading: isLoadingUser } = useGetUserQuery(userId!, {
    skip: !userId,
  });

  const [createUser, { isLoading: isCreating, error: createError, reset: resetCreate }] =
    useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating, error: updateError, reset: resetUpdate }] =
    useUpdateUserMutation();

  const formik = useFormik({
    initialValues: {
      name: '',
      lastName: '',
      email: '',
      password: '',
      phone: '',
    },
    onSubmit: async (values) => {
      try {
        if (isEdit && userId) {
          const updateData = { ...values };
          if (!updateData.password) {
            delete (updateData as { password?: string }).password;
          }
          await updateUser({ id: userId, data: updateData }).unwrap();
        } else {
          await createUser(values).unwrap();
        }
        handleClose();
      } catch {
        // Error handled by mutation state
      }
    },
  });

  useEffect(() => {
    if (open) {
      resetCreate();
      resetUpdate();

      if (userId && user) {
        formik.setValues({
          name: user.name || '',
          lastName: user.lastName || '',
          email: user.email || '',
          password: '',
          phone: user.phone || '',
        });
      } else if (!userId) {
        formik.resetForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, user]);

  const handleClose = () => {
    onClose();
  };

  const isLoading = isCreating || isUpdating;
  const error = createError || updateError;
  const validationErrors = useValidationErrors(error);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit User' : 'Create User'}</DialogTitle>
      <form onSubmit={formik.handleSubmit}>
        <DialogContent>
          {isLoadingUser ? (
            <Box display="flex" justifyContent="center" py={3}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {isEdit ? 'Failed to update user' : 'Failed to create user'}
                </Alert>
              )}

              <TextField
                fullWidth
                id="name"
                name="name"
                label="First Name"
                value={formik.values.name}
                onChange={formik.handleChange}
                error={Boolean(validationErrors?.name)}
                helperText={validationErrors?.name}
                sx={{ mb: 2 }}
                autoFocus
              />

              <TextField
                fullWidth
                id="lastName"
                name="lastName"
                label="Last Name"
                value={formik.values.lastName}
                onChange={formik.handleChange}
                error={Boolean(validationErrors?.lastName)}
                helperText={validationErrors?.lastName}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                id="email"
                name="email"
                label="Email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                error={Boolean(validationErrors?.email)}
                helperText={validationErrors?.email}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                id="password"
                name="password"
                label={isEdit ? 'Password (leave empty to keep current)' : 'Password'}
                type="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                error={Boolean(validationErrors?.password)}
                helperText={validationErrors?.password}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                id="phone"
                name="phone"
                label="Phone"
                value={formik.values.phone}
                onChange={formik.handleChange}
                error={Boolean(validationErrors?.phone)}
                helperText={validationErrors?.phone}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isLoading || isLoadingUser}>
            {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
