/**
 * AIInsightsPanel - AI-Powered Insights Widget
 * Displays intelligent insights and recommendations
 */
import React, { useState, useEffect } from 'react'
import { SparklesIcon, LightBulbIcon, TrophyIcon, BoltIcon } from '@heroicons/react/24/outline'
import { AI_INSIGHTS_CONFIG } from '../../config/enterpriseDashboard.config'

const AIInsightsPanel = () => {
  const [insights, setInsights] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    generateInsights()
    const interval = setInterval(generateInsights, AI_INSIGHTS_CONFIG.refreshInterval)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (insights.length <= 1) return
    
    const rotateInterval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % insights.length)
    }, 8000) // Rotate every 8 seconds

    return () => clearInterval(rotateInterval)
  }, [insights.length])

  const generateInsights = () => {
    // TODO: Connect to AI insights API when available
    // For now, use intelligent placeholder insights
    setInsights(INTELLIGENT_INSIGHTS)
  }

  const getInsightIcon = (type) => {
    switch (type) {
      case 'trend':
        return { Icon: TrophyIcon, color: 'text-blue-600', bg: 'bg-blue-50' }
      case 'alert':
        return { Icon: BoltIcon, color: 'text-amber-600', bg: 'bg-amber-50' }
      case 'recommendation':
        return { Icon: LightBulbIcon, color: 'text-purple-600', bg: 'bg-purple-50' }
      case 'achievement':
        return { Icon: TrophyIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' }
      default:
        return { Icon: SparklesIcon, color: 'text-orange-600', bg: 'bg-orange-50' }
    }
  }

  if (insights.length === 0) {
    return null
  }

  const currentInsight = insights[currentIndex]
  const { Icon, color, bg } = getInsightIcon(currentInsight.type)

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-pink-500 rounded-lg flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">AI Insights</h2>
          <p className="text-xs text-slate-500">Powered by RADAI Intelligence</p>
        </div>
      </div>

      {/* Insight card */}
      <div className="relative overflow-hidden bg-white rounded-xl border border-slate-200 p-4">
        {/* Animated gradient background */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full blur-3xl opacity-50" />
        
        <div className="relative">
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {currentInsight.type}
                </span>
                <span className="text-xs text-slate-400">
                  • Updated {currentInsight.timeAgo}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-2">
                {currentInsight.message}
              </p>

              {currentInsight.action && (
                <button className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors">
                  {currentInsight.action} →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation dots */}
      {insights.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {insights.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`
                w-1.5 h-1.5 rounded-full transition-all
                ${index === currentIndex 
                  ? 'bg-orange-500 w-6' 
                  : 'bg-slate-300 hover:bg-slate-400'
                }
              `}
              aria-label={`View insight ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Intelligent placeholder insights
const INTELLIGENT_INSIGHTS = [
  {
    type: 'trend',
    message: 'Engineering throughput increased 12% this week — P&ID processing peak identified at 10-11am',
    timeAgo: '2m ago',
    action: 'View analytics',
  },
  {
    type: 'alert',
    message: '5 procurement requests pending approval for more than 48 hours — review recommended',
    timeAgo: '15m ago',
    action: 'Review requests',
  },
  {
    type: 'achievement',
    message: '🎉 Milestone reached: 1,000+ documents processed with 94.2% AI accuracy',
    timeAgo: '1h ago',
    action: 'View report',
  },
  {
    type: 'recommendation',
    message: '3 users inactive for 15+ days — consider follow-up or account review',
    timeAgo: '3h ago',
    action: 'View users',
  },
  {
    type: 'trend',
    message: 'Payroll processing efficiency improved 8% — automation saving 12 hours/month',
    timeAgo: '5h ago',
    action: 'View metrics',
  },
]

export default AIInsightsPanel
