import React, { useState, useEffect } from 'react'
import { Clock, ShieldCheck } from 'lucide-react'

export const MainHeader = ({ 
  title = "QHSE Dashboard",
  subtitle = "Quality, Health, Safety & Environment Monitoring System",
  lastUpdated = null,
  dataLastChanged = null,
  isRefreshing = false,
  showLiveStatus = true,
  showLogo = true,
  logoUrl = null,
  darkLogoUrl = null,
  children = null
}) => {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      // ✅ UPDATED: Use data change time if available, fallback to fetch time
      const sourceTime = dataLastChanged || lastUpdated;
      
      if (!sourceTime) {
        setTimeAgo('');
        return;
      }

      const now = new Date();
      const diffMs = now - sourceTime;
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffDays > 0) {
        setTimeAgo(`Updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`);
      } else if (diffHours > 0) {
        setTimeAgo(`Updated ${diffHours}h ago`);
      } else if (diffMinutes > 0) {
        setTimeAgo(`Updated ${diffMinutes}m ago`);
      } else {
        setTimeAgo('Updated just now');
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000);

    return () => clearInterval(interval);
  }, [lastUpdated, dataLastChanged]);

  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
          {showLogo && (
            logoUrl ? (
              <img
                src={logoUrl}
                alt="QHSE Logo"
                className="drop-shadow-md w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="shrink-0 p-2.5 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                <ShieldCheck className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
              </div>
            )
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">
              {subtitle}
            </p>
            
            {showLiveStatus && <div className="pt-2 sm:p-2">
              <div className="flex items-start sm:items-center gap-2 text-green-700 dark:text-green-300">
                <div className={`w-2 h-2 shrink-0 mt-1 sm:mt-0 rounded-full animate-pulse ${
                  isRefreshing ? 'bg-blue-500' : 'bg-green-500'
                }`}></div>
                <span className="text-xs font-medium">
                  {isRefreshing ? 'Updating...' : 'Live data from PostgreSQL Database'}
                  {timeAgo && ` • ${timeAgo}`}
                </span>
              </div>
            </div>}
          </div>
        </div>
        
        {/* Control buttons */}
        {children && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}

