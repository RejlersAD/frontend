import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import {
  Calendar as CalendarIcon,
  Users as UsersIcon,
  TrendingUp as TrendingUpIcon,
  Filter as FilterIcon,
  RefreshCw as RefreshIcon
} from 'lucide-react';

// Month names array (moved from data file since it's static)
const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const Filters = ({
  selectedYear,
  setSelectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedClient,
  setSelectedClient,
  selectedKPIStatus,
  setSelectedKPIStatus,
  resetFilters,
  filteredProjects,
  getUniqueYears,
  getUniqueClients,
  totalProjects // Add this prop to get total count from Google Sheets
}) => {
  return (
    <Card className="mb-6 dark:bg-gray-900 dark:border-gray-800">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 gap-y-3 items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center mb-2 sm:mb-0">
            <FilterIcon className="w-5 h-5 mr-2 text-blue-500" />
            Filters
          </h3>

          {/* Year Filter */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <CalendarIcon className="w-4 h-4 text-blue-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Year:</label>
            <select
              aria-label="Filter by year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full sm:w-auto px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Years</option>
              {getUniqueYears().map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <CalendarIcon className="w-4 h-4 text-blue-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Month:</label>
            <select
              aria-label="Filter by month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Months</option>
              {monthNames.map((month, index) => (
                <option key={index + 1} value={(index + 1).toString()}>{month}</option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <UsersIcon className="w-4 h-4 text-blue-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Client:</label>
            <select
              aria-label="Filter by client"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full sm:w-auto px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Clients</option>
              {getUniqueClients().map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>

          {/* KPI Status Filter */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <TrendingUpIcon className="w-4 h-4 text-blue-500" />
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">KPI Status:</label>
            <select
              aria-label="Filter by KPI status"
              value={selectedKPIStatus}
              onChange={(e) => setSelectedKPIStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="Green">🟢 Green</option>
              <option value="Yellow">🟡 Yellow</option>
              <option value="Red">🔴 Red</option>
            </select>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetFilters}
            aria-label="Reset all filters"
            className="flex items-center px-4 py-1 w-full sm:w-auto bg-blue-50 dark:bg-gray-800 text-blue-700 dark:text-blue-300 rounded-md text-sm hover:bg-blue-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            title="Reset all filters"
          >
            <RefreshIcon className="w-4 h-4 mr-1" />
            Reset
          </button>

          {/* Results Counter - Now uses Google Sheets data */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-gray-800 px-3 py-1 rounded-full border border-blue-200 dark:border-gray-700">
              📊 {filteredProjects.length} of {totalProjects || 0} projects
            </span>
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedYear !== "all" || selectedMonth !== "all" || selectedClient !== "all" || selectedKPIStatus !== "all") && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center">
                <FilterIcon className="w-4 h-4 mr-1 text-blue-500" />
                Active Filters:
              </span>
              {selectedYear !== "all" && (
                <Badge variant="blue" className="flex items-center gap-1 dark:bg-gray-800 dark:text-blue-300">
                  <CalendarIcon className="w-3 h-3 text-blue-400" />
                  {selectedYear}
                </Badge>
              )}
              {selectedMonth !== "all" && (
                <Badge variant="blue" className="flex items-center gap-1 dark:bg-gray-800 dark:text-blue-300">
                  <CalendarIcon className="w-3 h-3 text-blue-400" />
                  {monthNames[parseInt(selectedMonth) - 1]}
                </Badge>
              )}
              {selectedClient !== "all" && (
                <Badge variant="blue" className="flex items-center gap-1 dark:bg-gray-800 dark:text-blue-300">
                  <UsersIcon className="w-3 h-3 text-blue-400" />
                  {selectedClient}
                </Badge>
              )}
              {selectedKPIStatus !== "all" && (
                <Badge variant="blue" className="flex items-center gap-1 dark:bg-gray-800 dark:text-blue-300">
                  <TrendingUpIcon className="w-3 h-3 text-blue-400" />
                  {selectedKPIStatus}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Filters;