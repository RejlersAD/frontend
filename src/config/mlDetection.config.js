/**
 * ML Detection Configuration
 * Soft-coded settings for detection algorithms
 */

export const ML_DETECTION_CONFIG = {
  // Detection algorithms
  algorithms: {
    isolation_forest: {
      enabled: true,
      contamination: 0.1,
      n_estimators: 100,
      max_samples: 'auto',
      priority: 1
    },
    statistical: {
      enabled: true,
      std_multiplier: 3.0,
      window_size: 100,
      min_samples: 10,
      priority: 2
    },
    pattern_recognition: {
      enabled: true,
      sequence_length: 10,
      similarity_threshold: 0.85,
      priority: 3
    },
    time_series_prediction: {
      enabled: true,
      forecast_horizon: 30,
      confidence_interval: 0.95,
      priority: 4
    }
  },

  // Alert thresholds
  thresholds: {
    critical: {
      confidence: 0.95,
      risk_score: 0.9
    },
    high: {
      confidence: 0.85,
      risk_score: 0.7
    },
    medium: {
      confidence: 0.75,
      risk_score: 0.5
    },
    low: {
      confidence: 0.6,
      risk_score: 0.3
    }
  },

  // Feature extraction settings
  features: {
    temporal_features: true,
    statistical_features: true,
    frequency_features: true,
    custom_features: []
  },

  // Data streaming
  streaming: {
    buffer_size: 1000,
    batch_size: 10,
    flush_interval_ms: 5000
  },

  // Alert settings
  alerts: {
    cooldown_period_seconds: 300,
    max_alerts_per_hour: 50,
    auto_acknowledge_after_minutes: 30,
    notification_channels: ['dashboard', 'websocket'],
    sound_enabled: true,
    browser_notifications: true
  },

  // WebSocket settings
  websocket: {
    reconnect_interval_ms: 5000,
    max_reconnect_attempts: 10,
    heartbeat_interval_ms: 30000
  },

  // Model training
  training: {
    auto_retrain: true,
    retrain_interval_hours: 24,
    min_training_samples: 100,
    validation_split: 0.2
  }
};


/**
 * Detection types configuration
 */
export const DETECTION_TYPES = [
  {
    id: 'anomaly',
    label: 'Anomaly Detection',
    description: 'Detect unusual patterns in data',
    icon: '🎯',
    color: 'purple'
  },
  {
    id: 'threshold',
    label: 'Threshold Alert',
    description: 'Alert when values exceed thresholds',
    icon: '📊',
    color: 'blue'
  },
  {
    id: 'pattern',
    label: 'Pattern Recognition',
    description: 'Identify known problematic patterns',
    icon: '🔍',
    color: 'green'
  },
  {
    id: 'prediction',
    label: 'Predictive Alert',
    description: 'Forecast potential issues',
    icon: '🔮',
    color: 'orange'
  },
  {
    id: 'security',
    label: 'Security Threat',
    description: 'Detect security anomalies',
    icon: '🛡️',
    color: 'red'
  },
  {
    id: 'performance',
    label: 'Performance Degradation',
    description: 'Monitor system performance',
    icon: '⚡',
    color: 'yellow'
  }
];


/**
 * Stream types for real-time analysis
 */
export const STREAM_TYPES = [
  {
    id: 'user_activity',
    label: 'User Activity',
    description: 'Monitor user behavior patterns',
    metrics: ['login_count', 'action_count', 'session_duration']
  },
  {
    id: 'system_metrics',
    label: 'System Metrics',
    description: 'Track system resource usage',
    metrics: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_io']
  },
  {
    id: 'api_requests',
    label: 'API Requests',
    description: 'Monitor API call patterns',
    metrics: ['request_count', 'response_time', 'error_rate']
  },
  {
    id: 'security_events',
    label: 'Security Events',
    description: 'Track security-related events',
    metrics: ['failed_logins', 'permission_violations', 'suspicious_activity']
  },
  {
    id: 'performance',
    label: 'Performance Data',
    description: 'Application performance metrics',
    metrics: ['page_load_time', 'query_time', 'render_time']
  }
];


/**
 * Visualization colors for different severity levels
 */
export const SEVERITY_COLORS = {
  critical: {
    primary: '#DC2626',
    light: '#FEE2E2',
    dark: '#991B1B'
  },
  high: {
    primary: '#EA580C',
    light: '#FFEDD5',
    dark: '#9A3412'
  },
  medium: {
    primary: '#EAB308',
    light: '#FEF9C3',
    dark: '#854D0E'
  },
  low: {
    primary: '#3B82F6',
    light: '#DBEAFE',
    dark: '#1E40AF'
  },
  info: {
    primary: '#06B6D4',
    light: '#CFFAFE',
    dark: '#0E7490'
  }
};


/**
 * Chart configuration for visualizations
 */
export const CHART_CONFIG = {
  anomaly_timeline: {
    type: 'line',
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  },
  alert_distribution: {
    type: 'doughnut',
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  }
};
