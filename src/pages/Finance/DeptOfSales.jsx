/**
 * Department of Sales Page - ADVANCED REDESIGN
 * Next-Gen Sales Intelligence Platform with AI-Powered CRM
 * Soft-coded configuration | Modern UI/UX | Smart Analytics
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientManagement from './ClientManagement';
import SalesPipeline from './SalesPipeline';
import AIInsights from './AIInsights';
import salesService from '../../services/sales.service';
import SALES_CONFIG, { formatValue } from '../../config/salesModule.config';
import SubFeatureGrid from '../../components/Sales/SubFeatureGrid';

// Usage Tracking Components
import UsageOverviewCards from '../../components/UsageTracking/UsageOverviewCards';
import DepartmentUsageChart from '../../components/UsageTracking/DepartmentUsageChart';
import FeatureUsageChart from '../../components/UsageTracking/FeatureUsageChart';
import TopUsersTable from '../../components/UsageTracking/TopUsersTable';
import UsageTrendsChart from '../../components/UsageTracking/UsageTrendsChart';

const DeptOfSales = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [animateMetrics, setAnimateMetrics] = useState(false);

  // Get configuration from soft-coded config
  const { tabs, metrics, quickActions, theme, aiFeatures } = SALES_CONFIG;

  // Auto-refresh mechanism (Intelligent)
  useEffect(() => {
    if (activeTab === 'overview' && SALES_CONFIG.refresh.auto) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, SALES_CONFIG.refresh.interval);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Fetch dashboard data with intelligent error handling
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setAnimateMetrics(true);
      const data = await salesService.getDashboardSummary();
      setDashboardData(data);
      setLastRefresh(new Date());
      
      // Reset animation after brief delay
      setTimeout(() => setAnimateMetrics(false), 600);
    } catch (error) {
      console.error('📛 Failed to fetch dashboard data:', error);
      // Graceful degradation - show empty state instead of crash
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Computed metrics with intelligent formatting
  const computedMetrics = useMemo(() => {
    return metrics.map(metric => {
      const value = dashboardData?.[metric.apiKey] || 0;
      const growth = dashboardData?.[metric.growthKey] || 0;
      
      return {
        ...metric,
        displayValue: formatValue(value, metric.format),
        growthValue: growth > 0 ? `+${growth}%` : `${growth}%`,
        trendDirection: growth > 0 ? 'up' : growth < 0 ? 'down' : 'neutral',
        trendColor: growth > 0 ? 'text-green-600' : growth < 0 ? 'text-red-600' : 'text-gray-600'
      };
    });
  }, [dashboardData, metrics]);

  // Quick action handler (Soft-coded routing)
  const handleQuickAction = useCallback((action) => {
    if (action.action === 'navigate') {
      setActiveTab(action.target);
    } else if (action.action === 'modal') {
      // Future: Open modal for exports, reports, etc.
      console.log('🎯 Action:', action.id);
    }
  }, []);

  // Tab change handler with analytics
  const handleTabChange = useCallback((tabId) => {
    console.log(`🔄 Switching to tab: ${tabId}`);
    setActiveTab(tabId);
  }, []);

  // Sub-feature click handler (Smart routing and actions)
  const handleSubFeatureClick = useCallback((subFeature) => {
    console.log(`🎯 Sub-feature clicked:`, subFeature);
    
    // Smart action handling based on sub-feature configuration
    switch (subFeature.action) {
      case 'create':
        // Future: Open create modal or navigate to create page
        alert(`Opening: ${subFeature.title}\nAction: Create new ${subFeature.title.replace('Add New ', '').replace('Create ', '')}`);
        break;
      case 'view':
      case 'browse':
        // Navigate to detailed view
        alert(`Opening: ${subFeature.title}\nLoading ${subFeature.description}...`);
        break;
      case 'analyze':
      case 'forecast':
      case 'predict':
        // Open AI analysis view
        alert(`🤖 AI Analysis: ${subFeature.title}\n${subFeature.description}`);
        break;
      case 'manage':
      case 'configure':
        // Open management interface
        alert(`⚙️ Configuration: ${subFeature.title}\n${subFeature.description}`);
        break;
      default:
        alert(`Feature: ${subFeature.title}\nComing soon!`);
    }
  }, []);

  // Get active tab sub-features
  const activeTabConfig = useMemo(() => {
    return tabs.find(tab => tab.id === activeTab);
  }, [activeTab, tabs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Enhanced Header with Gradient & AI Badge */}
          <div className="mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-10 rounded-3xl"></div>
            <div className="relative bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${theme.primary.gradient} flex items-center justify-center text-4xl shadow-lg transform hover:scale-110 transition-transform duration-300`}>
                      {SALES_CONFIG.meta.icon}
                    </div>
                    <div>
                      <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent">
                        {SALES_CONFIG.meta.name}
                      </h1>
                      <p className="text-gray-600 text-lg mt-1">
                        {SALES_CONFIG.meta.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* AI Features Badge */}
                  {aiFeatures.enabled && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-semibold rounded-full shadow-lg animate-pulse">
                        <span>🤖</span>
                        AI-Powered
                      </span>
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold rounded-full shadow-md">
                        <span>⚡</span>
                        Real-Time Analytics
                      </span>
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-full shadow-md">
                        <span>📊</span>
                        Version {SALES_CONFIG.meta.version}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Last Refresh Indicator */}
                {SALES_CONFIG.refresh.showIndicator && (
                  <div className="text-sm text-gray-500 text-right">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span>Live</span>
                    </div>
                    <div className="text-xs">
                      Updated: {lastRefresh.toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modern Tab Navigation */}
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`group relative px-4 py-4 rounded-xl font-semibold transition-all duration-300 ${
                      activeTab === tab.id
                        ? `bg-gradient-to-r ${theme.primary.gradient} text-white shadow-lg scale-105`
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl lg:text-3xl">{tab.icon}</span>
                      <span className="text-xs lg:text-sm font-bold">{tab.label}</span>
                      <span className={`text-xs hidden lg:block ${activeTab === tab.id ? 'text-white/80' : 'text-gray-500'}`}>
                        {tab.description}
                      </span>
                    </div>
                    
                    {/* Active indicator */}
                    {activeTab === tab.id && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-white rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {loading ? (
                <div className="text-center py-20">
                  <div className={`inline-block animate-spin rounded-full h-16 w-16 border-4 border-gray-300 border-t-blue-600 mb-4`}></div>
                  <p className="text-gray-600 text-lg font-medium">Loading Sales Intelligence...</p>
                  <p className="text-gray-400 text-sm mt-2">Analyzing data with AI</p>
                </div>
              ) : (
                <>
                  {/* Sub-Features Section - Smart Grid */}
                  {activeTabConfig?.subFeatures && activeTabConfig.subFeatures.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 mb-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${theme.primary.gradient} flex items-center justify-center text-white text-xl shadow-md`}>
                            {activeTabConfig.icon}
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                              {activeTabConfig.label} Features
                            </h2>
                            <p className="text-sm text-gray-600">
                              {activeTabConfig.subFeatures.length} intelligent tools available
                            </p>
                          </div>
                        </div>
                        <span className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold">
                          {activeTabConfig.subFeatures.filter(f => f.badge === 'AI').length} AI-Powered
                        </span>
                      </div>
                      
                      <SubFeatureGrid 
                        subFeatures={activeTabConfig.subFeatures}
                        onFeatureClick={handleSubFeatureClick}
                        columns={3}
                      />
                    </div>
                  )}

                  {/* Advanced Metrics Grid with Animation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {computedMetrics.map((metric, index) => (
                      <div
                        key={metric.id}
                        className={`group relative overflow-hidden rounded-2xl shadow-xl border-2 border-gray-200 hover:shadow-2xl transform hover:scale-105 transition-all duration-500 ${animateMetrics ? 'animate-bounce' : ''}`}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        {/* Gradient Background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                        
                        <div className="relative p-6">
                          {/* Icon & Title */}
                          <div className="flex items-center justify-between mb-4">
                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${metric.gradient} flex items-center justify-center text-3xl shadow-lg transform group-hover:rotate-12 transition-transform duration-300`}>
                              {metric.icon}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold ${metric.trendColor === 'text-green-600' ? 'bg-green-100 text-green-700' : metric.trendColor === 'text-red-600' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                              {metric.growthValue}
                            </div>
                          </div>
                          
                          {/* Value */}
                          <div className="mb-3">
                            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                              {metric.title}
                            </h3>
                            <p className="text-4xl font-black text-gray-900">
                              {metric.displayValue}
                            </p>
                          </div>
                          
                          {/* Insights */}
                          <div className="space-y-1">
                            {metric.insights.slice(0, 2).map((insight, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span>{insight}</span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Trend Arrow */}
                          <div className="absolute top-4 right-4 opacity-20 text-6xl">
                            {metric.trendDirection === 'up' ? '↗' : metric.trendDirection === 'down' ? '↘' : '→'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Actions - Modern Card Design */}
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-md">
                        ⚡
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Quick Actions
                      </h2>
                      <span className="ml-auto text-sm text-gray-500">
                        {quickActions.length} actions available
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="group relative p-6 border-2 border-gray-200 rounded-2xl hover:border-blue-400 hover:shadow-xl transition-all duration-300 text-left overflow-hidden transform hover:scale-105"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${action.iconBg.replace('bg-gradient-to-br', '')} opacity-0 group-hover:opacity-10 transition-opacity`}></div>
                          
                          <div className="relative">
                            <div className={`w-14 h-14 rounded-xl ${action.iconBg} flex items-center justify-center text-3xl shadow-lg mb-4 transform group-hover:rotate-12 transition-transform duration-300`}>
                              {action.icon}
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors">
                              {action.title}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {action.description}
                            </p>
                          </div>
                          
                          {/* Hover Arrow */}
                          <div className="absolute bottom-4 right-4 text-2xl opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                            →
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent Deals - Enhanced Design */}
                  {dashboardData?.recent_deals && dashboardData.recent_deals.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xl shadow-md">
                            🎯
                          </div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            Recent Deals
                          </h2>
                        </div>
                        <button 
                          onClick={() => handleTabChange('pipeline')}
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-semibold hover:bg-blue-100 transition-colors"
                        >
                          View All →
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {dashboardData.recent_deals.slice(0, SALES_CONFIG.display.recentDealsLimit).map((deal, index) => (
                          <div 
                            key={deal.id} 
                            className="group flex items-center justify-between p-5 border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                                #{index + 1}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                                  {deal.deal_name}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {deal.client_name}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                {formatValue(deal.deal_value, 'currency')}
                              </p>
                              <p className="text-sm text-gray-500 font-medium mt-1">
                                {deal.stage_display}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Features Showcase */}
                  {aiFeatures.enabled && (
                    <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 rounded-2xl shadow-xl border-2 border-purple-200 p-8">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-2xl shadow-lg animate-pulse">
                          🤖
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                            AI-Powered Features
                          </h2>
                          <p className="text-sm text-gray-600">Intelligent automation for smarter sales</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {aiFeatures.features.map((feature) => (
                          <div 
                            key={feature.id}
                            className="bg-white/80 backdrop-blur-sm p-5 rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300"
                          >
                            <div className="text-3xl mb-3">{feature.icon}</div>
                            <h3 className="font-bold text-gray-900 mb-2">{feature.name}</h3>
                            <p className="text-xs text-gray-600 mb-3">{feature.description}</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                              feature.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {feature.status.toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-6">
              {/* Sub-Features Section */}
              {activeTabConfig?.subFeatures && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-md`}>
                        {activeTabConfig.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          {activeTabConfig.label} Tools
                        </h2>
                        <p className="text-sm text-gray-600">
                          Complete customer relationship management
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <SubFeatureGrid 
                    subFeatures={activeTabConfig.subFeatures}
                    onFeatureClick={handleSubFeatureClick}
                    columns={3}
                  />
                </div>
              )}
              
              {/* Original Client Management Component */}
              <ClientManagement />
            </div>
          )}

          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              {/* Sub-Features Section */}
              {activeTabConfig?.subFeatures && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-md`}>
                        {activeTabConfig.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">
                          {activeTabConfig.label} Management
                        </h2>
                        <p className="text-sm text-gray-600">
                          Visual deal tracking and forecasting
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <SubFeatureGrid 
                    subFeatures={activeTabConfig.subFeatures}
                    onFeatureClick={handleSubFeatureClick}
                    columns={3}
                  />
                </div>
              )}
              
              {/* Original Sales Pipeline Component */}
              <SalesPipeline />
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-6">
              {/* Sub-Features Section */}
              {activeTabConfig?.subFeatures && (
                <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 rounded-2xl shadow-xl border-2 border-purple-200 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-2xl shadow-lg animate-pulse`}>
                        {activeTabConfig.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          {activeTabConfig.label}
                        </h2>
                        <p className="text-sm text-gray-600">
                          AI-powered analytics and predictions
                        </p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-bold">
                      All AI-Powered
                    </span>
                  </div>
                  
                  <SubFeatureGrid 
                    subFeatures={activeTabConfig.subFeatures}
                    onFeatureClick={handleSubFeatureClick}
                    columns={3}
                  />
                </div>
              )}
              
              {/* Original AI Insights Component */}
              <AIInsights />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Sub-Features Section */}
              {activeTabConfig?.subFeatures && (
                <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-blue-50 rounded-2xl shadow-xl border-2 border-emerald-200 p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white text-2xl shadow-lg`}>
                        {activeTabConfig.icon}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                          {activeTabConfig.label}
                        </h2>
                        <p className="text-sm text-gray-600">
                          User metering and system usage insights
                        </p>
                      </div>
                    </div>
                    <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">
                      Real-Time Tracking
                    </span>
                  </div>
                  
                  <SubFeatureGrid 
                    subFeatures={activeTabConfig.subFeatures}
                    onFeatureClick={handleSubFeatureClick}
                    columns={3}
                  />
                </div>
              )}
              
              {/* Usage Analytics Dashboard Content */}
              <div className="space-y-6">
                {/* Overview Cards */}
                <UsageOverviewCards />
                
                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <DepartmentUsageChart />
                  <FeatureUsageChart />
                </div>
                
                {/* Usage Trends */}
                <UsageTrendsChart />
                
                {/* Top Users Table */}
                <TopUsersTable />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeptOfSales;
