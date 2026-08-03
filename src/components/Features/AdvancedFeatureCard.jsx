/**
 * Advanced Feature Card Component
 * Enhanced feature display with metrics, badges, and interactive elements
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ChartBarIcon, 
  StarIcon, 
  ClockIcon,
  ArrowTrendingUpIcon,
  SparklesIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'

const AdvancedFeatureCard = ({ feature, showMetrics = true, compact = false }) => {
  const navigate = useNavigate()

  // Badge color mapping
  const getBadgeColors = (badge) => {
    const colorMap = {
      purple: 'bg-purple-100 text-purple-700 border-purple-300',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      blue: 'bg-blue-100 text-blue-700 border-blue-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300',
      green: 'bg-green-100 text-green-700 border-green-300',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300'
    }
    return colorMap[badge.color] || 'bg-gray-100 text-gray-700 border-gray-300'
  }

  // Status badge colors
  const getStatusColors = (status) => {
    const colorMap = {
      active: 'bg-green-100 text-green-700',
      beta: 'bg-yellow-100 text-yellow-700',
      new: 'bg-blue-100 text-blue-700',
      preview: 'bg-purple-100 text-purple-700',
      coming_soon: 'bg-gray-100 text-gray-700'
    }
    return colorMap[status?.id] || 'bg-gray-100 text-gray-700'
  }

  // Category gradient mapping
  const getCategoryGradient = (color) => {
    const gradientMap = {
      blue: 'from-blue-500 to-indigo-600',
      purple: 'from-purple-500 to-pink-600',
      green: 'from-green-500 to-emerald-600',
      indigo: 'from-indigo-500 to-blue-600',
      orange: 'from-orange-500 to-red-600',
      red: 'from-red-500 to-pink-600'
    }
    return gradientMap[color] || 'from-gray-500 to-gray-600'
  }

  // Render star rating
  const renderRating = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        i <= Math.round(rating) ? (
          <StarIconSolid key={i} className="w-4 h-4 text-yellow-400" />
        ) : (
          <StarIcon key={i} className="w-4 h-4 text-gray-300" />
        )
      )
    }
    return <div className="flex items-center gap-0.5">{stars}</div>
  }

  if (compact) {
    return (
      <div
        onClick={() => feature.path && navigate(feature.path)}
        className="group relative bg-white rounded-xl border-2 border-gray-200 p-4 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
            {feature.shortName || feature.name}
          </h3>
          {feature.status && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColors(feature.status)}`}>
              {feature.status.label}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 line-clamp-2">{feature.description}</p>
        {feature.badges && feature.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {feature.badges.map((badge) => (
              <span
                key={badge.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getBadgeColors(badge)}`}
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={() => feature.path && navigate(feature.path)}
      className="group relative bg-white rounded-2xl border-2 border-gray-200 hover:border-blue-500 hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer"
    >
      {/* Decorative gradient bar */}
      <div className={`h-2 bg-gradient-to-r ${getCategoryGradient(feature.categoryColor)}`}></div>

      <div className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {feature.name}
              </h3>
              {feature.status && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColors(feature.status)}`}>
                  {feature.status.label}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 font-medium">{feature.categoryName}</p>
          </div>
          
          {/* Usage Stats Summary */}
          {showMetrics && feature.usageStats && (
            <div className="flex flex-col items-end gap-1">
              {feature.usageStats.avgRating && (
                <div className="flex items-center gap-2">
                  {renderRating(feature.usageStats.avgRating)}
                  <span className="text-sm font-semibold text-gray-700">
                    {feature.usageStats.avgRating.toFixed(1)}
                  </span>
                </div>
              )}
              {feature.usageStats.monthlyUses && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ChartBarIcon className="w-4 h-4" />
                  <span>{feature.usageStats.monthlyUses.toLocaleString()} uses/mo</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-4 line-clamp-2">
          {feature.longDescription || feature.description}
        </p>

        {/* Badges */}
        {feature.badges && feature.badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {feature.badges.map((badge) => (
              <span
                key={badge.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${getBadgeColors(badge)}`}
              >
                <span className="text-base">{badge.icon}</span>
                <span>{badge.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Key Capabilities */}
        {feature.capabilities && feature.capabilities.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <CheckCircleIcon className="w-4 h-4 text-green-600" />
              Key Capabilities
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {feature.capabilities.slice(0, 4).map((capability, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{capability}</span>
                </div>
              ))}
            </div>
            {feature.capabilities.length > 4 && (
              <p className="text-xs text-gray-500 mt-2">
                +{feature.capabilities.length - 4} more capabilities
              </p>
            )}
          </div>
        )}

        {/* Metrics Section */}
        {showMetrics && feature.metrics && Object.keys(feature.metrics).length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-blue-600" />
              Performance Metrics
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(feature.metrics).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-gray-500 mb-0.5">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </p>
                  <p className="text-lg font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {feature.usageStats?.totalUses && (
              <div className="flex items-center gap-1">
                <ArrowTrendingUpIcon className="w-4 h-4" />
                <span>{feature.usageStats.totalUses.toLocaleString()} total uses</span>
              </div>
            )}
            {feature.usageStats?.lastUsed && (
              <div className="flex items-center gap-1">
                <ClockIcon className="w-4 h-4" />
                <span>Last used {new Date(feature.usageStats.lastUsed).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          
          <button
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all font-medium group-hover:scale-105"
          >
            Open Feature →
          </button>
        </div>
      </div>
    </div>
  )
}

export default AdvancedFeatureCard
