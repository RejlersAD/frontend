import { createSlice } from '@reduxjs/toolkit'
import { authService } from '../../services/auth.service'

/**
 * Authentication Slice
 * Smart state management for authentication
 */

const initialState = {
  user: authService.getUserData(),
  isAuthenticated: authService.isAuthenticated(),
  loading: false,
  error: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true
      state.error = null
    },
    loginSuccess: (state, action) => {
      state.user = action.payload
      state.isAuthenticated = true
      state.loading = false
      state.error = null
    },
    loginFailure: (state, action) => {
      state.loading = false
      state.error = action.payload
    },
    logout: (state) => {
      authService.logout()
      state.user = null
      state.isAuthenticated = false
      state.loading = false
      state.error = null
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload }
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateUser,
  clearError,
} = authSlice.actions

export default authSlice.reducer
