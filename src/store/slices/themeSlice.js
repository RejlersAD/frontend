import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, THEME } from '../../config/app.config'

/**
 * Theme Slice
 * Smart state management for theme settings
 */

const getInitialTheme = () => {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME)
  return savedTheme || THEME.LIGHT
}

const initialState = {
  mode: getInitialTheme(),
}

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === THEME.LIGHT ? THEME.DARK : THEME.LIGHT
      localStorage.setItem(STORAGE_KEYS.THEME, state.mode)
    },
    setTheme: (state, action) => {
      state.mode = action.payload
      localStorage.setItem(STORAGE_KEYS.THEME, action.payload)
    },
  },
})

export const { toggleTheme, setTheme } = themeSlice.actions

export default themeSlice.reducer
