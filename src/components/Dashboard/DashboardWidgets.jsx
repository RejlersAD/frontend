import React, { useState, useEffect } from 'react'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from '@heroicons/react/24/outline'
import { formatValue, getColorClasses } from '../../config/dashboard.config'

/**
 * Reusable Stat Card Component
 * Used for displaying key metrics with trends
 */
export const StatCard = ({ card, data, onClick }) => {
  const colors = getColorClasses(card.color)
  const value = data?.[card.dataKey] || 0
  const previousValue = data?.previous?.[card.dataKey] || 0
  const trend = value > previousValue ? 'up' : value < previousValue ? 'down' : 'neutral'
  const trendPercentage = previousValue ? (((value - previousValue) / previousValue) * 100).toFixed(1) : 0

  const IconComponent = card.icon

  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl shadow-lg transition-all duration-300
        ${onClick ? 'cursor-pointer hover:shadow-2xl hover:scale-105' : ''}
        bg-gradient-to-br ${colors.bg} border ${colors.border}
      `}
    >
      {/* Decorative gradient bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${colors.gradient}`} />
      
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-2">{card.label}</p>
            <h3 className="text-3xl font-bold text-gray-900 mb-2">
              {formatValue(value, card.format)}
            </h3>
            
            {card.showTrend && previousValue > 0 && (
              <div className="flex items-center space-x-2">
                {trend === 'up' && (
                  <>
                    <ArrowTrendingUpIcon className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">
                      +{trendPercentage}%
                    </span>
                  </>
                )}
                {trend === 'down' && (
                  <>
                    <ArrowTrendingDownIcon className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-600">
                      {trendPercentage}%
                    </span>
                  </>
                )}
                {trend === 'neutral' && (
                  <>
                    <MinusIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-500">
                      No change
                    </span>
                  </>
                )}
              </div>
            )}

            {card.alert && value >= card.alertThreshold && (
              <div className="mt-2 flex items-center space-x-1 text-xs text-amber-600 font-semibold">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span>Needs attention</span>
              </div>
            )}
          </div>

          <div className={`p-4 rounded-xl bg-gradient-to-br ${colors.gradient}`}>
            <IconComponent className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Department Activity Card
 */
export const DepartmentCard = ({ department, data }) => {
  const colors = getColorClasses(department.color)
  const IconComponent = department.icon

  return (
    <div className={`
      relative overflow-hidden rounded-xl shadow-md transition-all duration-300
      hover:shadow-lg bg-white border ${colors.border}
    `}>
      <div className={`h-1 w-full bg-gradient-to-r ${colors.gradient}`} />
      
      <div className="p-5">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colors.gradient}`}>
            <IconComponent className="w-5 h-5 text-white" />
          </div>
          <h4 className="text-lg font-bold text-gray-900">{department.name}</h4>
        </div>

        <div className="space-y-3">
          {department.metrics.map((metric) => (
            <div key={metric.key} className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{metric.label}</span>
              <span className={`text-sm font-bold ${colors.text}`}>
                {formatValue(data?.[metric.key] || 0, metric.format)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Notification Card Component
 */
export const NotificationCard = ({ notification, category }) => {
  const colors = getColorClasses(category.color)
  const IconComponent = category.icon
  const timeAgo = getTimeAgo(notification.timestamp)

  return (
    <div className={`
      flex items-start space-x-3 p-4 rounded-lg border ${colors.border}
      ${colors.bg} transition-all duration-200 hover:shadow-md
    `}>
      <div className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0`}>
        <IconComponent className="w-5 h-5 text-white" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <h5 className="text-sm font-semibold text-gray-900">{notification.title}</h5>
          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{timeAgo}</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
        {notification.action && (
          <button className={`
            text-xs font-semibold mt-2 ${colors.text} hover:underline
          `}>
            {notification.action}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * AI Insight Card
 */
export const AIInsightCard = ({ insight, category }) => {
  const colors = getColorClasses(category.color)
  const IconComponent = category.icon

  return (
    <div className={`
      relative overflow-hidden rounded-xl shadow-md transition-all duration-300
      hover:shadow-lg bg-white border ${colors.border}
    `}>
      <div className={`h-1 w-full bg-gradient-to-r ${colors.gradient}`} />
      
      <div className="p-5">
        <div className="flex items-start space-x-3 mb-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colors.gradient} flex-shrink-0`}>
            <IconComponent className="w-5 h-5 text-white" />
          </div>
          <div>
            <h5 className="text-sm font-bold text-gray-900">{insight.title}</h5>
            <p className="text-xs text-gray-500 mt-1">{category.title}</p>
          </div>
        </div>
        
        <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
        
        {insight.confidence && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">Confidence:</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${colors.gradient} transition-all duration-500`}
                style={{ width: `${insight.confidence}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-700">{insight.confidence}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Loading Skeleton
 */
export const SkeletonCard = () => (
  <div className="animate-pulse bg-white rounded-xl shadow-md p-6">
    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
    <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-200 rounded w-1/4" />
  </div>
)

/**
 * Helper Functions
 */
function getTimeAgo(timestamp) {
  const now = new Date()
  const time = new Date(timestamp)
  const diff = Math.floor((now - time) / 1000)

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default {
  StatCard,
  DepartmentCard,
  NotificationCard,
  AIInsightCard,
  SkeletonCard
}
