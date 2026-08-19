/**
 * ========================================================================
 * ADVANCED METRIC CARD COMPONENT
 * ========================================================================
 * Purpose: Intelligent metric display with trends, animations, and real-time updates
 * Features: Auto-refresh, trend indicators, color-coded thresholds, tooltips
 * Pattern: Soft-coded configuration-driven design
 * ========================================================================
 */

import React, { useEffect, useState } from 'react'
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import * as HeroIcons from '@heroicons/react/24/outline'
import { formatMetricValue, calculateTrend, getMetricColors } from '../../config/dashboardMetrics.config'

/**
 * Advanced Metric Card Component
 */
const AdvancedMetricCard = ({ 
  metricConfig, 
  value, 
  previousValue, 
  loading = false,
  onRefresh,
  size = 'medium',
  showTrend = true,
  showRefresh = false
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [displayValue, setDisplayValue] = useState(value)
  const [animateChange, setAnimateChange] = useState(false)

  // Get color scheme
  const colors = getMetricColors(metricConfig.color)

  // Get icon component
  const IconComponent = HeroIcons[metricConfig.icon] || HeroIcons.ChartBarIcon

  // Calculate trend
  const trend = showTrend && previousValue !== undefined 
    ? calculateTrend(value, previousValue)
    : null

  // Animate value changes
  useEffect(() => {
    if (value !== displayValue) {
      setAnimateChange(true)
      setDisplayValue(value)
      const timer = setTimeout(() => setAnimateChange(false), 600)
      return () => clearTimeout(timer)
    }
  }, [value])

  // Handle refresh
  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true)
      await onRefresh()
      setTimeout(() => setIsRefreshing(false), 1000)
    }
  }

  // Size classes
  const sizeClasses = {
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8'
  }

  const valueSizeClasses = {
    small: 'text-2xl',
    medium: 'text-3xl',
    large: 'text-4xl'
  }

  return (
    <div className={`
      bg-white rounded-xl shadow-sm border ${colors.border}
      hover:shadow-lg transition-all duration-300
      ${sizeClasses[size]}
      group relative overflow-hidden
    `}>
      {/* Background Gradient (Subtle) */}
      <div className={`
        absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.gradient}
        opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-full blur-3xl
      `} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative">
        <div className="flex items-center space-x-3">
          {/* Icon */}
          <div className={`
            ${colors.bg} rounded-lg p-2.5
            group-hover:scale-110 transition-transform duration-300
          `}>
            <IconComponent className={`w-5 h-5 ${colors.icon}`} />
          </div>

          {/* Label */}
          <div>
            <h3 className="text-sm font-medium text-gray-600">
              {metricConfig.label}
            </h3>
            {metricConfig.description && (
              <div className="group/tooltip relative inline-block">
                <InformationCircleIcon className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help inline ml-1" />
                <div className="
                  invisible group-hover/tooltip:visible
                  absolute left-0 top-6 z-50
                  bg-gray-900 text-white text-xs rounded-lg py-2 px-3
                  whitespace-nowrap shadow-xl
                  opacity-0 group-hover/tooltip:opacity-100
                  transition-all duration-200
                ">
                  {metricConfig.description}
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Refresh Button */}
        {showRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="
              text-gray-400 hover:text-gray-600 
              transition-colors duration-200
              disabled:opacity-50
            "
            title="Refresh metric"
          >
            <ArrowPathIcon className={`
              w-4 h-4
              ${isRefreshing ? 'animate-spin' : ''}
            `} />
          </button>
        )}
      </div>

      {/* Value */}
      <div className="relative">
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
          </div>
        ) : (
          <>
            {/* Main Value */}
            <div className={`
              ${valueSizeClasses[size]} font-bold ${colors.text}
              transition-all duration-300
              ${animateChange ? 'scale-110' : 'scale-100'}
            `}>
              {formatMetricValue(displayValue, metricConfig.type, metricConfig.unit)}
            </div>

            {/* Trend Indicator */}
            {trend && (
              <div className="flex items-center space-x-2 mt-2">
                {trend.direction === 'up' && (
                  <>
                    <ArrowTrendingUpIcon className={`
                      w-4 h-4
                      ${trend.isPositive ? 'text-green-500' : 'text-red-500'}
                    `} />
                    <span className={`
                      text-sm font-medium
                      ${trend.isPositive ? 'text-green-600' : 'text-red-600'}
                    `}>
                      +{trend.value}%
                    </span>
                  </>
                )}
                {trend.direction === 'down' && (
                  <>
                    <ArrowTrendingDownIcon className={`
                      w-4 h-4
                      ${!trend.isPositive ? 'text-red-500' : 'text-green-500'}
                    `} />
                    <span className={`
                      text-sm font-medium
                      ${!trend.isPositive ? 'text-red-600' : 'text-green-600'}
                    `}>
                      -{trend.value}%
                    </span>
                  </>
                )}
                {trend.direction === 'neutral' && (
                  <>
                    <MinusIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">No change</span>
                  </>
                )}
                <span className="text-xs text-gray-400">vs previous</span>
              </div>
            )}

            {/* Alert Badge (if configured) */}
            {metricConfig.alert && value >= metricConfig.alertThreshold && (
              <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse" />
                Attention needed
              </div>
            )}

            {/* Threshold Badge (if configured) */}
            {metricConfig.threshold && metricConfig.type === 'percentage' && (
              <div className="mt-2">
                {value >= metricConfig.threshold.high && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Excellent
                  </span>
                )}
                {value >= metricConfig.threshold.medium && value < metricConfig.threshold.high && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Good
                  </span>
                )}
                {value < metricConfig.threshold.medium && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    Needs Improvement
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Progress Bar (for percentage metrics) */}
      {!loading && metricConfig.type === 'percentage' && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div 
              className={`bg-gradient-to-r ${colors.gradient} h-1.5 rounded-full transition-all duration-1000 ease-out`}
              style={{ width: `${Math.min(value, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default AdvancedMetricCard
