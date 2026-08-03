import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  REPORT_TYPES,
  KEY_METRICS,
  DASHBOARD_WIDGETS,
  EXPORT_FORMATS,
  SCHEDULING_OPTIONS,
  REPORT_BRANDING
} from '../../config/reportGenerator.config';
import { REJLERS_COLORS } from '../../config/theme.config';

/**
 * ============================================
 * REPORT GENERATOR MAIN COMPONENT
 * ============================================
 * 
 * Advanced report generation system with AI-powered insights,
 * predictive analytics, and automated scheduling for CEO meetings.
 */

const ReportGenerator = () => {
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [recentReports, setRecentReports] = useState([]);
  const [scheduledReports, setScheduledReports] = useState([]);

  // Simulate loading recent reports
  useEffect(() => {
    // In production, fetch from API
    setRecentReports([
      {
        id: 1,
        type: 'executive_summary',
        name: 'Executive Summary - December 2025',
        generatedAt: '2025-12-31T08:00:00Z',
        format: 'pdf',
        size: '2.4 MB',
        status: 'completed'
      },
      {
        id: 2,
        type: 'department_performance',
        name: 'AIML Department Performance - Q4 2025',
        generatedAt: '2025-12-28T10:30:00Z',
        format: 'excel',
        size: '1.8 MB',
        status: 'completed'
      },
      {
        id: 3,
        type: 'feature_analytics',
        name: 'Feature Analytics - Week 52',
        generatedAt: '2025-12-25T09:00:00Z',
        format: 'pdf',
        size: '3.1 MB',
        status: 'completed'
      }
    ]);

    setScheduledReports([
      {
        id: 1,
        type: 'executive_summary',
        frequency: 'weekly',
        nextRun: '2026-02-03T08:00:00Z',
        recipients: ['ceo@company.com', 'cto@company.com'],
        format: 'pdf',
        active: true
      },
      {
        id: 2,
        type: 'department_performance',
        frequency: 'monthly',
        nextRun: '2026-02-01T08:00:00Z',
        recipients: ['department-heads@company.com'],
        format: 'excel',
        active: true
      }
    ]);
  }, []);

  const handleGenerateReport = async (reportType) => {
    setIsGenerating(true);
    setSelectedReport(reportType);
    
    // Simulate report generation
    setTimeout(() => {
      setIsGenerating(false);
      alert(`✅ Report "${REPORT_TYPES[reportType].name}" generated successfully!`);
      // In production, trigger actual report generation API
    }, 3000);
  };

  const renderQuickStats = () => {
    const stats = [
      {
        label: 'Total Reports',
        value: '147',
        trend: '+12%',
        icon: '📊',
        color: REJLERS_COLORS.secondary.green.base
      },
      {
        label: 'Scheduled Reports',
        value: scheduledReports.filter(r => r.active).length,
        trend: '+2',
        icon: '⏰',
        color: REJLERS_COLORS.secondary.turbine.base
      },
      {
        label: 'This Month',
        value: '23',
        trend: '+5',
        icon: '📈',
        color: REJLERS_COLORS.primary.accent
      },
      {
        label: 'AI Insights',
        value: '42',
        trend: '+18%',
        icon: '🔮',
        color: REJLERS_COLORS.secondary.passion.base
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-lg p-6 border-l-4 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            style={{ borderLeftColor: stat.color }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-3xl">{stat.icon}</span>
              <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                {stat.trend}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderReportTypes = () => {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">📋 Report Templates</h2>
          <Link
            to="/admin/reports/templates"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:shadow-md"
            style={{ 
              backgroundColor: REJLERS_COLORS.secondary.green.base,
              color: 'white'
            }}
          >
            View All Templates
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(REPORT_TYPES).map(([key, report]) => (
            <div
              key={key}
              className="bg-gradient-to-br from-white to-gray-50 rounded-lg border-2 border-gray-200 p-6 hover:border-green-400 hover:shadow-lg transition-all duration-300 cursor-pointer group"
              onClick={() => handleGenerateReport(key)}
            >
              <div className="text-4xl mb-3">{report.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                {report.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {report.description}
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center text-xs text-gray-500">
                  <span className="mr-2">⏱️</span>
                  <span>{report.estimatedTime}</span>
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <span className="mr-2">📅</span>
                  <span>{report.frequency.join(', ')}</span>
                </div>
                {report.aiPowered && (
                  <div className="flex items-center text-xs font-semibold text-purple-600">
                    <span className="mr-2">🤖</span>
                    <span>AI Powered</span>
                  </div>
                )}
              </div>

              <button
                className="w-full mt-4 py-2 px-4 rounded-lg font-semibold text-sm transition-all group-hover:shadow-md"
                style={{
                  backgroundColor: REJLERS_COLORS.secondary.green.base,
                  color: 'white'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerateReport(key);
                }}
              >
                Generate Now
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRecentReports = () => {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 Recent Reports</h2>
        
        <div className="space-y-4">
          {recentReports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all border border-gray-200 hover:border-green-300"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="text-3xl">
                  {EXPORT_FORMATS[report.format].icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{report.name}</h4>
                  <p className="text-sm text-gray-600">
                    Generated {new Date(report.generatedAt).toLocaleDateString()} at{' '}
                    {new Date(report.generatedAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-sm text-gray-500">{report.size}</div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm font-semibold"
                  onClick={() => alert('Viewing report...')}
                >
                  👁️ View
                </button>
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold"
                  onClick={() => alert('Downloading report...')}
                >
                  ⬇️ Download
                </button>
                <button
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all text-sm font-semibold"
                  onClick={() => alert('Sharing report...')}
                >
                  📤 Share
                </button>
              </div>
            </div>
          ))}
        </div>

        {recentReports.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-lg">No reports generated yet</p>
            <p className="text-sm mt-2">Generate your first report to get started</p>
          </div>
        )}
      </div>
    );
  };

  const renderScheduledReports = () => {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">⏰ Scheduled Reports</h2>
          <button
            className="px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:shadow-md"
            style={{
              backgroundColor: REJLERS_COLORS.secondary.turbine.base,
              color: 'white'
            }}
            onClick={() => alert('Create new schedule')}
          >
            ➕ New Schedule
          </button>
        </div>

        <div className="space-y-4">
          {scheduledReports.map((schedule) => (
            <div
              key={schedule.id}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-all"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="text-3xl">
                  {REPORT_TYPES[schedule.type].icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {REPORT_TYPES[schedule.type].name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {SCHEDULING_OPTIONS.frequencies[schedule.frequency].label} •{' '}
                    Next run: {new Date(schedule.nextRun).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Recipients: {schedule.recipients.join(', ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    schedule.active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {schedule.active ? '✓ Active' : '⏸ Paused'}
                </span>
                <button
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all text-sm"
                  onClick={() => alert('Editing schedule...')}
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {scheduledReports.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">⏰</div>
            <p className="text-lg">No scheduled reports</p>
            <p className="text-sm mt-2">Create a schedule to automate report generation</p>
          </div>
        )}
      </div>
    );
  };

  const renderAIInsights = () => {
    const insights = [
      {
        type: 'success',
        icon: '🎯',
        title: 'Excellent Performance',
        message: 'User engagement is 23% above target this month',
        action: 'View Details',
        color: 'green'
      },
      {
        type: 'warning',
        icon: '⚠️',
        title: 'Attention Needed',
        message: 'Feature adoption for Sales module is below expected rate',
        action: 'Investigate',
        color: 'yellow'
      },
      {
        type: 'info',
        icon: '💡',
        title: 'Optimization Opportunity',
        message: 'API response times can be improved by 15% with caching',
        action: 'Learn More',
        color: 'blue'
      },
      {
        type: 'prediction',
        icon: '🔮',
        title: 'Growth Prediction',
        message: 'User base expected to reach 150 users by March 2026',
        action: 'View Forecast',
        color: 'purple'
      }
    ];

    return (
      <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">🤖 AI Insights & Recommendations</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${
                insight.color === 'green'
                  ? 'bg-green-50 border-green-500'
                  : insight.color === 'yellow'
                  ? 'bg-yellow-50 border-yellow-500'
                  : insight.color === 'blue'
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-purple-50 border-purple-500'
              }`}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{insight.icon}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                  <p className="text-sm text-gray-700 mb-2">{insight.message}</p>
                  <button
                    className={`text-sm font-semibold hover:underline ${
                      insight.color === 'green'
                        ? 'text-green-600'
                        : insight.color === 'yellow'
                        ? 'text-yellow-600'
                        : insight.color === 'blue'
                        ? 'text-blue-600'
                        : 'text-purple-600'
                    }`}
                  >
                    {insight.action} →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              📊 Report Generator
            </h1>
            <p className="text-lg text-gray-600">
              Advanced AI-powered reporting system for executive insights
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/admin/reports/predictive"
              className="px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg transform hover:-translate-y-0.5"
              style={{ backgroundColor: REJLERS_COLORS.secondary.passion.base }}
            >
              🔮 Predictive Insights
            </Link>
            <Link
              to="/admin/reports/analytics"
              className="px-6 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg transform hover:-translate-y-0.5"
              style={{ backgroundColor: REJLERS_COLORS.secondary.turbine.base }}
            >
              📈 Advanced Analytics
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-4 border-b border-gray-200">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '📊' },
            { id: 'templates', label: 'Templates', icon: '📋' },
            { id: 'scheduled', label: 'Scheduled', icon: '⏰' },
            { id: 'history', label: 'History', icon: '📚' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === tab.id
                  ? 'border-b-2 text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={{
                borderBottomColor: activeTab === tab.id ? REJLERS_COLORS.secondary.green.base : 'transparent'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'dashboard' && (
        <>
          {renderQuickStats()}
          {renderAIInsights()}
          {renderReportTypes()}
        </>
      )}

      {activeTab === 'templates' && renderReportTypes()}

      {activeTab === 'scheduled' && renderScheduledReports()}

      {activeTab === 'history' && renderRecentReports()}

      {/* Loading Modal */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-2xl">
            <div className="text-6xl mb-4 animate-bounce">🤖</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Generating Report</h3>
            <p className="text-gray-600 mb-4">
              AI is analyzing data and creating your report...
            </p>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
