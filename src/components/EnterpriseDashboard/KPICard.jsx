/**
 * KPICard - Modern KPI Card Component
 * Displays key performance indicators with trend, icon, and mini sparkline
 * Fully reusable and responsive
 */
import React from 'react'
import { COLORS, ANIMATION_CONFIG } from '../../config/enterpriseDashboard.config'

const KPICard = ({
  title,
  value,
  subtitle,
  trend,
  trendDirection = 'up', // 'up' | 'down' | 'neutral'
  icon: Icon,
  color = 'blue',
  loading = false,
  onClick,
  sparklineData = [],
}) => {
  const getTrendColor = () => {
    if (trendDirection === 'up') return 'text-emerald-600'
    if (trendDirection === 'down') return 'text-red-600'
    return 'text-slate-500'
  }

  const getTrendIcon = () => {
    if (trendDirection === 'up') return '↑'
    if (trendDirection === 'down') return '↓'
    return '→'
  }

  const colorClasses = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
    pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
  }

  const colors = colorClasses[color] || colorClasses.blue

  return (
    <div
      className={`
        relative overflow-hidden bg-white rounded-2xl border ${colors.border} 
        shadow-sm hover:shadow-md transition-all duration-200
        ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
        ${ANIMATION_CONFIG.enabled ? 'group' : ''}
      `}
      onClick={onClick}
    >
      {/* Background gradient orb */}
      <div className={`absolute -top-8 -right-8 w-32 h-32 ${colors.bg} rounded-full blur-3xl opacity-40`} />
      
      <div className="relative p-5">
        {/* Header with icon */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
              {title}
            </p>
          </div>
          
          {Icon && (
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center ml-3`}>
              <Icon className={`w-5 h-5 ${colors.text}`} />
            </div>
          )}
        </div>

        {/* Value */}
        {loading ? (
          <div className="h-8 bg-slate-100 rounded-lg animate-pulse mb-2" />
        ) : (
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {value}
            </h3>
            
            {trend !== undefined && (
              <span className={`text-sm font-bold ${getTrendColor()} flex items-center gap-0.5`}>
                {getTrendIcon()}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs text-slate-600 leading-tight">
            {subtitle}
          </p>
        )}

        {/* Mini sparkline */}
        {sparklineData.length > 0 && (
          <div className="mt-3 h-8">
            <MiniSparkline data={sparklineData} color={colors.text} />
          </div>
        )}
      </div>
    </div>
  )
}

// Mini sparkline component
const MiniSparkline = ({ data, color }) => {
  if (!data || data.length < 2) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 100
  const height = 32

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((value - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg 
      width="100%" 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
        opacity="0.6"
      />
    </svg>
  )
}

export default KPICard
