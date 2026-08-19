import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import rbacService from '../../services/rbac.service';

// Async thunks
export const fetchCurrentUser = createAsyncThunk(
  'rbac/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getCurrentUser();
      // Soft-coded: Handle both direct data and nested data.data responses
      const currentUserData = response?.data?.data || response?.data || response;
      console.log('[fetchCurrentUser] Extracted currentUserData:', currentUserData);
      return currentUserData;
    } catch (error) {
      console.error('[fetchCurrentUser] Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchUsers = createAsyncThunk(
  'rbac/fetchUsers',
  async (params = {}, { rejectWithValue }) => {
    try {
      // 🔧 SOFT-CODED: Fetch all users by setting high page_size
      // Default to 1000 to ensure all users are fetched (current total: ~350)
      const fetchParams = {
        ...params,
        page_size: params.page_size || 1000,
      };
      
      console.log('[fetchUsers] 📄 Fetching users with params:', fetchParams);
      const response = await rbacService.getUsers(fetchParams);
      
      // Soft-coded: Handle both direct data and nested data.data responses
      const userData = response?.data?.data || response?.data || response;
      
      // Handle paginated response
      let users = userData;
      if (userData?.results && Array.isArray(userData.results)) {
        users = userData.results;
        console.log('[fetchUsers] ✅ Paginated response detected');
        console.log('[fetchUsers] 📊 Total count:', userData.count);
        console.log('[fetchUsers] 📄 Users fetched:', users.length);
        
        // Return full pagination data so frontend can show "Load More" or pagination controls
        return {
          users: users,
          count: userData.count,
          next: userData.next,
          previous: userData.previous
        };
      }
      
      console.log('[fetchUsers] Raw response:', response);
      console.log('[fetchUsers] Extracted userData:', userData);
      console.log('[fetchUsers] Is array:', Array.isArray(users));
      console.log('[fetchUsers] Total users:', users.length || 0);
      
      // If not paginated, return users directly (backward compatibility)
      return Array.isArray(users) ? { users: users, count: users.length } : { users: [], count: 0 };
    } catch (error) {
      console.error('[fetchUsers] ❌ Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchRoles = createAsyncThunk(
  'rbac/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getRoles({ silentTimeout: true });
      console.log('[fetchRoles] Raw response.data:', response?.data);
      // Soft-coded: Handle both direct data and nested data.data responses
      const rolesData = response?.data?.data || response?.data || response;
      console.log('[fetchRoles] Extracted rolesData:', rolesData);
      return rolesData;
    } catch (error) {
      console.error('[fetchRoles] Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchPermissions = createAsyncThunk(
  'rbac/fetchPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getPermissions();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchModules = createAsyncThunk(
  'rbac/fetchModules',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getModules();
      // Soft-coded: Handle both direct data and nested data.data responses
      const modulesData = response?.data?.data || response?.data || response;
      console.log('[fetchModules] Extracted modulesData:', modulesData);
      return modulesData;
    } catch (error) {
      console.error('[fetchModules] Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchOrganizations = createAsyncThunk(
  'rbac/fetchOrganizations',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getOrganizations();
      // Soft-coded: Handle both direct data and nested data.data responses
      const organizationsData = response?.data?.data || response?.data || response;
      console.log('[fetchOrganizations] Extracted organizationsData:', organizationsData);
      return organizationsData;
    } catch (error) {
      console.error('[fetchOrganizations] Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchDepartments = createAsyncThunk(
  'rbac/fetchDepartments',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getDepartments();
      // Soft-coded: Handle both direct data and nested data.data responses
      const departmentsData = response?.data?.departments || response?.data || response;
      console.log('[fetchDepartments] Extracted departmentsData:', departmentsData);
      return departmentsData;
    } catch (error) {
      console.error('[fetchDepartments] Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchJobTitles = createAsyncThunk(
  'rbac/fetchJobTitles',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getJobTitles();
      // Soft-coded: Handle both direct data and nested data.data responses
      const jobTitlesData = response?.data?.job_titles || response?.data || response;
      console.log('[fetchJobTitles] Extracted jobTitlesData:', jobTitlesData);
      return jobTitlesData;
    } catch (error) {
      console.error('[fetchJobTitles] Error:', error);
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchUserStats = createAsyncThunk(
  'rbac/fetchUserStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await rbacService.getUserStats();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  currentUser: null,
  users: [],
  usersCount: 0,
  roles: [],
  permissions: [],
  modules: [],
  organizations: [],
  departments: [],
  jobTitles: [],
  stats: null,
  loading: false,
  error: null
};

const rbacSlice = createSlice({
  name: 'rbac',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Current User
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        state.currentUser = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Users
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        console.log('[Redux] fetchUsers.pending');
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        console.log('[Redux] fetchUsers.fulfilled - payload:', payload);
        
        // 🚀 PERFORMANCE: Handle new pagination-aware response structure
        let usersArray = [];
        let totalCount = 0;
        
        if (payload?.users && Array.isArray(payload.users)) {
          // New format: { users: [...], count: N, next: url, previous: url }
          usersArray = payload.users;
          totalCount = payload.count || payload.users.length;
          console.log('[Redux] ✅ Using new pagination format');
        } else if (Array.isArray(payload)) {
          // Direct array of users (backward compatibility)
          usersArray = payload;
          totalCount = payload.length;
        } else if (payload?.results && Array.isArray(payload.results)) {
          // Paginated response with results array (backward compatibility)
          usersArray = payload.results;
          totalCount = payload.count || payload.results.length;
        } else if (payload?.data) {
          // Nested data structure (backward compatibility)
          if (Array.isArray(payload.data)) {
            usersArray = payload.data;
            totalCount = payload.data.length;
          } else if (payload.data.results && Array.isArray(payload.data.results)) {
            usersArray = payload.data.results;
            totalCount = payload.data.count || payload.data.results.length;
          }
        }
        
        state.users = usersArray;
        state.usersCount = totalCount;
        console.log('[Redux] Users set:', usersArray.length, 'users');
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.users = []; // Ensure users is always an array
        state.usersCount = 0;
        console.error('[Redux] fetchUsers.rejected:', action.payload);
      })
      
      // Roles
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        console.log('[Redux] fetchRoles.pending');
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        console.log('[Redux] fetchRoles.fulfilled - payload:', payload);
        
        // Soft-coded: Handle multiple response structures
        let rolesArray = [];
        if (Array.isArray(payload)) {
          rolesArray = payload;
        } else if (payload?.results && Array.isArray(payload.results)) {
          rolesArray = payload.results;
        } else if (payload?.data && Array.isArray(payload.data)) {
          rolesArray = payload.data;
        }
        
        state.roles = rolesArray;
        console.log('[Redux] Roles set:', rolesArray.length, 'roles');
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.roles = []; // Ensure roles is always an array
        console.error('[Redux] fetchRoles.rejected:', action.payload);
      })
      
      // Permissions
      .addCase(fetchPermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchPermissions.fulfilled, (state, action) => {
        state.loading = false;
        state.permissions = Array.isArray(action.payload) ? action.payload : (action.payload.results || []);
      })
      .addCase(fetchPermissions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.permissions = []; // Ensure permissions is always an array
      })
      
      // Modules
      .addCase(fetchModules.pending, (state) => {
        state.loading = true;
        console.log('[Redux] fetchModules.pending');
      })
      .addCase(fetchModules.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        console.log('[Redux] fetchModules.fulfilled - payload:', payload);
        
        // Soft-coded: Handle multiple response structures
        let modulesArray = [];
        if (Array.isArray(payload)) {
          modulesArray = payload;
        } else if (payload?.results && Array.isArray(payload.results)) {
          modulesArray = payload.results;
        } else if (payload?.data && Array.isArray(payload.data)) {
          modulesArray = payload.data;
        }
        
        state.modules = modulesArray;
        console.log('[Redux] Modules set:', modulesArray.length, 'modules');
      })
      .addCase(fetchModules.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.modules = []; // Ensure modules is always an array
      })
      
      // Organizations
      .addCase(fetchOrganizations.pending, (state) => {
        state.loading = true;
        console.log('[Redux] fetchOrganizations.pending');
      })
      .addCase(fetchOrganizations.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        console.log('[Redux] fetchOrganizations.fulfilled - payload:', payload);
        
        // Soft-coded: Handle multiple response structures
        let organizationsArray = [];
        if (Array.isArray(payload)) {
          organizationsArray = payload;
        } else if (payload?.results && Array.isArray(payload.results)) {
          organizationsArray = payload.results;
        } else if (payload?.data && Array.isArray(payload.data)) {
          organizationsArray = payload.data;
        }
        
        state.organizations = organizationsArray;
        console.log('[Redux] Organizations set:', organizationsArray.length, 'organizations');
      })
      .addCase(fetchOrganizations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.organizations = []; // Ensure organizations is always an array
        console.error('[Redux] fetchOrganizations.rejected:', action.payload);
      })
      
      // Departments
      .addCase(fetchDepartments.pending, (state) => {
        state.loading = true;
        console.log('[Redux] fetchDepartments.pending');
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        console.log('[Redux] fetchDepartments.fulfilled - payload:', payload);
        
        // Soft-coded: Handle multiple response structures
        let departmentsArray = [];
        if (Array.isArray(payload)) {
          departmentsArray = payload;
        } else if (payload?.results && Array.isArray(payload.results)) {
          departmentsArray = payload.results;
        } else if (payload?.data && Array.isArray(payload.data)) {
          departmentsArray = payload.data;
        }
        
        state.departments = departmentsArray;
        console.log('[Redux] Departments set:', departmentsArray.length, 'departments');
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.departments = []; // Ensure departments is always an array
        console.error('[Redux] fetchDepartments.rejected:', action.payload);
      })
      
      // Job Titles
      .addCase(fetchJobTitles.pending, (state) => {
        state.loading = true;
        console.log('[Redux] fetchJobTitles.pending');
      })
      .addCase(fetchJobTitles.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload;
        console.log('[Redux] fetchJobTitles.fulfilled - payload:', payload);
        
        // Soft-coded: Handle multiple response structures
        let jobTitlesArray = [];
        if (Array.isArray(payload)) {
          jobTitlesArray = payload;
        } else if (payload?.results && Array.isArray(payload.results)) {
          jobTitlesArray = payload.results;
        } else if (payload?.data && Array.isArray(payload.data)) {
          jobTitlesArray = payload.data;
        }
        
        state.jobTitles = jobTitlesArray;
        console.log('[Redux] Job Titles set:', jobTitlesArray.length, 'job titles');
      })
      .addCase(fetchJobTitles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.jobTitles = []; // Ensure jobTitles is always an array
        console.error('[Redux] fetchJobTitles.rejected:', action.payload);
      })
      
      // Stats
      .addCase(fetchUserStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(fetchUserStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearError } = rbacSlice.actions;
export default rbacSlice.reducer;
