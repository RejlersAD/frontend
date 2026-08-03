import { configureStore } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import userReducer from './slices/userSlice'
import themeReducer from './slices/themeSlice'
import rbacReducer from './slices/rbacSlice'
import featureReducer from './featureSlice'

/**
 * Redux Store Configuration
 * Smart state management setup
 */

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    theme: themeReducer,
    rbac: rbacReducer,
    features: featureReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})
