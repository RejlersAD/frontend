import { createSlice } from '@reduxjs/toolkit'

/**
 * User Slice
 * Smart state management for user data
 */

const initialState = {
  users: [],
  currentUser: null,
  loading: false,
  error: null,
}

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUsers: (state, action) => {
      state.users = action.payload
    },
    setCurrentUser: (state, action) => {
      state.currentUser = action.payload
    },
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setError: (state, action) => {
      state.error = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
})

export const {
  setUsers,
  setCurrentUser,
  setLoading,
  setError,
  clearError,
} = userSlice.actions

export default userSlice.reducer
