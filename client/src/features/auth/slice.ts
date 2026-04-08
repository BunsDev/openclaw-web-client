import { createSlice } from '@reduxjs/toolkit';
import { authApi } from './api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      // .addMatcher(authApi.endpoints.login.matchPending, (state) => {
      //   state.isLoading = true;
      //   state.error = null;
      // })
      .addMatcher(authApi.endpoints.login.matchFulfilled, (state, action) => {
        state.user = action.payload;
        state.token = localStorage.getItem('token');
        state.isAuthenticated = true;
      })
      // .addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
      //   state.user = null;
      //   state.token = null;
      //   state.isAuthenticated = false;
      //   state.isLoading = false;
      //   state.error = action.error.message ?? 'Login failed';
      //   localStorage.removeItem('token');
      // })
      // Logout
      .addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        localStorage.removeItem('token');
      })
      // Get Me
      .addMatcher(authApi.endpoints.getMe.matchFulfilled, (state, action) => {
        state.user = action.payload;
      })
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
