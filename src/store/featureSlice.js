/**
 * Feature Registry Store
 * Redux slice for managing dynamic features
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import featureService from '../services/featureService'

// Async thunks
export const fetchFeatures = createAsyncThunk(
  'features/fetchAll',
  async (filters = {}, { rejectWithValue }) => {
    try {
      console.log('🚀 [fetchFeatures] Starting fetch with filters:', filters)
      const response = await featureService.getFeatures(filters)
      console.log('📦 [fetchFeatures] Response received:', response)
      console.log('📊 [fetchFeatures] Features count:', response?.features?.length)
      console.log('📋 [fetchFeatures] Features array:', response?.features)
      
      // Check for sales features specifically
      const salesFeatures = response?.features?.filter(f => f.category === 'sales') || []
      console.log('💼 [fetchFeatures] Sales features found:', salesFeatures.length)
      salesFeatures.forEach(f => {
        console.log(`  ✅ ${f.name} (${f.id})`)
      })
      
      return response
    } catch (error) {
      console.error('❌ [fetchFeatures] Error:', error)
      return rejectWithValue(error.response?.data || 'Failed to fetch features')
    }
  }
)

export const fetchNavigation = createAsyncThunk(
  'features/fetchNavigation',
  async (_, { rejectWithValue }) => {
    try {
      const response = await featureService.getNavigation()
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch navigation')
    }
  }
)

export const fetchCategories = createAsyncThunk(
  'features/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await featureService.getCategories()
      return response
    } catch (error) {
      return rejectWithValue(error.response?.data || 'Failed to fetch categories')
    }
  }
)

const initialState = {
  features: [],
  navigation: [],
  categories: [],
  selectedFeature: null,
  loading: false,
  error: null,
  initialized: false
}

const featureSlice = createSlice({
  name: 'features',
  initialState,
  reducers: {
    setSelectedFeature: (state, action) => {
      state.selectedFeature = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    resetFeatures: (state) => {
      return initialState
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch features
      .addCase(fetchFeatures.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchFeatures.fulfilled, (state, action) => {
        state.loading = false
        state.features = action.payload.features || []
        state.initialized = true
      })
      .addCase(fetchFeatures.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch navigation
      .addCase(fetchNavigation.pending, (state) => {
        state.loading = true
      })
      .addCase(fetchNavigation.fulfilled, (state, action) => {
        state.loading = false
        state.navigation = action.payload.navigation || []
      })
      .addCase(fetchNavigation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
      
      // Fetch categories
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload.categories || []
      })
  }
})

export const { setSelectedFeature, clearError, resetFeatures } = featureSlice.actions

// Selectors
export const selectAllFeatures = (state) => state.features.features
export const selectNavigation = (state) => state.features.navigation
export const selectCategories = (state) => state.features.categories
export const selectFeaturesLoading = (state) => state.features.loading
export const selectFeaturesError = (state) => state.features.error
export const selectFeaturesInitialized = (state) => state.features.initialized

// Utility selectors
export const selectFeatureById = (featureId) => (state) => {
  return state.features.features.find(f => f.id === featureId)
}

export const selectFeaturesByCategory = (category) => (state) => {
  return state.features.features.filter(f => f.category === category)
}

export const selectActiveFeatures = (state) => {
  return state.features.features.filter(f => f.status === 'active')
}

export default featureSlice.reducer
