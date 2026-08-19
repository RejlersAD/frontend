import React, { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Typography, Box, Chip, TablePagination, TableSortLabel, TextField, 
  InputAdornment, IconButton, Tooltip, LinearProgress, useTheme, 
  useMediaQuery, Button, ButtonGroup
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ErrorOutline as CriticalIcon,
  Schedule as DelayIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';

// Import soft-coded column visibility configuration
import { isQHSEColumnVisible } from '../../../../config/qhseColumns.config';

const getChipColor = (value, type) => {
  const numValue = typeof value === 'string' ? parseFloat(value.replace('%', '')) : Number(value) || 0;
  
  if (type === "billability") {
    if (numValue >= 80) return "success";
    if (numValue >= 50) return "warning";
    return "error";
  }
  if (type === "cars" || type === "obs") {
    return numValue > 0 ? "error" : "success";
  }
  if (type === "kpi") {
    if (numValue >= 90) return "success";
    if (numValue >= 70) return "warning";
    return "error";
  }
  return "default";
};

const formatPercentage = (value) => {
  if (!value || value === '' || value === 'N/A') return "0%";
  const numValue = typeof value === 'string' ? parseFloat(value.replace('%', '')) : Number(value);
  return isNaN(numValue) ? "0%" : `${Math.round(numValue)}%`;
};

const formatNumber = (value) => {
  if (!value || value === '' || value === 'N/A') return 0;
  const numValue = Number(value);
  return isNaN(numValue) ? 0 : numValue;
};

const hasValidData = (project) => {
  return (
    (project.projectNo && project.projectNo !== '' && project.projectNo !== 'N/A') ||
    (project.projectTitle && project.projectTitle !== '' && project.projectTitle !== 'Untitled Project') ||
    (project.client && project.client !== '' && project.client !== 'N/A') ||
    (project.projectManager && project.projectManager !== '' && project.projectManager !== 'N/A')
  );
};

// 🎯 MANAGEMENT PERSPECTIVE: Enhanced Risk Assessment Logic
const getRiskLevel = (project) => {
  const completion = formatNumber(project.projectCompletionPercent);
  const billability = formatNumber(project.qualityBillabilityPercent);
  const carsOpen = formatNumber(project.carsOpen);
  const obsOpen = formatNumber(project.obsOpen);
  const auditDelay = formatNumber(project.delayInAuditsNoDays);
  const carsDelayed = formatNumber(project.carsDelayedClosingNoDays);
  const obsDelayed = formatNumber(project.obsDelayedClosingNoDays);
  const kpiAchieved = formatNumber(project.projectKPIsAchievedPercent);

  // CRITICAL RISK (Immediate Management Attention Required)
  if (
    carsOpen >= 3 ||                                    // Multiple CARs indicate serious quality issues
    obsOpen >= 5 ||                                     // Too many observations
    auditDelay >= 30 ||                                 // Audit delayed by more than a month
    (completion >= 80 && carsOpen > 0) ||               // Near completion but still has CARs
    (billability < 30 && completion > 50) ||            // Poor billability mid-project
    carsDelayed >= 45 ||                                // CARs delayed closing > 1.5 months
    obsDelayed >= 60                                    // OBS delayed closing > 2 months
  ) {
    return 'CRITICAL';
  }

  // HIGH RISK (Requires Management Review)
  if (
    carsOpen >= 1 ||                                    // Any open CARs
    obsOpen >= 2 ||                                     // Multiple observations
    auditDelay > 0 ||                                   // Any audit delays
    billability < 50 ||                                 // Poor billability
    kpiAchieved < 70 ||                                 // KPIs not meeting targets
    (completion >= 90 && (carsOpen > 0 || obsOpen > 0)) || // Near completion with issues
    carsDelayed > 0 ||                                  // Any delayed CAR closures
    obsDelayed > 0                                      // Any delayed OBS closures
  ) {
    return 'HIGH';
  }

  // MEDIUM RISK (Monitor Closely)
  if (
    billability < 70 ||                                 // Below optimal billability
    kpiAchieved < 85 ||                                 // KPIs below good performance
    (completion < 30 && billability < 60)               // Early stage with poor metrics
  ) {
    return 'MEDIUM';
  }

  // LOW RISK (On Track)
  return 'LOW';
};

// Enhanced table head with proper column widths including Quality Engineer
// ✅ SOFT-CODED: Uses qhseColumns.config.js to control column visibility
const EnhancedTableHead = ({ order, orderBy, onRequestSort }) => {
  const createSortHandler = (property) => (event) => {
    onRequestSort(event, property);
  };

  // Define all possible columns
  const allHeadCells = [
    { 
      id: 'displaySrNo', 
      label: 'Sr.No', 
      sortable: false, 
      width: '60px',
      align: 'center',
      configKey: 'srNo' // Maps to configuration key
    },
    { 
      id: 'projectNo', 
      label: 'Project No', 
      sortable: true, 
      width: '90px',
      configKey: 'projectNo'
    },
    { 
      id: 'projectTitle', 
      label: 'Project Title', 
      sortable: true, 
      width: '170px',
      minWidth: '180px',
      configKey: 'projectTitle'
    },
    { 
      id: 'client', 
      label: 'Client', 
      sortable: true, 
      width: '140px',
      configKey: 'client'
    },
    { 
      id: 'projectManager', 
      label: 'Project Manager', 
      sortable: true, 
      width: '140px',
      configKey: 'projectManager'
    },
    { 
      id: 'projectQualityEng',
      label: 'Quality Engineer', 
      sortable: true, 
      width: '140px',
      configKey: 'projectQualityEng'
    },
    { 
      id: 'qualityBillabilityPercent', 
      label: 'Billability (%)', 
      sortable: true, 
      width: '100px', 
      align: 'center',
      configKey: 'qualityBillabilityPercent' // ✅ This will be hidden via config
    },
    { 
      id: 'carsOpen', 
      label: 'CARs', 
      sortable: true, 
      width: '70px', 
      align: 'center',
      configKey: 'carsOpen'
    },
    { 
      id: 'obsOpen', 
      label: 'OBS', 
      sortable: true, 
      width: '70px', 
      align: 'center',
      configKey: 'obsOpen'
    },
    { 
      id: 'projectKPIsAchievedPercent', 
      label: 'KPIs (%)', 
      sortable: true, 
      width: '85px', 
      align: 'center',
      configKey: 'projectKPIsAchievedPercent'
    },
    { 
      id: 'delayInAuditsNoDays', 
      label: 'Audit Delay', 
      sortable: true, 
      width: '100px', 
      align: 'center',
      configKey: 'delayInAuditsNoDays'
    },
    { 
      id: 'projectCompletionPercent', 
      label: 'Completion (%)', 
      sortable: true, 
      width: '110px', 
      align: 'center',
      configKey: 'projectCompletionPercent'
    },
  ];

  // ✅ Filter columns based on configuration
  const headCells = allHeadCells.filter(cell => 
    !cell.configKey || isQHSEColumnVisible(cell.configKey)
  );

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            sortDirection={orderBy === headCell.id ? order : false}
            align={headCell.align || 'left'}
            className="!bg-gray-50 dark:!bg-slate-800 !border-gray-200 dark:!border-slate-700 !text-gray-900 dark:!text-slate-100"
            sx={{ 
              fontWeight: 600,
              borderBottom: '2px solid',
              width: headCell.width,
              minWidth: headCell.minWidth,
              position: 'sticky',
              top: 0,
              zIndex: 10,
              whiteSpace: 'nowrap',
              padding: '12px 6px',
              fontSize: '0.875rem'
            }}
          >
            {headCell.sortable ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id)}
                className="!text-gray-900 dark:!text-slate-100"
                sx={{ 
                  '& .MuiTableSortLabel-icon': {
                    fontSize: '1rem'
                  }
                }}
              >
                {headCell.label}
                {orderBy === headCell.id ? (
                  <Box component="span" sx={visuallyHidden}>
                    {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                  </Box>
                ) : null}
              </TableSortLabel>
            ) : (
              headCell.label
            )}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
};

const ProjectStatus = ({ projectsData = [], loading = false, onRefresh }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState('asc');
  const [orderBy, setOrderBy] = useState('displaySrNo');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Enhanced data processing with risk assessment
  const validProjects = useMemo(() => {
    return projectsData
      .filter(hasValidData)
      .map((project, index) => ({
        ...project,
        displaySrNo: index + 1,
        riskLevel: getRiskLevel(project)
      }));
  }, [projectsData]);

  const filteredProjects = useMemo(() => {
    let filtered = validProjects.filter(project =>
      project.projectNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.projectManager?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // ✅ Fix: Use the correct field name from Google Sheets mapping
      project.projectQualityEng?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply active filter
    if (activeFilter === 'CRITICAL') {
      filtered = filtered.filter(p => p.riskLevel === 'CRITICAL');
    } else if (activeFilter === 'HIGH_RISK') {
      filtered = filtered.filter(p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL');
    } else if (activeFilter === 'ON_TRACK') {
      filtered = filtered.filter(p => p.riskLevel === 'LOW');
    } else if (activeFilter === 'MEDIUM_RISK') {
      filtered = filtered.filter(p => p.riskLevel === 'MEDIUM');
    }

    return filtered;
  }, [validProjects, searchTerm, activeFilter]);

  const sortedProjects = useMemo(() => {
    const comparator = (a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];

      if (orderBy.includes('Percent') || orderBy.includes('Days') || orderBy.includes('Open')) {
        aValue = formatNumber(aValue);
        bValue = formatNumber(bValue);
      }

      if (bValue < aValue) {
        return order === 'desc' ? -1 : 1;
      }
      if (bValue > aValue) {
        return order === 'desc' ? 1 : -1;
      }
      return 0;
    };

    return filteredProjects.slice().sort(comparator);
  }, [filteredProjects, order, orderBy]);

  // Enhanced statistics calculations for filter buttons
  const stats = useMemo(() => {
    const total = validProjects.length;
    const critical = validProjects.filter(p => p.riskLevel === 'CRITICAL').length;
    const highRisk = validProjects.filter(p => p.riskLevel === 'HIGH' || p.riskLevel === 'CRITICAL').length;
    const mediumRisk = validProjects.filter(p => p.riskLevel === 'MEDIUM').length;
    const onTrack = validProjects.filter(p => p.riskLevel === 'LOW').length;

    return { total, critical, highRisk, mediumRisk, onTrack };
  }, [validProjects]);

  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setPage(0);
  };

  const paginatedProjects = sortedProjects.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Heading FIRST */}
      {/* <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 rounded-t-xl"> */}
        <Typography 
          variant="h6" 
          component="div" 
          fontWeight={600}
          className="!text-gray-900 dark:!text-slate-100"
        >
          Project Critical Status
        </Typography>
        <Typography 
          variant="body2" 
          className="!text-gray-600 dark:!text-slate-400"
        >
          {filteredProjects.length} projects
          {activeFilter !== 'ALL' && (
            <span> • Filtered by: {activeFilter.replace('_', ' ')}</span>
          )}
        </Typography>
        {/* Info about filter logic */}
        <Typography variant="caption" className="!text-gray-500 dark:!text-slate-400">
          <strong>Critical:</strong> Severe issues. <strong>High Risk:</strong> Notable issues. <strong>On Track:</strong> No major issues.
        </Typography>
      {/* </div> */}

      {/* Filter Buttons SECOND */}
      <Box sx={{ mb: 2, mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <ButtonGroup variant="outlined" size="small" className="bg-white dark:bg-slate-800">
          <Button 
            variant={activeFilter === 'ALL' ? 'contained' : 'outlined'}
            onClick={() => handleFilterChange('ALL')}
            startIcon={<FilterIcon />}
          >
            All ({stats.total})
          </Button>
          <Button 
            variant={activeFilter === 'CRITICAL' ? 'contained' : 'outlined'}
            color="error"
            onClick={() => handleFilterChange('CRITICAL')}
            startIcon={<CriticalIcon />}
          >
            Critical ({stats.critical})
          </Button>
          <Button 
            variant={activeFilter === 'HIGH_RISK' ? 'contained' : 'outlined'}
            color="warning"
            onClick={() => handleFilterChange('HIGH_RISK')}
            startIcon={<WarningIcon />}
          >
            High Risk ({stats.highRisk})
          </Button>
          {/* Remove Medium if not needed */}
          {/* <Button ...>Medium ({stats.mediumRisk})</Button> */}
          <Button 
            variant={activeFilter === 'ON_TRACK' ? 'contained' : 'outlined'}
            color="success"
            onClick={() => handleFilterChange('ON_TRACK')}
            startIcon={<CheckCircleIcon />}
          >
            On Track ({stats.onTrack})
          </Button>
        </ButtonGroup>
      </Box>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 rounded-t-xl">
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="space-between" 
            flexWrap="wrap" 
            gap={2}
          >
            {/* <Box>
              <Typography 
                variant="h6" 
                component="div" 
                fontWeight={600}
                className="!text-gray-900 dark:!text-slate-100"
              >
                Project Status Overview
              </Typography>
              <Typography 
                variant="body2" 
                className="!text-gray-600 dark:!text-slate-400"
              >
                {filteredProjects.length} projects
                {activeFilter !== 'ALL' && (
                  <span> • Filtered by: {activeFilter.replace('_', ' ')}</span>
                )}
              </Typography>
            </Box> */}
            
            <Box display="flex" gap={2} alignItems="center">
              <TextField
                size="small"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white dark:bg-slate-700"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon className="text-gray-500 dark:text-slate-400" />
                    </InputAdornment>
                  ),
                  className: "!text-gray-900 dark:!text-slate-100"
                }}
                sx={{ 
                  minWidth: isMobile ? '200px' : '300px',
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '& fieldset': {
                      borderColor: 'rgb(209 213 219)', // gray-300
                    },
                    '.dark &': {
                      '& fieldset': {
                        borderColor: 'rgb(71 85 105)', // slate-600
                      }
                    }
                  }
                }}
              />
              
              {/* <Tooltip title="Refresh Data">
                <IconButton 
                  onClick={onRefresh} 
                  disabled={loading}
                  className="!bg-blue-600 hover:!bg-blue-700 !text-white"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip> */}
            </Box>
          </Box>
        </div>

        {loading && <LinearProgress className="!bg-blue-100 dark:!bg-slate-700" />}

        {/* Table with proper column widths */}
        <TableContainer 
          className="bg-white dark:bg-slate-900"
          sx={{ 
            maxHeight: isMobile ? 500 : 600,
            overflowX: 'auto'
          }}
        >
          <Table 
            stickyHeader 
            size="small"
            sx={{
              tableLayout: 'fixed',
              width: '100%',
              minWidth: '1400px' // Ensure minimum width for all columns
            }}
          >
            <EnhancedTableHead
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />
            <TableBody>
              {paginatedProjects.map((project, index) => {
                // Apply subtle row highlighting based on risk
                const getRowClasses = (riskLevel, index) => {
                  const baseClasses = "hover:bg-gray-50 dark:hover:bg-slate-800";
                  switch (riskLevel) {
                    case 'CRITICAL':
                      return `bg-red-50 dark:bg-red-950/20 ${baseClasses}`;
                    case 'HIGH':
                      return `bg-orange-50 dark:bg-orange-950/20 ${baseClasses}`;
                    default:
                      return index % 2 === 0 
                        ? `bg-gray-50 dark:bg-slate-800/50 ${baseClasses}` 
                        : `bg-white dark:bg-slate-900 ${baseClasses}`;
                  }
                };

                return (
                  <TableRow
                    key={`project-${project.displaySrNo}`}
                    className={getRowClasses(project.riskLevel, index)}
                  >
                    {/* Sr.No - Fixed width, centered */}
                    <TableCell 
                      align="center"
                      className="!text-blue-600 dark:!text-blue-400 !border-gray-200 dark:!border-slate-700"
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        padding: '8px 6px'
                      }}
                    >
                      {project.displaySrNo}
                    </TableCell>
                    
                    {/* Project No - Fixed width */}
                    <TableCell 
                      className="!text-gray-900 dark:!text-slate-100 !border-gray-200 dark:!border-slate-700"
                      sx={{ 
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        padding: '8px 6px'
                      }}
                    >
                      <Typography variant="body2" component="div">
                        {project.projectNo || 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    {/* Project Title - Expandable width */}
                    <TableCell 
                      className="!text-gray-900 dark:!text-slate-100 !border-gray-200 dark:!border-slate-700"
                      sx={{ 
                        minWidth: '200px',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        padding: '8px 6px'
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        component="div"
                        sx={{ 
                          fontWeight: 500,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                        title={project.projectTitle} // Show full title on hover
                      >
                        {project.projectTitleKey || 'Untitled Project'}
                      </Typography>
                    </TableCell>
                    
                    {/* Client - Fixed width with ellipsis */}
                    <TableCell 
                      className="!text-gray-900 dark:!text-slate-100 !border-gray-200 dark:!border-slate-700"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        padding: '8px 6px'
                      }}
                    >
                      <Typography 
                        variant="body2"
                        title={project.client}
                      >
                        {project.client || 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    {/* Project Manager - Fixed width with ellipsis */}
                    <TableCell 
                      className="!text-gray-900 dark:!text-slate-100 !border-gray-200 dark:!border-slate-700"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        padding: '8px 6px'
                      }}
                    >
                      <Typography 
                        variant="body2"
                        title={project.projectManager}
                      >
                        {project.projectManager || 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    {/* Quality Engineer - Fixed field name */}
                    <TableCell 
                      className="!border-gray-200 dark:!border-slate-700"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        padding: '8px 6px'
                      }}
                    >
                      <Typography 
                        variant="body2"
                        title={project.projectQualityEng}
                        className={project.projectQualityEng && project.projectQualityEng !== 'N/A' 
                          ? "!text-blue-600 dark:!text-blue-400 !font-medium" 
                          : "!text-gray-500 dark:!text-slate-400"
                        }
                      >
                        {project.projectQualityEng || 'N/A'}
                      </Typography>
                    </TableCell>
                    
                    {/* ✅ SOFT-CODED: Billability column - only show if configured as visible */}
                    {isQHSEColumnVisible('qualityBillabilityPercent') && (
                      <TableCell align="center" className="!border-gray-200 dark:!border-slate-700" sx={{ padding: '8px 4px' }}>
                        <Chip
                          label={formatPercentage(project.qualityBillabilityPercent)}
                          color={getChipColor(project.qualityBillabilityPercent, "billability")}
                          size="small"
                          sx={{ minWidth: '55px', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                    )}
                    
                    <TableCell align="center" className="!border-gray-200 dark:!border-slate-700" sx={{ padding: '8px 4px' }}>
                      <Chip
                        label={formatNumber(project.carsOpen)}
                        color={getChipColor(project.carsOpen, "cars")}
                        size="small"
                        sx={{ minWidth: '40px', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    
                    <TableCell align="center" className="!border-gray-200 dark:!border-slate-700" sx={{ padding: '8px 4px' }}>
                      <Chip
                        label={formatNumber(project.obsOpen)}
                        color={getChipColor(project.obsOpen, "obs")}
                        size="small"
                        sx={{ minWidth: '40px', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    
                    <TableCell align="center" className="!border-gray-200 dark:!border-slate-700" sx={{ padding: '8px 4px' }}>
                      <Chip
                        label={formatPercentage(project.projectKPIsAchievedPercent)}
                        color={getChipColor(project.projectKPIsAchievedPercent, "kpi")}
                        size="small"
                        sx={{ minWidth: '50px', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    
                    <TableCell align="center" className="!border-gray-200 dark:!border-slate-700" sx={{ padding: '8px 4px' }}>
                      <Chip
                        label={`${formatNumber(project.delayInAuditsNoDays)}d`}
                        color={formatNumber(project.delayInAuditsNoDays) > 0 ? "error" : "success"}
                        size="small"
                        sx={{ minWidth: '45px', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    
                    <TableCell align="center" className="!border-gray-200 dark:!border-slate-700" sx={{ padding: '8px 4px' }}>
                      <Chip
                        label={formatPercentage(project.projectCompletionPercent)}
                        color={getChipColor(project.projectCompletionPercent, "kpi")}
                        size="small"
                        sx={{ minWidth: '55px', fontWeight: 600, fontSize: '0.75rem' }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {paginatedProjects.length === 0 && (
                <TableRow>
                  <TableCell 
                    colSpan={12} 
                    align="center" 
                    className="!text-gray-500 dark:!text-slate-400 !border-gray-200 dark:!border-slate-700"
                    sx={{ py: 6 }}
                  >
                    <Typography variant="h6" className="!text-gray-500 dark:!text-slate-400" gutterBottom>
                      {searchTerm ? 'No projects match your search' : `No ${activeFilter.toLowerCase().replace('_', ' ')} projects found`}
                    </Typography>
                    {searchTerm && (
                      <Typography variant="body2" className="!text-gray-400 dark:!text-slate-500">
                        Try adjusting your search terms or clear the filter
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Enhanced Pagination */}
        <div className="border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 rounded-b-xl">
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            component="div"
            count={filteredProjects.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            className="!text-gray-900 dark:!text-slate-100"
            sx={{
              '& .MuiTablePagination-toolbar': {
                minHeight: '52px'
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontWeight: 500
              },
              '& .MuiIconButton-root': {
                color: 'inherit'
              }
            }}
          />
        </div>
      </div>
    </Box>
  );
};

export default ProjectStatus;