/**
 * Process Datasheet Dashboard
 * Overview and management of all datasheets
 * Soft-coded filtering and display options
 */

import React, { useState, useEffect } from 'react';
import api from '../../services/api.service';
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Menu,
  Grid,
  Paper
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  CloudUpload,
  CheckCircle,
  Warning,
  MoreVert,
  FilterList,
  Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CompactWorkflowProgress } from './WorkflowProgressTracker';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// Soft-coded status configurations
const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    color: 'default',
    icon: '📝'
  },
  pending_validation: {
    label: 'Pending Validation',
    color: 'warning',
    icon: '⏳'
  },
  validated: {
    label: 'Validated',
    color: 'info',
    icon: '✓'
  },
  approved: {
    label: 'Approved',
    color: 'success',
    icon: '✅'
  },
  rejected: {
    label: 'Rejected',
    color: 'error',
    icon: '❌'
  }
};

/**
 * Dashboard Statistics Cards
 */
const StatisticsCards = ({ stats }) => {
  return (
    <Grid container spacing={3} className="mb-6">
      <Grid item xs={12} sm={6} md={3}>
        <Paper className="p-4 bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="text-3xl font-bold text-blue-600">
            {stats.total || 0}
          </div>
          <div className="text-sm text-gray-600">Total Datasheets</div>
        </Paper>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Paper className="p-4 bg-gradient-to-br from-green-50 to-green-100">
          <div className="text-3xl font-bold text-green-600">
            {stats.approved || 0}
          </div>
          <div className="text-sm text-gray-600">Approved</div>
        </Paper>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Paper className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100">
          <div className="text-3xl font-bold text-yellow-600">
            {stats.pending || 0}
          </div>
          <div className="text-sm text-gray-600">Pending Validation</div>
        </Paper>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Paper className="p-4 bg-gradient-to-br from-purple-50 to-purple-100">
          <div className="text-3xl font-bold text-purple-600">
            {stats.draft || 0}
          </div>
          <div className="text-sm text-gray-600">Drafts</div>
        </Paper>
      </Grid>
    </Grid>
  );
};

/**
 * Datasheet Table Row
 */
const DatasheetRow = ({ datasheet, onView, onEdit, onDelete, onValidate }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const statusConfig = STATUS_CONFIG[datasheet.status] || STATUS_CONFIG.draft;

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <TableRow hover>
      <TableCell>
        <div className="font-semibold">{datasheet.tag_number || datasheet.id.slice(0, 8)}</div>
        <div className="text-sm text-gray-600">{datasheet.equipment_type_name}</div>
      </TableCell>

      <TableCell>
        <Chip
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          icon={<span>{statusConfig.icon}</span>}
        />
      </TableCell>

      <TableCell>
        {datasheet.validation_score ? (
          <div className="flex items-center gap-2">
            <div className={`text-sm font-semibold ${
              datasheet.validation_score >= 0.8 ? 'text-green-600' :
              datasheet.validation_score >= 0.6 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {(datasheet.validation_score * 100).toFixed(0)}%
            </div>
            {datasheet.validation_score >= 0.8 ? (
              <CheckCircle fontSize="small" className="text-green-600" />
            ) : (
              <Warning fontSize="small" className="text-yellow-600" />
            )}
          </div>
        ) : (
          <span className="text-gray-400">Not validated</span>
        )}
      </TableCell>

      <TableCell>
        <div className="text-sm">
          {new Date(datasheet.created_at).toLocaleDateString()}
        </div>
        <div className="text-xs text-gray-500">
          {new Date(datasheet.created_at).toLocaleTimeString()}
        </div>
      </TableCell>

      <TableCell>
        <div className="text-sm">{datasheet.created_by_name || 'Unknown'}</div>
      </TableCell>

      <TableCell align="right">
        <IconButton size="small" onClick={() => onView(datasheet)}>
          <Visibility fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onEdit(datasheet)}>
          <Edit fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleMenuOpen}>
          <MoreVert fontSize="small" />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => { onValidate(datasheet); handleMenuClose(); }}>
            Validate
          </MenuItem>
          <MenuItem onClick={() => { onDelete(datasheet); handleMenuClose(); }}>
            Delete
          </MenuItem>
        </Menu>
      </TableCell>
    </TableRow>
  );
};

/**
 * Main Dashboard Component
 */
const DatasheetDashboard = () => {
  const navigate = useNavigate();
  
  // State
  const [datasheets, setDatasheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({});
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState('all');
  const [equipmentTypes, setEquipmentTypes] = useState([]);

  // Load data on mount and filter changes
  useEffect(() => {
    loadDatasheets();
    loadStatistics();
    loadEquipmentTypes();
  }, [page, rowsPerPage, statusFilter, equipmentTypeFilter, searchQuery]);

  /**
   * Load datasheets from API
   */
  const loadDatasheets = async () => {
    setLoading(true);
    try {
      const params = {
        page: page + 1,
        page_size: rowsPerPage
      };

      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (equipmentTypeFilter !== 'all') params.equipment_type = equipmentTypeFilter;

      const response = await axios.get(`${API_BASE_URL}/process-datasheet/datasheets/`, {
        params
      });

      setDatasheets(response.data.results || []);
      setTotalCount(response.data.count || 0);
    } catch (error) {
      console.error('Error loading datasheets:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load statistics
   */
  const loadStatistics = async () => {
    try {
      const response = await api.get('/process-datasheet/datasheets/statistics/');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  /**
   * Load equipment types for filter
   */
  const loadEquipmentTypes = async () => {
    try {
      const response = await api.get('/process-datasheet/equipment-types/');
      // Handle paginated response - extract results array
      const types = response.data.results || response.data;
      setEquipmentTypes(Array.isArray(types) ? types : []);
    } catch (error) {
      console.error('Error loading equipment types:', error);
      setEquipmentTypes([]);
    }
  };

  /**
   * Handle actions
   */
  const handleView = (datasheet) => {
    navigate(`/engineering/process/datasheet/view/${datasheet.id}`);
  };

  const handleEdit = (datasheet) => {
    navigate(`/engineering/process/datasheet/edit/${datasheet.id}`);
  };

  const handleDelete = async (datasheet) => {
    if (window.confirm('Are you sure you want to delete this datasheet?')) {
      try {
        await api.delete(`/process-datasheet/datasheets/${datasheet.id}/`);
        loadDatasheets();
        loadStatistics();
      } catch (error) {
        console.error('Error deleting datasheet:', error);
        alert('Failed to delete datasheet');
      }
    }
  };

  const handleValidate = async (datasheet) => {
    try {
      await api.post(`/process-datasheet/datasheets/${datasheet.id}/validate/`);
      loadDatasheets();
      alert('Validation completed successfully');
    } catch (error) {
      console.error('Error validating datasheet:', error);
      alert('Failed to validate datasheet');
    }
  };

  const handleCreateNew = () => {
    navigate('/engineering/process/datasheet/create');
  };

  const handleUploadPDF = () => {
    navigate('/engineering/process/datasheet/upload');
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Process Datasheets</h1>
          <p className="text-gray-600 mt-1">Manage and track engineering datasheets</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outlined"
            startIcon={<CloudUpload />}
            onClick={handleUploadPDF}
          >
            Upload PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateNew}
          >
            Create New
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <StatisticsCards stats={stats} />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent>
          <div className="flex items-center gap-4">
            <FilterList className="text-gray-400" />
            
            <TextField
              label="Search"
              variant="outlined"
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tag number, description..."
              className="flex-1"
            />

            <FormControl size="small" style={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <MenuItem key={key} value={key}>
                    {config.icon} {config.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" style={{ minWidth: 180 }}>
              <InputLabel>Equipment Type</InputLabel>
              <Select
                value={equipmentTypeFilter}
                onChange={(e) => setEquipmentTypeFilter(e.target.value)}
                label="Equipment Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                {equipmentTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <IconButton onClick={loadDatasheets}>
              <Refresh />
            </IconButton>
          </div>
        </CardContent>
      </Card>

      {/* Datasheets Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tag / Equipment</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Validation Score</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : datasheets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No datasheets found
                  </TableCell>
                </TableRow>
              ) : (
                datasheets.map((datasheet) => (
                  <DatasheetRow
                    key={datasheet.id}
                    datasheet={datasheet}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onValidate={handleValidate}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>
    </div>
  );
};

export default DatasheetDashboard;
