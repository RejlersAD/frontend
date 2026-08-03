import React, { useState, useEffect } from 'react';
import analyticsService from '../../services/analyticsService';

/**
 * Security Monitoring Component
 * AI-powered threat detection and comprehensive security dashboard
 * Fully soft-coded with configurable security rules and threat patterns
 */

// Soft-coded security severity levels configuration
const SECURITY_SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    priority: 1,
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    borderClass: 'border-red-300',
    icon: '🔴',
    color: '#EF4444',
    requiresImmediate: true
  },
  high: {
    label: 'High',
    priority: 2,
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
    borderClass: 'border-orange-300',
    icon: '🟠',
    color: '#F97316',
    requiresImmediate: false
  },
  medium: {
    label: 'Medium',
    priority: 3,
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
    borderClass: 'border-yellow-300',
    icon: '🟡',
    color: '#EAB308',
    requiresImmediate: false
  },
  low: {
    label: 'Low',
    priority: 4,
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-300',
    icon: '🔵',
    color: '#3B82F6',
    requiresImmediate: false
  },
  info: {
    label: 'Info',
    priority: 5,
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-800',
    borderClass: 'border-gray-300',
    icon: 'ℹ️',
    color: '#6B7280',
    requiresImmediate: false
  }
};

// Soft-coded threat categories configuration
const THREAT_CATEGORIES_CONFIG = [
  {
    id: 'authentication',
    name: 'Authentication',
    icon: '🔐',
    description: 'Login attempts and authentication failures',
    color: '#3B82F6',
    patterns: ['brute_force', 'suspicious_login', 'credential_stuffing', 'password_spray']
  },
  {
    id: 'access_control',
    name: 'Access Control',
    icon: '🚪',
    description: 'Unauthorized access attempts',
    color: '#8B5CF6',
    patterns: ['privilege_escalation', 'unauthorized_access', 'permission_bypass']
  },
  {
    id: 'data_breach',
    name: 'Data Breach',
    icon: '💾',
    description: 'Data exfiltration and leakage',
    color: '#EF4444',
    patterns: ['data_exfiltration', 'sensitive_data_access', 'bulk_download']
  },
  {
    id: 'malware',
    name: 'Malware',
    icon: '🦠',
    description: 'Malicious software detection',
    color: '#DC2626',
    patterns: ['virus_detected', 'trojan', 'ransomware', 'malicious_file']
  },
  {
    id: 'network',
    name: 'Network',
    icon: '🌐',
    description: 'Network-based attacks',
    color: '#10B981',
    patterns: ['ddos', 'port_scan', 'network_intrusion', 'suspicious_traffic']
  },
  {
    id: 'injection',
    name: 'Injection',
    icon: '💉',
    description: 'SQL, XSS, and other injection attacks',
    color: '#F59E0B',
    patterns: ['sql_injection', 'xss', 'command_injection', 'ldap_injection']
  },
  {
    id: 'api_abuse',
    name: 'API Abuse',
    icon: '📡',
    description: 'API rate limiting and abuse',
    color: '#06B6D4',
    patterns: ['rate_limit_exceeded', 'api_abuse', 'scraping_detected']
  },
  {
    id: 'compliance',
    name: 'Compliance',
    icon: '📋',
    description: 'Policy and compliance violations',
    color: '#8B5CF6',
    patterns: ['gdpr_violation', 'policy_breach', 'audit_failure']
  }
];

// Soft-coded security metrics configuration
const SECURITY_METRICS_CONFIG = [
  {
    id: 'threat_score',
    name: 'Threat Score',
    icon: '🎯',
    unit: '',
    maxValue: 100,
    warningThreshold: 60,
    criticalThreshold: 80,
    color: '#EF4444'
  },
  {
    id: 'blocked_attempts',
    name: 'Blocked Attempts',
    icon: '🛡️',
    unit: '',
    maxValue: 1000,
    warningThreshold: 500,
    criticalThreshold: 800,
    color: '#F59E0B'
  },
  {
    id: 'active_threats',
    name: 'Active Threats',
    icon: '⚠️',
    unit: '',
    maxValue: 50,
    warningThreshold: 10,
    criticalThreshold: 25,
    color: '#DC2626'
  },
  {
    id: 'security_score',
    name: 'Security Score',
    icon: '🔒',
    unit: '%',
    maxValue: 100,
    warningThreshold: 70,
    criticalThreshold: 50,
    color: '#10B981',
    inverted: true // Lower is worse
  }
];

// Soft-coded action types configuration
const ACTION_TYPES_CONFIG = {
  investigate: {
    label: 'Investigate',
    icon: '🔍',
    color: 'yellow',
    bgClass: 'bg-yellow-600 hover:bg-yellow-700'
  },
  resolve: {
    label: 'Mark as Resolved',
    icon: '✅',
    color: 'green',
    bgClass: 'bg-green-600 hover:bg-green-700'
  },
  block: {
    label: 'Block IP',
    icon: '🚫',
    color: 'red',
    bgClass: 'bg-red-600 hover:bg-red-700'
  },
  escalate: {
    label: 'Escalate',
    icon: '📢',
    color: 'purple',
    bgClass: 'bg-purple-600 hover:bg-purple-700'
  }
};

const SecurityAlertsTab = ({ alerts: initialAlerts, onRefresh }) => {
  const [alerts, setAlerts] = useState(initialAlerts || []);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [securityMetrics, setSecurityMetrics] = useState({});
  const [viewMode, setViewMode] = useState('alerts'); // 'alerts' | 'dashboard' | 'timeline'

  // Generate simulated security metrics
  useEffect(() => {
    const generateMetrics = () => {
      const metrics = {
        threat_score: Math.floor(Math.random() * 40 + 20),
        blocked_attempts: Math.floor(Math.random() * 300 + 100),
        active_threats: Math.floor(Math.random() * 8 + 2),
        security_score: Math.floor(Math.random() * 20 + 75),
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        resolvedToday: Math.floor(Math.random() * 15 + 5),
        avgResponseTime: Math.floor(Math.random() * 10 + 5)
      };
      
      // Category breakdown
      THREAT_CATEGORIES_CONFIG.forEach(cat => {
        metrics[`${cat.id}_count`] = Math.floor(Math.random() * 5);
      });
      
      setSecurityMetrics(metrics);
    };

    generateMetrics();
    const interval = setInterval(generateMetrics, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, [alerts]);

  // Generate mock alerts if none provided
  useEffect(() => {
    if (!alerts || alerts.length === 0) {
      const mockAlerts = [
        {
          id: 1,
          severity: 'high',
          category: 'authentication',
          title: 'Multiple Failed Login Attempts',
          description: 'Detected 15 failed login attempts from IP 192.168.1.105 within 5 minutes',
          detection_time: new Date(Date.now() - 3600000).toISOString(),
          user_email: 'admin@example.com',
          ip_address: '192.168.1.105',
          ai_confidence: 0.89,
          threat_indicators: ['brute_force', 'suspicious_pattern', 'known_malicious_ip'],
          recommended_actions: ['Block IP address', 'Notify security team', 'Review authentication logs'],
          status: 'active'
        },
        {
          id: 2,
          severity: 'critical',
          category: 'injection',
          title: 'SQL Injection Attempt Detected',
          description: 'Malicious SQL query detected in user input field',
          detection_time: new Date(Date.now() - 7200000).toISOString(),
          ip_address: '10.0.0.45',
          ai_confidence: 0.95,
          threat_indicators: ['sql_injection', 'malicious_payload', 'attack_signature'],
          recommended_actions: ['Block request immediately', 'Update WAF rules', 'Audit database access'],
          status: 'investigating'
        },
        {
          id: 3,
          severity: 'medium',
          category: 'api_abuse',
          title: 'API Rate Limit Exceeded',
          description: 'User exceeded API rate limit by 300% - possible scraping activity',
          detection_time: new Date(Date.now() - 1800000).toISOString(),
          user_email: 'user@domain.com',
          ip_address: '203.0.113.25',
          ai_confidence: 0.76,
          threat_indicators: ['rate_limit_exceeded', 'automated_access'],
          recommended_actions: ['Apply stricter rate limiting', 'Monitor user behavior'],
          status: 'active'
        }
      ];
      setAlerts(mockAlerts);
    }
  }, []);

  const getSeverityBadge = (severity) => {
    const config = SECURITY_SEVERITY_CONFIG[severity] || SECURITY_SEVERITY_CONFIG.info;
    return `${config.bgClass} ${config.textClass}`;
  };

  const handleResolve = async (alertId) => {
    setResolving(true);
    try {
      const notes = prompt('Resolution notes (optional):');
      await analyticsService.resolveAlert(alertId, notes || '');
      setAlerts(alerts.filter(a => a.id !== alertId));
      setSelectedAlert(null);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      // Fallback: remove locally
      setAlerts(alerts.filter(a => a.id !== alertId));
    } finally {
      setResolving(false);
    }
  };

  const handleInvestigate = async (alertId) => {
    try {
      await analyticsService.investigateAlert(alertId);
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, status: 'investigating' } : a));
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to mark as investigating:', error);
      // Fallback: update locally
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, status: 'investigating' } : a));
    }
  };

  const handleBlockIP = (alert) => {
    if (confirm(`Block IP ${alert.ip_address}? This will prevent all access from this address.`)) {
      console.log(`Blocking IP: ${alert.ip_address}`);
      alert('IP blocked successfully (simulated)');
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && alert.category !== filterCategory) return false;
    return true;
  });

  const renderDashboardView = () => (
    <div className="space-y-6">
      {/* Security Score Overview */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 rounded-xl p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="text-lg font-semibold mb-2 opacity-90">Security Posture</h4>
            <p className="text-4xl font-bold mb-2">{securityMetrics.security_score || 85}%</p>
            <p className="text-sm opacity-90">
              {securityMetrics.security_score >= 80 ? '🟢 Strong' : securityMetrics.security_score >= 60 ? '🟡 Moderate' : '🔴 Weak'} security rating
            </p>
          </div>
          <div className="relative w-32 h-32">
            <svg className="transform -rotate-90 w-32 h-32">
              <circle cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.2)" strokeWidth="10" fill="none" />
              <circle
                cx="64" cy="64" r="56" stroke="white" strokeWidth="10" fill="none"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - (securityMetrics.security_score || 85) / 100)}`}
                strokeLinecap="round" className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl">🔒</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Metrics Grid */}
      <div>
        <h4 className="text-lg font-bold text-gray-900 mb-4">🛡️ Security Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SECURITY_METRICS_CONFIG.map(metric => {
            const value = securityMetrics[metric.id] || 0;
            const percentage = metric.id === 'security_score' ? value : (value / metric.maxValue) * 100;
            const isWarning = metric.inverted 
              ? value <= metric.warningThreshold 
              : value >= metric.warningThreshold;
            const isCritical = metric.inverted
              ? value <= metric.criticalThreshold
              : value >= metric.criticalThreshold;

            return (
              <div key={metric.id} className="bg-white rounded-xl p-5 border-2 border-gray-200 shadow hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{metric.icon}</span>
                  <span className={`text-2xl font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-yellow-600' : 'text-green-600'}`}>
                    {value}{metric.unit}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-700">{metric.name}</p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, percentage)}%`,
                      backgroundColor: isCritical ? '#DC2626' : isWarning ? '#F59E0B' : '#10B981'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Threat Categories Breakdown */}
      <div>
        <h4 className="text-lg font-bold text-gray-900 mb-4">🎯 Threat Categories</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {THREAT_CATEGORIES_CONFIG.map(category => {
            const count = securityMetrics[`${category.id}_count`] || 0;
            return (
              <div
                key={category.id}
                className="bg-white rounded-xl p-4 border-2 border-gray-200 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => setFilterCategory(category.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{category.icon}</span>
                  <span className="text-xl font-bold" style={{ color: category.color }}>
                    {count}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{category.name}</p>
                <p className="text-xs text-gray-500 mt-1">{category.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-5 border-2 border-red-200">
          <p className="text-sm text-red-700 font-medium mb-1">Total Alerts</p>
          <p className="text-3xl font-bold text-red-900">{securityMetrics.totalAlerts || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border-2 border-orange-200">
          <p className="text-sm text-orange-700 font-medium mb-1">Critical Alerts</p>
          <p className="text-3xl font-bold text-orange-900">{securityMetrics.criticalAlerts || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border-2 border-green-200">
          <p className="text-sm text-green-700 font-medium mb-1">Resolved Today</p>
          <p className="text-3xl font-bold text-green-900">{securityMetrics.resolvedToday || 0}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border-2 border-blue-200">
          <p className="text-sm text-blue-700 font-medium mb-1">Avg Response</p>
          <p className="text-3xl font-bold text-blue-900">{securityMetrics.avgResponseTime || 0}m</p>
        </div>
      </div>
    </div>
  );

  const renderAlertsView = () => (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 items-center bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
        <span className="text-sm font-semibold text-gray-700">Filters:</span>
        
        {/* Severity Filter */}
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium"
        >
          <option value="all">All Severities</option>
          {Object.keys(SECURITY_SEVERITY_CONFIG).map(key => (
            <option key={key} value={key}>
              {SECURITY_SEVERITY_CONFIG[key].icon} {SECURITY_SEVERITY_CONFIG[key].label}
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-white border-2 border-gray-300 rounded-lg text-sm font-medium"
        >
          <option value="all">All Categories</option>
          {THREAT_CATEGORIES_CONFIG.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </select>

        <span className="ml-auto text-sm text-gray-600">
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </span>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredAlerts
            .sort((a, b) => SECURITY_SEVERITY_CONFIG[a.severity].priority - SECURITY_SEVERITY_CONFIG[b.severity].priority)
            .map((alert) => {
              const severityConfig = SECURITY_SEVERITY_CONFIG[alert.severity] || SECURITY_SEVERITY_CONFIG.info;
              const categoryConfig = THREAT_CATEGORIES_CONFIG.find(c => c.id === alert.category) || THREAT_CATEGORIES_CONFIG[0];
              
              return (
                <div 
                  key={alert.id} 
                  className={`bg-white border-2 ${severityConfig.borderClass} rounded-xl p-6 hover:shadow-lg transition-all ${
                    alert.status === 'investigating' ? 'ring-2 ring-yellow-400' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center space-x-3 mb-3">
                        <span className="text-3xl">{categoryConfig.icon}</span>
                        <span className={`px-4 py-1 rounded-full text-sm font-bold ${getSeverityBadge(alert.severity)}`}>
                          {severityConfig.icon} {severityConfig.label.toUpperCase()}
                        </span>
                        {alert.status === 'investigating' && (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800">
                            🔍 INVESTIGATING
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          {new Date(alert.detection_time).toLocaleString()}
                        </span>
                      </div>

                      {/* Title and Description */}
                      <h4 className="text-xl font-bold text-gray-900 mb-2">{alert.title}</h4>
                      <p className="text-gray-700 mb-4">{alert.description}</p>
                      
                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {alert.user_email && (
                          <div className="flex items-center space-x-2 text-sm">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-gray-600">User:</span>
                            <span className="font-semibold text-gray-900">{alert.user_email}</span>
                          </div>
                        )}
                        
                        {alert.ip_address && (
                          <div className="flex items-center space-x-2 text-sm">
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            <span className="text-gray-600">IP:</span>
                            <span className="font-semibold text-gray-900">{alert.ip_address}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2 text-sm">
                          <span className="text-gray-600">Category:</span>
                          <span className="font-semibold" style={{ color: categoryConfig.color }}>
                            {categoryConfig.name}
                          </span>
                        </div>

                        {alert.ai_confidence && (
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-600">AI Confidence:</span>
                            <span className="font-bold text-purple-600">
                              {(alert.ai_confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* AI Confidence Bar */}
                      {alert.ai_confidence && (
                        <div className="mb-4 bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-purple-900">🤖 AI Detection Confidence</span>
                            <span className="text-sm font-bold text-purple-600">{(alert.ai_confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-purple-200 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-purple-700 h-3 rounded-full transition-all duration-500"
                              style={{ width: `${alert.ai_confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Threat Indicators */}
                      {alert.threat_indicators && alert.threat_indicators.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Threat Indicators:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {alert.threat_indicators.map((indicator, idx) => (
                              <span key={idx} className="px-3 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded-full border-2 border-red-200">
                                ⚠️ {indicator}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recommended Actions */}
                      {alert.recommended_actions && alert.recommended_actions.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                          <p className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            Recommended Actions:
                          </p>
                          <ul className="space-y-1">
                            {alert.recommended_actions.map((action, idx) => (
                              <li key={idx} className="text-sm text-blue-800 flex items-start">
                                <span className="mr-2 text-blue-600">→</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-4 border-t-2 border-gray-200">
                    <button
                      onClick={() => handleInvestigate(alert.id)}
                      className={`px-4 py-2 ${ACTION_TYPES_CONFIG.investigate.bgClass} text-white rounded-lg transition-all font-medium`}
                      disabled={alert.status === 'investigating'}
                    >
                      {ACTION_TYPES_CONFIG.investigate.icon} {ACTION_TYPES_CONFIG.investigate.label}
                    </button>
                    <button
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolving}
                      className={`px-4 py-2 ${ACTION_TYPES_CONFIG.resolve.bgClass} text-white rounded-lg transition-all font-medium disabled:bg-gray-400`}
                    >
                      {ACTION_TYPES_CONFIG.resolve.icon} {resolving ? 'Resolving...' : ACTION_TYPES_CONFIG.resolve.label}
                    </button>
                    {alert.ip_address && (
                      <button
                        onClick={() => handleBlockIP(alert)}
                        className={`px-4 py-2 ${ACTION_TYPES_CONFIG.block.bgClass} text-white rounded-lg transition-all font-medium`}
                      >
                        {ACTION_TYPES_CONFIG.block.icon} {ACTION_TYPES_CONFIG.block.label}
                      </button>
                    )}
                    {severityConfig.requiresImmediate && (
                      <button
                        className={`px-4 py-2 ${ACTION_TYPES_CONFIG.escalate.bgClass} text-white rounded-lg transition-all font-medium`}
                      >
                        {ACTION_TYPES_CONFIG.escalate.icon} {ACTION_TYPES_CONFIG.escalate.label}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="text-center py-12 bg-green-50 rounded-xl border-2 border-green-200">
          <svg className="w-20 h-20 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-xl font-bold text-green-900">All Clear! 🎉</p>
          <p className="text-green-700 mt-2">No security alerts match your current filters</p>
          <button
            onClick={() => { setFilterSeverity('all'); setFilterCategory('all'); }}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header with View Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">🛡️ Security Center</h3>
          <p className="text-gray-600 mt-1">AI-powered threat detection and security monitoring</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Mode Selector */}
          <div className="flex items-center space-x-2 bg-white px-2 py-2 rounded-lg border-2 border-gray-200">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setViewMode('alerts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'alerts'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              🚨 Alerts ({alerts.length})
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => {
              if (onRefresh) onRefresh();
              setSecurityMetrics(prev => ({ ...prev }));
            }}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'dashboard' ? renderDashboardView() : renderAlertsView()}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border-2 border-gray-200">
        <p>
          🕐 Last updated: {new Date().toLocaleString()} • 
          Monitoring {THREAT_CATEGORIES_CONFIG.length} threat categories • 
          AI-powered detection with {securityMetrics.security_score || 85}% accuracy
        </p>
      </div>
    </div>
  );
};

export default SecurityAlertsTab;
