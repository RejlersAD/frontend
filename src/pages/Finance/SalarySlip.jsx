/**
 * Salary Slip Page - SOFT-CODED
 * Manage and generate employee salary slips
 * Configuration-driven for easy customization
 * Connected to Django REST API
 */

import { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  CalendarIcon, 
  UserIcon, 
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  FunnelIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import financeService from '../../services/finance.service';

// SOFT-CODED: Salary slip configuration
const SALARY_SLIP_CONFIG = {
  title: 'Salary Slip Management',
  description: 'Generate and manage employee salary slips',
  api: {
    baseUrl: '/api/v1/finance',
    endpoints: {
      salarySlips: '/salary-slips/',
      stats: '/salary-slips/stats/',
      generatePdf: (id) => `/salary-slips/${id}/generate_pdf/`,
      sendEmail: (id) => `/salary-slips/${id}/send_email/`,
      bulkSendEmail: '/salary-slips/bulk_send_email/',
      approve: (id) => `/salary-slips/${id}/approve/`,
      reject: (id) => `/salary-slips/${id}/reject/`,
    }
  },
  features: {
    generate: {
      enabled: true,
      label: 'Generate Salary Slip',
      icon: PlusIcon
    },
    search: {
      enabled: true,
      placeholder: 'Search by employee name, ID, or month...'
    },
    filters: {
      enabled: true,
      options: [
        { value: '', label: 'All Status' },
        { value: 'generated', label: 'Generated' },
        { value: 'pending_approval', label: 'Pending Approval' },
        { value: 'approved', label: 'Approved' },
        { value: 'sent', label: 'Sent' },
        { value: 'archived', label: 'Archived' }
      ]
    },
    export: {
      enabled: true,
      formats: ['PDF', 'Excel']
    }
  },
  columns: [
    { id: 'employee_name', label: 'Employee Name', sortable: true },
    { id: 'employee_id', label: 'Employee ID', sortable: true },
    { id: 'month_year', label: 'Month', sortable: true },
    { id: 'gross_salary', label: 'Gross Salary', sortable: true, format: 'currency' },
    { id: 'total_deductions', label: 'Deductions', sortable: true, format: 'currency' },
    { id: 'net_salary', label: 'Net Salary', sortable: true, format: 'currency' },
    { id: 'status', label: 'Status', sortable: false },
    { id: 'actions', label: 'Actions', sortable: false }
  ],
  statuses: {
    draft: { label: 'Draft', color: 'gray' },
    generated: { label: 'Generated', color: 'blue' },
    pending_approval: { label: 'Pending', color: 'yellow' },
    approved: { label: 'Approved', color: 'green' },
    rejected: { label: 'Rejected', color: 'red' },
    sent: { label: 'Sent', color: 'indigo' },
    archived: { label: 'Archived', color: 'gray' }
  }
};

export default function SalarySlip() {
  // State management
  const [salarySlips, setSalarySlips] = useState([]);
  const [stats, setStats] = useState({
    total_slips: 0,
    generated: 0,
    pending_approval: 0,
    approved: 0,
    sent: 0,
    total_employees: 0,
    total_payroll: '0.00',
    current_month_slips: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSlips, setSelectedSlips] = useState([]);

  // Fetch data on component mount
  useEffect(() => {
    fetchStats();
    fetchSalarySlips();
  }, [statusFilter, searchQuery]);

  const fetchStats = async () => {
    try {
      const response = await financeService.getSalarySlipStats();
      setStats(response.data || stats);
    } catch (error) {
      console.error('Error fetching salary slip stats:', error);
    }
  };

  const fetchSalarySlips = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      
      const response = await financeService.getSalarySlips(params);
      
      // Handle different response formats (direct array or paginated)
      let data = [];
      if (response.data) {
        // Check if it's a paginated response with 'results' property
        if (response.data.results && Array.isArray(response.data.results)) {
          data = response.data.results;
        } 
        // Check if it's a direct array
        else if (Array.isArray(response.data)) {
          data = response.data;
        }
        // Otherwise use empty array as fallback
        else {
          data = [];
        }
      }
      
      setSalarySlips(data);
    } catch (error) {
      console.error('Error fetching salary slips:', error);
      setSalarySlips([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async (slipId) => {
    try {
      await financeService.generateSalarySlipPDF(slipId);
      alert('PDF generated successfully!');
      fetchSalarySlips();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  const handleSendEmail = async (slipId) => {
    try {
      await financeService.sendSalarySlipEmail(slipId);
      alert('Email sent successfully!');
      fetchSalarySlips();
      fetchStats();
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email');
    }
  };

  const handleBulkSendEmail = async () => {
    if (selectedSlips.length === 0) {
      alert('Please select slips to send');
      return;
    }

    try {
      const response = await financeService.bulkSendSalarySlipEmails(selectedSlips);
      alert(`Emails sent: ${response.data.success_count} success, ${response.data.failed_count} failed`);
      setSelectedSlips([]);
      fetchSalarySlips();
      fetchStats();
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      alert('Failed to send emails');
    }
  };

  const handleApprove = async (slipId) => {
    try {
      await financeService.approveSalarySlip(slipId);
      alert('Salary slip approved!');
      fetchSalarySlips();
      fetchStats();
    } catch (error) {
      console.error('Error approving slip:', error);
      alert('Failed to approve');
    }
  };

  const formatCurrency = (amount, currency = 'AED') => {
    return `${currency} ${parseFloat(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = SALARY_SLIP_CONFIG.statuses[status] || SALARY_SLIP_CONFIG.statuses.draft;
    const colorClasses = {
      gray: 'bg-gray-100 text-gray-800',
      blue: 'bg-blue-100 text-blue-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      red: 'bg-red-100 text-red-800',
      indigo: 'bg-indigo-100 text-indigo-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses[statusConfig.color]}`}>
        {statusConfig.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{SALARY_SLIP_CONFIG.title}</h1>
        <p className="text-gray-600 mt-1">{SALARY_SLIP_CONFIG.description}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Slips</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_slips}</p>
            </div>
            <DocumentTextIcon className="h-12 w-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Generated</p>
              <p className="text-2xl font-bold text-green-600">{stats.generated}</p>
            </div>
            <CheckCircleIcon className="h-12 w-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending_approval}</p>
            </div>
            <CalendarIcon className="h-12 w-12 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.total_employees}</p>
            </div>
            <UserIcon className="h-12 w-12 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={SALARY_SLIP_CONFIG.features.search.placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {SALARY_SLIP_CONFIG.features.filters.options.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedSlips.length > 0 && (
            <button
              onClick={handleBulkSendEmail}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              Send {selectedSlips.length} Email(s)
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading salary slips...</p>
          </div>
        ) : (salarySlips && salarySlips.length === 0) ? (
          <div className="p-12 text-center">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No salary slips found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSlips((salarySlips || []).map(s => s.id));
                        } else {
                          setSelectedSlips([]);
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  {SALARY_SLIP_CONFIG.columns.map(col => (
                    <th key={col.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(salarySlips || []).map((slip) => (
                  <tr key={slip.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedSlips.includes(slip.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSlips([...selectedSlips, slip.id]);
                          } else {
                            setSelectedSlips(selectedSlips.filter(id => id !== slip.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{slip.employee_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{slip.employee_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{slip.month_year}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(slip.gross_salary, slip.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(slip.total_deductions, slip.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{formatCurrency(slip.net_salary, slip.currency)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(slip.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleGeneratePDF(slip.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Generate PDF"
                        >
                          <ArrowDownTrayIcon className="h-5 w-5" />
                        </button>
                        {slip.status === 'approved' || slip.status === 'sent' ? (
                          <button
                            onClick={() => handleSendEmail(slip.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Send Email"
                          >
                            <PaperAirplaneIcon className="h-5 w-5" />
                          </button>
                        ) : null}
                        {slip.status === 'pending_approval' && (
                          <button
                            onClick={() => handleApprove(slip.id)}
                            className="text-green-600 hover:text-green-800"
                            title="Approve"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

