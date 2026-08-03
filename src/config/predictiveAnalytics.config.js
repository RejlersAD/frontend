/**
 * ==================================================================================
 * PREDICTIVE ANALYTICS CONFIGURATION - SOFT-CODED INTELLIGENCE
 * ==================================================================================
 * Smart predictive analytics system with forecasting, trend analysis, and ML insights.
 * Author: AI-Powered Dashboard Team
 * Date: January 24, 2026
 */

/**
 * PREDICTION MODELS - Different forecasting algorithms
 */
export const PREDICTION_MODELS = {
  LINEAR_REGRESSION: {
    id: 'linear_regression',
    name: 'Linear Trend',
    description: 'Simple linear forecasting based on historical trends',
    icon: 'TrendingUpIcon',
    color: 'blue',
    accuracy: 75,
    bestFor: ['documents', 'users', 'steady_growth']
  },
  EXPONENTIAL_SMOOTHING: {
    id: 'exponential_smoothing',
    name: 'Exponential Smoothing',
    description: 'Weighted average giving more importance to recent data',
    icon: 'ChartBarIcon',
    color: 'purple',
    accuracy: 82,
    bestFor: ['activity', 'usage', 'volatility']
  },
  MOVING_AVERAGE: {
    id: 'moving_average',
    name: 'Moving Average',
    description: 'Rolling average to smooth out short-term fluctuations',
    icon: 'ArrowTrendingUpIcon',
    color: 'green',
    accuracy: 78,
    bestFor: ['daily_patterns', 'smoothing', 'general_trends']
  },
  SEASONAL_DECOMPOSITION: {
    id: 'seasonal',
    name: 'Seasonal Patterns',
    description: 'Identifies and predicts seasonal/weekly patterns',
    icon: 'CalendarIcon',
    color: 'amber',
    accuracy: 85,
    bestFor: ['weekly_cycles', 'monthly_patterns', 'business_hours']
  },
  POLYNOMIAL_REGRESSION: {
    id: 'polynomial',
    name: 'Polynomial Trend',
    description: 'Complex curve fitting for non-linear growth',
    icon: 'CursorArrowRaysIcon',
    color: 'indigo',
    accuracy: 80,
    bestFor: ['rapid_growth', 'saturation', 'complex_patterns']
  }
};

/**
 * PREDICTION METRICS - What to forecast
 */
export const PREDICTION_METRICS = [
  {
    id: 'document_uploads',
    name: 'Document Uploads',
    description: 'Forecast future document upload volume',
    model: 'linear_regression',
    confidence: 0.85,
    forecastDays: 7,
    unit: 'documents',
    threshold: {
      warning: 100,
      critical: 50
    },
    icon: 'DocumentIcon',
    color: 'blue'
  },
  {
    id: 'user_activity',
    name: 'User Activity',
    description: 'Predict active user count',
    model: 'exponential_smoothing',
    confidence: 0.80,
    forecastDays: 7,
    unit: 'users',
    threshold: {
      warning: 50,
      critical: 25
    },
    icon: 'UserGroupIcon',
    color: 'purple'
  },
  {
    id: 'ai_analysis_usage',
    name: 'AI Analysis Usage',
    description: 'Forecast AI feature utilization',
    model: 'moving_average',
    confidence: 0.75,
    forecastDays: 7,
    unit: 'analyses',
    threshold: {
      warning: 30,
      critical: 15
    },
    icon: 'CpuChipIcon',
    color: 'emerald'
  },
  {
    id: 'project_completion',
    name: 'Project Completion Rate',
    description: 'Predict project delivery timeline',
    model: 'polynomial',
    confidence: 0.78,
    forecastDays: 14,
    unit: 'projects',
    threshold: {
      warning: 5,
      critical: 2
    },
    icon: 'CheckCircleIcon',
    color: 'green'
  },
  {
    id: 'system_load',
    name: 'System Load',
    description: 'Predict infrastructure capacity needs',
    model: 'seasonal',
    confidence: 0.82,
    forecastDays: 3,
    unit: 'load %',
    threshold: {
      warning: 80,
      critical: 95
    },
    icon: 'ServerIcon',
    color: 'amber'
  }
];

/**
 * ANOMALY DETECTION RULES - Smart outlier identification
 */
export const ANOMALY_RULES = {
  STATISTICAL: {
    method: 'z_score',
    threshold: 2.5, // Standard deviations
    sensitivity: 'medium',
    description: 'Statistical outlier detection using Z-score'
  },
  THRESHOLD: {
    method: 'absolute',
    thresholds: {
      high: 1.5, // 150% of normal
      low: 0.5   // 50% of normal
    },
    sensitivity: 'high',
    description: 'Absolute threshold-based detection'
  },
  RATE_OF_CHANGE: {
    method: 'derivative',
    threshold: 0.3, // 30% change rate
    sensitivity: 'low',
    description: 'Detects sudden spikes or drops'
  }
};

/**
 * INSIGHT CATEGORIES - Types of predictive insights
 */
export const INSIGHT_TYPES = {
  GROWTH: {
    type: 'growth',
    icon: 'ArrowTrendingUpIcon',
    color: 'green',
    priority: 'info',
    title: 'Growth Detected'
  },
  DECLINE: {
    type: 'decline',
    icon: 'ArrowTrendingDownIcon',
    color: 'red',
    priority: 'warning',
    title: 'Decline Alert'
  },
  ANOMALY: {
    type: 'anomaly',
    icon: 'ExclamationTriangleIcon',
    color: 'amber',
    priority: 'high',
    title: 'Anomaly Detected'
  },
  PATTERN: {
    type: 'pattern',
    icon: 'ChartBarIcon',
    color: 'blue',
    priority: 'info',
    title: 'Pattern Identified'
  },
  FORECAST: {
    type: 'forecast',
    icon: 'LightBulbIcon',
    color: 'purple',
    priority: 'info',
    title: 'Forecast Update'
  },
  OPTIMIZATION: {
    type: 'optimization',
    icon: 'SparklesIcon',
    color: 'indigo',
    priority: 'medium',
    title: 'Optimization Opportunity'
  }
};

/**
 * ==================================================================================
 * PREDICTIVE ALGORITHMS - Smart Forecasting Functions
 * ==================================================================================
 */

/**
 * Linear Regression - Simple trend line prediction
 */
export const linearRegression = (dataPoints) => {
  if (!dataPoints || dataPoints.length < 2) return null;
  
  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  
  dataPoints.forEach((point, index) => {
    sumX += index;
    sumY += point;
    sumXY += index * point;
    sumXX += index * index;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
};

/**
 * Exponential Smoothing - Weighted recent data
 */
export const exponentialSmoothing = (dataPoints, alpha = 0.3) => {
  if (!dataPoints || dataPoints.length < 2) return dataPoints;
  
  const smoothed = [dataPoints[0]];
  for (let i = 1; i < dataPoints.length; i++) {
    smoothed.push(alpha * dataPoints[i] + (1 - alpha) * smoothed[i - 1]);
  }
  
  return smoothed;
};

/**
 * Moving Average - Rolling window calculation
 */
export const movingAverage = (dataPoints, window = 7) => {
  if (!dataPoints || dataPoints.length < window) return dataPoints;
  
  const result = [];
  for (let i = 0; i < dataPoints.length; i++) {
    if (i < window - 1) {
      result.push(dataPoints[i]);
    } else {
      const sum = dataPoints.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
  }
  
  return result;
};

/**
 * Seasonal Decomposition - Identifies and predicts seasonal patterns
 */
export const seasonalDecomposition = (dataPoints, seasonLength = 7) => {
  if (!dataPoints || dataPoints.length < seasonLength * 2) return dataPoints;
  
  // Calculate seasonal components
  const seasons = [];
  for (let i = 0; i < seasonLength; i++) {
    const seasonalValues = [];
    for (let j = i; j < dataPoints.length; j += seasonLength) {
      seasonalValues.push(dataPoints[j]);
    }
    const seasonalAvg = seasonalValues.reduce((a, b) => a + b, 0) / seasonalValues.length;
    seasons.push(seasonalAvg);
  }
  
  return seasons;
};

/**
 * Polynomial Regression - Complex curve fitting for non-linear trends
 */
export const polynomialRegression = (dataPoints, degree = 2) => {
  if (!dataPoints || dataPoints.length < 3) return null;
  
  // For simplicity, use quadratic (degree 2) polynomial
  const n = dataPoints.length;
  let sumX = 0, sumY = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumXY = 0, sumX2Y = 0;
  
  dataPoints.forEach((point, index) => {
    const x = index;
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x2 * x2;
    
    sumX += x;
    sumY += point;
    sumX2 += x2;
    sumX3 += x3;
    sumX4 += x4;
    sumXY += x * point;
    sumX2Y += x2 * point;
  });
  
  // Solve system of equations for coefficients a, b, c where y = ax^2 + bx + c
  // Using simplified matrix solution for quadratic
  const denominator = (n * sumX2 * sumX4) - (sumX2 * sumX2 * sumX2);
  
  if (denominator === 0) {
    // Fall back to linear if quadratic doesn't work
    return linearRegression(dataPoints);
  }
  
  const a = ((n * sumX2Y - sumX2 * sumY) * sumX2 - (n * sumXY - sumX * sumY) * sumX3) / denominator;
  const b = ((n * sumXY - sumX * sumY) * sumX4 - (n * sumX2Y - sumX2 * sumY) * sumX3) / denominator;
  const c = (sumY - b * sumX - a * sumX2) / n;
  
  return { a, b, c };
};

/**
 * Forecast Next N Days - Generates future predictions
 */
export const forecastNextDays = (dataPoints, model, days = 7) => {
  if (!dataPoints || dataPoints.length < 3) return [];
  
  const predictions = [];
  const lastIndex = dataPoints.length;
  
  switch (model) {
    case 'linear_regression': {
      const { slope, intercept } = linearRegression(dataPoints);
      for (let i = 1; i <= days; i++) {
        predictions.push(Math.max(0, slope * (lastIndex + i) + intercept));
      }
      break;
    }
    
    case 'exponential_smoothing': {
      const smoothed = exponentialSmoothing(dataPoints);
      const lastValue = smoothed[smoothed.length - 1];
      const trend = smoothed[smoothed.length - 1] - smoothed[smoothed.length - 2];
      for (let i = 1; i <= days; i++) {
        predictions.push(Math.max(0, lastValue + trend * i));
      }
      break;
    }
    
    case 'moving_average': {
      const avg = movingAverage(dataPoints);
      const recentAvg = avg.slice(-7).reduce((a, b) => a + b, 0) / 7;
      for (let i = 1; i <= days; i++) {
        predictions.push(recentAvg);
      }
      break;
    }
    
    case 'seasonal': {
      const seasonLength = 7; // Weekly pattern
      const seasonal = seasonalDecomposition(dataPoints, seasonLength);
      const trend = linearRegression(dataPoints);
      
      for (let i = 1; i <= days; i++) {
        const seasonalIndex = (lastIndex + i - 1) % seasonLength;
        const trendValue = trend.slope * (lastIndex + i) + trend.intercept;
        const seasonalFactor = seasonal[seasonalIndex] || seasonal[0];
        const overall = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
        
        // Combine trend with seasonal pattern
        predictions.push(Math.max(0, trendValue * (seasonalFactor / overall)));
      }
      break;
    }
    
    case 'polynomial': {
      const coeffs = polynomialRegression(dataPoints);
      
      if (!coeffs || !coeffs.a) {
        // Fall back to linear if polynomial fails
        const linear = linearRegression(dataPoints);
        for (let i = 1; i <= days; i++) {
          predictions.push(Math.max(0, linear.slope * (lastIndex + i) + linear.intercept));
        }
      } else {
        for (let i = 1; i <= days; i++) {
          const x = lastIndex + i;
          const y = coeffs.a * x * x + coeffs.b * x + coeffs.c;
          predictions.push(Math.max(0, y));
        }
      }
      break;
    }
    
    default:
      // Default to linear regression for unknown models
      const defaultLinear = linearRegression(dataPoints);
      for (let i = 1; i <= days; i++) {
        predictions.push(Math.max(0, defaultLinear.slope * (lastIndex + i) + defaultLinear.intercept));
      }
      break;
  }
  
  return predictions.map(v => Math.round(v * 100) / 100);
};

/**
 * Detect Anomalies - Identify outliers
 */
export const detectAnomalies = (dataPoints, method = 'z_score') => {
  if (!dataPoints || dataPoints.length < 3) return [];
  
  const mean = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;
  const stdDev = Math.sqrt(
    dataPoints.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dataPoints.length
  );
  
  const anomalies = [];
  
  dataPoints.forEach((value, index) => {
    const zScore = (value - mean) / stdDev;
    
    if (Math.abs(zScore) > 2.5) {
      anomalies.push({
        index,
        value,
        zScore,
        severity: Math.abs(zScore) > 3 ? 'critical' : 'warning',
        type: zScore > 0 ? 'spike' : 'drop'
      });
    }
  });
  
  return anomalies;
};

/**
 * Calculate Confidence Interval
 */
export const calculateConfidenceInterval = (predictions, confidence = 0.95) => {
  const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
  const stdDev = Math.sqrt(
    predictions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / predictions.length
  );
  
  const zScore = confidence === 0.95 ? 1.96 : 2.58; // 95% or 99%
  const margin = zScore * stdDev;
  
  return predictions.map(pred => ({
    value: pred,
    lower: Math.max(0, pred - margin),
    upper: pred + margin
  }));
};

/**
 * Generate Smart Insights
 */
export const generateInsights = (historicalData, predictions, anomalies) => {
  const insights = [];
  
  // Growth/Decline detection
  const recentTrend = historicalData.slice(-7);
  const oldTrend = historicalData.slice(-14, -7);
  const recentAvg = recentTrend.reduce((a, b) => a + b, 0) / recentTrend.length;
  const oldAvg = oldTrend.reduce((a, b) => a + b, 0) / oldTrend.length;
  const changePercent = ((recentAvg - oldAvg) / oldAvg) * 100;
  
  if (changePercent > 10) {
    insights.push({
      type: 'growth',
      message: `📈 Strong growth detected: ${changePercent.toFixed(1)}% increase over last week`,
      confidence: 0.85,
      action: 'Consider scaling infrastructure to handle increased load'
    });
  } else if (changePercent < -10) {
    insights.push({
      type: 'decline',
      message: `📉 Activity decline: ${Math.abs(changePercent).toFixed(1)}% decrease detected`,
      confidence: 0.80,
      action: 'Review user engagement strategies'
    });
  }
  
  // Anomaly insights
  if (anomalies.length > 0) {
    insights.push({
      type: 'anomaly',
      message: `⚠️ ${anomalies.length} anomalies detected in recent activity`,
      confidence: 0.90,
      action: 'Investigate unusual patterns or data quality issues'
    });
  }
  
  // Forecast insights
  if (predictions.length > 0) {
    const avgPrediction = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const forecastChange = ((avgPrediction - recentAvg) / recentAvg) * 100;
    
    insights.push({
      type: 'forecast',
      message: `🔮 Next week forecast: ${forecastChange > 0 ? '+' : ''}${forecastChange.toFixed(1)}% change expected`,
      confidence: 0.75,
      action: `Expected average: ${Math.round(avgPrediction)} per day`
    });
  }
  
  return insights;
};

/**
 * Format Prediction Data for Charts
 */
export const formatPredictionData = (historical, predictions, dates) => {
  return {
    labels: dates,
    datasets: [
      {
        label: 'Historical Data',
        data: historical,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      },
      {
        label: 'Forecast',
        data: [...Array(historical.length - 1).fill(null), historical[historical.length - 1], ...predictions],
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderDash: [5, 5],
        fill: true
      }
    ]
  };
};

/**
 * Export default configuration
 */
export default {
  PREDICTION_MODELS,
  PREDICTION_METRICS,
  ANOMALY_RULES,
  INSIGHT_TYPES,
  linearRegression,
  exponentialSmoothing,
  movingAverage,
  seasonalDecomposition,
  polynomialRegression,
  forecastNextDays,
  detectAnomalies,
  calculateConfidenceInterval,
  generateInsights,
  formatPredictionData
};
