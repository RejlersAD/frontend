import { Tooltip } from '@mui/material';
import { formatDate } from './dateUtils';

const parseNumber = (val) => {
  if (!val || val === '' || val === 'N/A') return 0;
  return Number(val) || 0;
};

const parsePercent = (val) => {
  if (!val || val === '' || val === 'N/A') return 0;
  const cleaned = String(val).replace('%', '');
  return Number(cleaned) || 0;
};

export function getDetailedBadge(project, columnKey, isFullScreen = false) {
  let value = project[columnKey];

  // Project Title Key with tooltip
  if (columnKey === 'projectTitleKey') {
    value = project.projectTitleKey || project.projectTitle || '';
    const fullTitle = project.projectTitle || value;
    const maxLength = isFullScreen ? 60 : 25;
    const truncatedValue = value.length > maxLength ? `${value.substring(0, maxLength)}...` : value;
    return (
      <Tooltip title={fullTitle} arrow placement="top">
        <span className="text-gray-900 dark:text-gray-100">
          {truncatedValue}
        </span>
      </Tooltip>
    );
  }

  // Project Completion %
  if (columnKey === 'projectCompletionPercent') {
    return <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value}
      </span>
    // const numVal = parsePercent(value);
    // const className = numVal === 100 ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-bold" :
    //   numVal > 95 ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-bold" :
    //   numVal >= 90 ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs" :
    //   numVal >= 75 ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs" :
    //   "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs";
    // return <span className={className}>{value}</span>;
  }

  // Rejection Rate
  if (columnKey === 'rejectionOfDeliverablesPercent') {
    return <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value} %
      </span>
    // const numVal = parsePercent(value);
    // const className = numVal === 0 ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs" :
    //   numVal > 10 ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs font-bold" :
    //   numVal > 5 ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded text-xs" :
    //   "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs";
    // return <span className={className}>{value}</span>;
  }

  // Cost of Poor Quality
  if (columnKey === 'costOfPoorQualityAED') {
    const cost = parseNumber(value);
    return <span className="text-purple-800 dark:text-purple-300 font-bold font-mono">{cost.toLocaleString()} AED</span>;
  }

  // CAR/OBS Open
  if (columnKey === 'carsOpen' || columnKey === 'obsOpen') {
    return  <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value}
      </span>
    // const numVal = parseNumber(value);
    // if (numVal === 0) return <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">0</span>;
    // const className = numVal > 3 ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs font-bold" :
    //   "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs";
    // return <span className={className}>{value}</span>;
  }

  // Delayed Closing Days
  if (columnKey === 'carsDelayedClosingNoDays' || columnKey === 'obsDelayedClosingNoDays') {
    return  <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value} days
      </span>
    // const numVal = parseNumber(value);
    // if (numVal === 0) return <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">On Time</span>;
    // const className = numVal > 30 ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs font-bold" :
    //   numVal > 15 ? "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded text-xs" :
    //   "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded text-xs";
    // return <span className={className}>{value} days</span>;
  }

  // Closed CARs/OBS
  if (columnKey === 'carsClosed' || columnKey === 'obsClosed') {
    return  <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value}
      </span>
    // const numVal = parseNumber(value);
    // const className = numVal > 0 ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs" :
    //   "text-gray-400 dark:text-slate-500";
    // return <span className={className}>{value}</span>;
  }

  // Audit delays
  if (columnKey === 'delayInAuditsNoDays') {
    return  <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value} days
      </span>
    // const numVal = parseNumber(value);
    // if (numVal === 0) return <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">On Time</span>;
    // const className = numVal > 15 ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs font-bold" :
    //   "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded text-xs";
    // return <span className={className}>{value} days</span>;
  }

  // Quality Plan status
  if (columnKey === 'projectQualityPlanStatusRev') {
    return (
      <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-xs">
        {value}
      </span>
    );
    // if (!value || value === '' || value === 'N/A') {
    //   return <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded text-xs font-bold">Pending</span>;
    // }
    // return (
    //   <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs">{value}</span>
    // );
  }

  // Date-related columns (grouped)
  const dateColumns = [
    'projectStartingDate',
    'projectClosingDate',
    'projectExtension',
    'projectQualityPlanStatusIssueDate',
    'projectAudit1',
    'projectAudit2',
    'projectAudit3',
    'projectAudit4',
    'clientAudit1',
    'clientAudit2'
  ];
  if (dateColumns.includes(columnKey)) {
    const parsedDate = formatDate(value);
    if (parsedDate !== 'N/A') {
      return (
        <span className="text-gray-700 dark:text-gray-300 text-sm">
          {parsedDate}
        </span>
      );
    }
  }

  // Hours (numerical values)
  if (['manHourForQuality', 'manhoursUsed', 'manhoursBalance'].includes(columnKey)) {
    const numVal = parseNumber(value);
    return <span className="text-gray-900 dark:text-gray-100 font-mono">{numVal.toLocaleString()}</span>;
  }

  // For all other columns, return null (will use common badge in component)
  return null;
}