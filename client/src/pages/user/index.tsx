
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Paper,
  Typography,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Search, Edit, Add } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router';
import { useGetUsersQuery, useDeleteUserMutation } from '../../store';
import useFilters from '../../hooks/useFilters';
import DeleteButton from '../../components/DeleteButton';
import TableRowSkeleton from '../../components/TableRowSkeleton';
import UserForm from './form';

const defaultFilters = {
  sortField: 'createdAt',
  sortType: 'desc' as 'asc' | 'desc',
  page: 0,
  limit: 10,
  search: '',
};

type SortField = 'name' | 'email' | 'phone' | 'createdAt';

export default function UsersPage() {
  const { filters, setFilter } = useFilters(defaultFilters);
  const navigate = useNavigate();
  const location = useLocation();

  const { data, isLoading, error } = useGetUsersQuery(filters, { refetchOnMountOrArgChange: true });
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  const isCreateRoute = location.pathname === '/users/create';
  const isEditRoute = location.pathname.startsWith('/users/edit/');
  const dialogOpen = isCreateRoute || isEditRoute;
  const editUserId = isEditRoute ? location.pathname.split('/users/edit/')[1] : null;

  const handleSort = (field: SortField) => {
    if (filters.sortField === field) {
      setFilter({ sortType: filters.sortType === 'asc' ? 'desc' : 'asc' });
    } else {
      setFilter({ sortField: field, sortType: 'asc' });
    }
  };

  const handleCloseDialog = () => {
    navigate(`/users${location.search}`);
  };

  const users = data?.items ?? [];

  if (error) {
    return <Alert severity="error">Failed to load users</Alert>;
  }

  return (
    <Box>
      <TableContainer component={Paper}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
          }}
        >
          <Typography variant="h6">Users</Typography>
          <Box 
            display="flex" 
            alignItems="center" 
            gap={2}
          >
            <TextField
              variant="standard"
              size="small"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilter({ search: e.target.value || undefined, page: 0 })}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  ),
                  disableUnderline: false,
                },
              }}
              sx={{ width: 180 }}
            />
            <IconButton
              size="small"
              onClick={() => navigate(`/users/create${location.search}`)}
              sx={{
                bgcolor: 'primary.main',
                color: 'white',
                width: 28,
                height: 28,
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
              }}
            >
              <Add fontSize="small" />
            </IconButton>
          </Box>
        </Box>
        <Table
          sx={{
            '& .MuiTableCell-root': {
              borderBottom: 1,
              borderColor: 'divider',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={filters.sortField === 'name'}
                  direction={filters.sortField === 'name' ? filters.sortType : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={filters.sortField === 'email'}
                  direction={filters.sortField === 'email' ? filters.sortType : 'asc'}
                  onClick={() => handleSort('email')}
                >
                  Email
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={filters.sortField === 'phone'}
                  direction={filters.sortField === 'phone' ? filters.sortType : 'asc'}
                  onClick={() => handleSort('phone')}
                >
                  Phone
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={filters.sortField === 'createdAt'}
                  direction={filters.sortField === 'createdAt' ? filters.sortType : 'asc'}
                  onClick={() => handleSort('createdAt')}
                >
                  Created At
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? <TableRowSkeleton columns={5} />
              : users.map((user) => (
                <TableRow 
                  key={user._id} 
                  hover
                >
                  <TableCell>
                    {user.name} {user.lastName}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small"
                      onClick={() => navigate(`/users/edit/${user._id}${location.search}`)}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <DeleteButton
                      onConfirm={() => deleteUser(user._id)}
                      isLoading={isDeleting}
                      message="Delete this user?"
                    />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell 
                  colSpan={5} 
                  align="center"
                >
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={filters.page}
          onPageChange={(_, newPage) => setFilter({ page: newPage })}
          rowsPerPage={filters.limit}
          onRowsPerPageChange={(e) =>
            setFilter({ limit: parseInt(e.target.value, 10), page: 0 })
          }
          rowsPerPageOptions={[5, 10, 20, 40, 60, 100]}
        />
      </TableContainer>

      <UserForm 
        open={dialogOpen} 
        userId={editUserId} 
        onClose={handleCloseDialog}
      />
    </Box>
  );
}
