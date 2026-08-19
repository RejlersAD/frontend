import React, { useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { DollarSign, Maximize2, Minimize2 } from 'lucide-react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import { getDetailedBadge } from '../../utils/BadgeUtils'; // Add this import
import OverviewCard from '../ui/OverviewCard';
import OverviewTable from '../ui/OverviewTable';

/**
 * BILLABILITY CARD COMPONENT - Enhanced with full-screen modal
 */

// Helper functions
const parseNumber = (val) => {
  if (!val || val === '' || val === 'N/A') return 0;
  return Number(val) || 0;
};

const parsePercent = (val) => {
  if (!val || val === '' || val === 'N/A') return 0;
  const cleaned = String(val).replace('%', '');
  return Number(cleaned) || 0;
};

const isValidProject = (project) => {
  return project && 
         project.projectNo && 
         project.projectNo !== '' && 
         project.projectNo !== 'N/A' &&
         project.projectTitle &&
         project.projectTitle !== '' &&
         project.projectTitle !== 'N/A';
};

// ✅ NEW: Helper function to get column information with short and full labels
const getColumnInfo = (key) => {
  const columnMap = {
    // Base columns
    'projectNo': { short: 'Project No', full: 'Project No' },
    'projectTitleKey': { short: 'Project Title', full: 'Project Title' },
    'projectManager': { short: 'Project Manager', full: 'Project Manager' },
    'client': { short: 'Client', full: 'Client' },
    
    // Billability specific
    'manHourForQuality': { short: 'Quality Hours', full: 'Man Hour for Quality' },
    'manhoursUsed': { short: 'Hours Used', full: 'Manhours Used' },
    'manhoursBalance': { short: 'Hours Balance', full: 'Manhours Balance' },
    'qualityBillabilityPercent': { short: 'Billability %', full: 'Quality Billability Percent' }
  };
  
  return columnMap[key] || { short: key, full: key };
};

// ✅ UPDATED: Enhanced modal columns with column info
const getModalColumns = () => {
  return [
    { 
      key: 'projectNo', 
      label: getColumnInfo('projectNo').short,
      fullLabel: getColumnInfo('projectNo').full,
      width: '120px', 
      minWidth: '100px' 
    },
    { 
      key: 'projectTitleKey', 
      label: getColumnInfo('projectTitleKey').short,
      fullLabel: getColumnInfo('projectTitleKey').full,
      width: '100px', 
      minWidth: '200px', 
      truncate: true 
    },
    { 
      key: 'projectManager', 
      label: getColumnInfo('projectManager').short,
      fullLabel: getColumnInfo('projectManager').full,
      width: '150px', 
      minWidth: '120px' 
    },
    { 
      key: 'client', 
      label: getColumnInfo('client').short,
      fullLabel: getColumnInfo('client').full,
      width: '150px', 
      minWidth: '120px' 
    },
    { 
      key: 'manHourForQuality', 
      label: getColumnInfo('manHourForQuality').short,
      fullLabel: getColumnInfo('manHourForQuality').full,
      width: '120px', 
      minWidth: '100px' 
    },
    { 
      key: 'manhoursUsed', 
      label: getColumnInfo('manhoursUsed').short,
      fullLabel: getColumnInfo('manhoursUsed').full,
      width: '120px', 
      minWidth: '100px' 
    },
    { 
      key: 'manhoursBalance', 
      label: getColumnInfo('manhoursBalance').short,
      fullLabel: getColumnInfo('manhoursBalance').full,
      width: '120px', 
      minWidth: '100px' 
    },
    { 
      key: 'qualityBillabilityPercent', 
      label: getColumnInfo('qualityBillabilityPercent').short,
      fullLabel: getColumnInfo('qualityBillabilityPercent').full,
      width: '120px', 
      minWidth: '100px' 
    }
  ];
};

// ✅ ENHANCED: Cell formatting with projectTitleKey support
const getCellValue = (project, columnKey, isFullScreen = false) => {
  let value = project[columnKey];

  // Empty or N/A
  if (!value || value === '' || value === 'N/A') {
    return (
      <div className="flex justify-center items-center py-1">
        <span className="text-gray-400 dark:text-slate-500 font-medium">−</span>
      </div>
    );
  }

  // Use centralized badge logic for all columns
  const detailedBadge = getDetailedBadge(project, columnKey, isFullScreen);
  if (detailedBadge) return detailedBadge;

  // Common badge style for all other columns
  return (
    <span className="text-gray-900 dark:text-gray-100">
      {value}
    </span>
  );
};

const BillabilityCard = ({ filteredProjects = [] }) => {
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Filter valid projects
  const validProjects = filteredProjects.filter(project => isValidProject(project));
  
  // Filter projects with billability data
  const projectsWithBillability = validProjects.filter(project => 
    (project.qualityBillabilityPercent && project.qualityBillabilityPercent !== 'N/A') ||
    (project.manHourForQuality && parseNumber(project.manHourForQuality) > 0) ||
    (project.manhoursUsed && parseNumber(project.manhoursUsed) >= 0)
  );

  // Handle card click
  const handleCardClick = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setIsFullScreen(false);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const modalColumns = getModalColumns();

  // Dynamic modal styles
  const getModalStyles = () => {
    if (isFullScreen) {
      return {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'transparent',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden'
      };
    }
    
    return {
      position: 'fixed',
      top: '3%',
      left: '50%',
      transform: 'translate(-50%, 0)',
      bgcolor: 'transparent',
      width: { xs: '98vw', sm: '95vw', md: '90vw', lg: '85vw', xl: '1200px' },
      maxHeight: '94vh',
      overflowY: 'auto',
      outline: 'none',
    };
  };

  const getPaperStyles = () => {
    if (isFullScreen) {
      return {
        borderRadius: 0,
        width: '100%',
        height: '100%',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column'
      };
    }
    
    return {
      borderRadius: 3,
      p: { xs: 2, sm: 3 },
      position: 'relative'
    };
  };

  return (
    <>
      <OverviewCard
        title="Billability Overview"
        value={projectsWithBillability.length}
        valueColor="text-purple-800 dark:text-purple-300" // <-- Add this line
        description="Projects with quality billability tracking"
        icon={<DollarSign className="w-8 h-8 text-purple-500 dark:text-purple-400" />}
        color="border-l-4 border-purple-500 dark:border-purple-500 bg-purple-50 dark:bg-purple-950/30"
        onClick={handleCardClick}
      />

      {/* ✅ ENHANCED: Modal with tooltips on column headers */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        sx={{ zIndex: 1300 }}
      >
        <Box sx={getModalStyles()}>
          <Paper 
            elevation={6} 
            className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700"
            sx={getPaperStyles()}
          >
            {/* Enhanced Header with Full-screen Toggle */}
            <div className={`flex items-center justify-between ${isFullScreen ? 'p-4' : 'pb-0'}`}>
              <div className="flex-1">
                <h2 className="font-bold text-xl text-purple-700 dark:text-purple-400">
                  Billability Overview - Project Details
                </h2>
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  Showing {projectsWithBillability.length} project{projectsWithBillability.length !== 1 ? 's' : ''} with billability data
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Tooltip title={isFullScreen ? "Exit Full Screen" : "Full Screen"} arrow>
                  <IconButton
                    onClick={toggleFullScreen}
                    className="!text-purple-600 dark:!text-purple-400 hover:!text-purple-800 dark:hover:!text-purple-200"
                  >
                    {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </IconButton>
                </Tooltip>
                
                <Tooltip title="Close" arrow>
                  <IconButton
                    onClick={handleCloseModal}
                    className="!text-gray-500 dark:!text-slate-400 hover:!text-gray-700 dark:hover:!text-slate-200"
                  >
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
            
            {/* Enhanced Table Container */}
            <div className={`${isFullScreen ? 'flex-1 overflow-hidden p-4 pt-0' : ''}`}>
              {projectsWithBillability.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-slate-400 text-lg">
                    No projects found with billability data.
                  </p>
                </div>
              ) : (
                <div className={`overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg ${isFullScreen ? 'h-full' : ''}`}>
                  <div 
                    style={{ 
                      maxHeight: isFullScreen ? '100%' : '70vh', 
                      overflowY: 'auto', 
                      overflowX: 'auto' 
                    }} 
                    className="bg-white dark:bg-slate-900"
                  >
                    <OverviewTable
                      columns={modalColumns}
                      data={projectsWithBillability}
                      headerClass="bg-purple-100 dark:bg-purple-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </Paper>
        </Box>
      </Modal>
    </>
  );
};

export default BillabilityCard;