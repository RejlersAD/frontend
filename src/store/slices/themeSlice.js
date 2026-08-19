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
      
      // Apply theme to document
      if (state.mode === THEME.DARK) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },
    setTheme: (state, action) => {
      state.mode = action.payload
      localStorage.setItem(STORAGE_KEYS.THEME, action.payload)
      
      // Apply theme to document
      if (action.payload === THEME.DARK) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },
  },
})

export const { toggleTheme, setTheme } = themeSlice.actions

export default themeSlice.reducer
