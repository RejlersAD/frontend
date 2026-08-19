import React, { useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import {
  FileText,
  Clock,
  Eye,
  MessageCircle,
  Users,
  Maximize2,
  Minimize2
} from 'lucide-react';
import Modal from '@mui/material/Modal';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Tooltip from '@mui/material/Tooltip';
import OverviewCard from '../ui/OverviewCard';
import OverviewTable from '../ui/OverviewTable';

// Icon and color mapping (reuse from SummaryCards)
const iconMap = {
  "Total Spot Checks": <FileText className="w-8 h-8 text-blue-500 dark:text-blue-400" />,
  "Unique Clients": <MessageCircle className="w-8 h-8 text-orange-500 dark:text-orange-400" />,
  "QHSE Engineers": <Eye className="w-8 h-8 text-gray-500 dark:text-gray-400" />,
  "Categories": <Clock className="w-8 h-8 text-green-500 dark:text-green-400" />,
  "Most Active Engineer": <Users className="w-8 h-8 text-purple-500 dark:text-purple-400" />
};

const getCardClasses = (color) => {
  const colorMap = {
    blue: "border-l-4 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30",
    orange: "border-l-4 border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-950/30",
    green: "border-l-4 border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-950/30",
    purple: "border-l-4 border-purple-500 dark:border-purple-500 bg-purple-50 dark:bg-purple-950/30",
    gray: "border-l-4 border-gray-500 dark:border-gray-400 bg-gray-50 dark:bg-gray-950/30"
  };
  return colorMap[color] || colorMap.blue;
};

const getValueClasses = (color) => {
  const colorMap = {
    blue: "text-blue-800 dark:text-blue-300",
    orange: "text-orange-800 dark:text-orange-300",
    green: "text-green-800 dark:text-green-300",
    purple: "text-purple-800 dark:text-purple-300",
    gray: "text-gray-800 dark:text-gray-300"
  };
  return colorMap[color] || colorMap.blue;
};

// Modal theme colors (same logic as SummaryCards)
const getThemeColors = (title) => {
  const themes = {
    "Total Spot Checks": { header: "bg-blue-100 dark:bg-blue-900", hover: "hover:bg-blue-50 dark:hover:bg-blue-950/30", button: "!text-blue-600 dark:!text-blue-400" },
    "Unique Clients": { header: "bg-orange-100 dark:bg-orange-900", hover: "hover:bg-orange-50 dark:hover:bg-orange-950/30", button: "!text-orange-600 dark:!text-orange-400" },
    "QHSE Engineers": { header: "bg-gray-100 dark:bg-gray-900", hover: "hover:bg-gray-50 dark:hover:bg-gray-950/30", button: "!text-gray-600 dark:!text-gray-400" },
    "Categories": { header: "bg-green-100 dark:bg-green-900", hover: "hover:bg-green-50 dark:hover:bg-green-950/30", button: "!text-green-600 dark:!text-green-400" },
    "Most Active Engineer": { header: "bg-purple-100 dark:bg-purple-900", hover: "hover:bg-purple-50 dark:hover:bg-purple-950/30", button: "!text-purple-600 dark:!text-purple-400" }
  };
  return themes[title] || themes["Total Spot Checks"];
};

// Helper functions
const getUnique = (arr, key) => [...new Set(arr.map(item => item[key]).filter(Boolean))];
const getMostFrequent = (arr, key) => {
  const freq = {};
  arr.forEach(item => {
    const val = item[key];
    if (val) freq[val] = (freq[val] || 0) + 1;
  });
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : 'N/A';
};

const SpotCheckSummaryCards = ({ spotCheckData = [] }) => {
  // Metrics
  const totalChecks = spotCheckData.length;
  const totalClients = getUnique(spotCheckData, 'client').length;
  const totalEngineers = getUnique(spotCheckData, 'qhseEngineer').length;
  const totalCategories = getUnique(spotCheckData, 'category').length;
  const mostFrequentCategory = getMostFrequent(spotCheckData, 'category');
  const mostActiveEngineer = getMostFrequent(spotCheckData, 'qhseEngineer');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState([]);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleCardClick = (title, filterFn) => {
    setModalTitle(title);
    setModalData(filterFn ? spotCheckData.filter(filterFn) : spotCheckData);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalTitle('');
    setModalData([]);
    setIsFullScreen(false);
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  // Cards config
  const summaryCards = [
    {
      title: "Total Spot Checks",
      value: totalChecks,
      description: "All spot checks recorded",
      icon: iconMap["Total Spot Checks"],
      color: "blue",
      filterFn: null
    },
    {
      title: "Unique Clients",
      value: totalClients,
      description: "Clients involved in spot checks",
      icon: iconMap["Unique Clients"],
      color: "orange",
      filterFn: null
    },
    {
      title: "QHSE Engineers",
      value: totalEngineers,
      description: "Engineers who performed spot checks",
      icon: iconMap["QHSE Engineers"],
      color: "gray",
      filterFn: null
    },
    {
      title: "Categories",
      value: totalCategories,
      description: `Most frequent: ${mostFrequentCategory}`,
      icon: iconMap["Categories"],
      color: "green",
      filterFn: row => row.category === mostFrequentCategory
    },
    {
      title: "Most Active Engineer",
      value: mostActiveEngineer,
      description: "Engineer with most spot checks",
      icon: iconMap["Most Active Engineer"],
      color: "purple",
      filterFn: row => row.qhseEngineer === mostActiveEngineer
    }
  ];

  // Modal columns (short labels, tooltips)
  const modalColumns = [
    { key: 'srNo', label: 'Sr No', fullLabel: 'Serial Number', width: '70px' },
    { key: 'projectNo', label: 'Project No', fullLabel: 'Project Number', width: '110px' },
    { key: 'projectTitle', label: 'Project Title', fullLabel: 'Project Title', width: '160px', truncate: true },
    { key: 'client', label: 'Client', fullLabel: 'Client', width: '120px' },
    { key: 'qhseEngineer', label: 'QHSE Engineer', fullLabel: 'QHSE Engineer', width: '130px' },
    { key: 'dateOfSpotCheck', label: 'Date', fullLabel: 'Date of Spot Check', width: '100px' },
    { key: 'time', label: 'Time', fullLabel: 'Time', width: '80px' },
    { key: 'documentNo', label: 'Doc No.', fullLabel: 'Document Number', width: '120px' },
    { key: 'documentTitle', label: 'Doc Title', fullLabel: 'Document Title', width: '180px', truncate: true },
    { key: 'originatorLead', label: 'Originator/Lead', fullLabel: 'Originator / Lead', width: '130px' },
    { key: 'comments', label: 'Comments', fullLabel: 'Comments', width: '200px', truncate: true },
    { key: 'category', label: 'Category', fullLabel: 'Category', width: '90px' },
    { key: 'remarks', label: 'Remarks', fullLabel: 'Remarks', width: '160px', truncate: true }
  ];

  // Modal styles
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
      top: '5%',
      left: '50%',
      transform: 'translate(-50%, 0)',
      bgcolor: 'background.paper',
      width: { xs: '98vw', sm: '95vw', md: '90vw', lg: '85vw', xl: '1200px' },
      maxHeight: '85vh',
      overflowY: 'auto',
      outline: 'none',
      borderRadius: 3,
      p: 2
    };
  };

  // Get theme colors for modal
  const themeColors = getThemeColors(modalTitle);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 flex items-center">
            <Eye className="w-5 h-5 mr-2" />
            SPOT CHECK OVERVIEW
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {summaryCards.map((item, index) => (
              <OverviewCard
                key={index}
                title={item.title}
                value={item.value}
                 valueColor={getValueClasses(item.color)}
                description={item.description}
                icon={item.icon}
                color={getCardClasses(item.color)}
                onClick={() => handleCardClick(item.title, item.filterFn)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Modal for details */}
      <Modal open={modalOpen} onClose={handleCloseModal} sx={{ zIndex: 1300 }}>
        <Box sx={getModalStyles()}>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className={`font-bold text-xl ${themeColors.button.replace('!text', 'text')}`}>{modalTitle}</h2>
              <div className="flex items-center gap-2">
                <Tooltip title={isFullScreen ? "Exit Full Screen" : "Full Screen"} arrow>
                  <IconButton onClick={toggleFullScreen}>
                    {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Close" arrow>
                  <IconButton onClick={handleCloseModal}>
                    <CloseIcon />
                  </IconButton>
                </Tooltip>
              </div>
            </div>
            <div className={`overflow-hidden border border-gray-200 dark:border-slate-700 rounded-lg ${isFullScreen ? 'h-full' : ''}`}>
              <div
                style={{
                  maxHeight: isFullScreen ? '100%' : '70vh',
                  overflowY: 'auto',
                  overflowX: 'auto'
                }}
                className="bg-white dark:bg-slate-900"
              >
                <OverviewTable columns={modalColumns} data={modalData} headerClass={themeColors.header} />
              </div>
            </div>
          </div>
        </Box>
      </Modal>
    </>
  );
};

export default SpotCheckSummaryCards;