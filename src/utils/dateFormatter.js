/**
 * Date Formatting Utilities
 * Lightweight, soft-coded date formatting without external dependencies
 */

/**
 * Format a timestamp to relative time (e.g., "2 hours ago", "just now")
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} - Formatted relative time string
 */
export const formatDistanceToNow = (timestamp) => {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    // Handle invalid dates
    if (isNaN(diffInSeconds)) {
      return 'recently'
    }

    // Just now (< 10 seconds)
    if (diffInSeconds < 10) {
      return 'just now'
    }

    // Seconds ago (< 60 seconds)
    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`
    }

    // Minutes ago (< 60 minutes)
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return diffInMinutes === 1 ? '1 minute ago' : `${diffInMinutes} minutes ago`
    }

    // Hours ago (< 24 hours)
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`
    }

    // Days ago (< 30 days)
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) {
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`
    }

    // Months ago (< 12 months)
    const diffInMonths = Math.floor(diffInDays / 30)
    if (diffInMonths < 12) {
      return diffInMonths === 1 ? '1 month ago' : `${diffInMonths} months ago`
    }

    // Years ago
    const diffInYears = Math.floor(diffInMonths / 12)
    return diffInYears === 1 ? '1 year ago' : `${diffInYears} years ago`
  } catch (error) {
    console.error('[Date Formatter] Error formatting date:', error)
    return 'recently'
  }
}

/**
 * Format a date to a readable string
 * @param {string|Date} date - The date to format
 * @param {string} format - Format type: 'short', 'long', 'time'
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, format = 'short') => {
  try {
    const d = new Date(date)
    
    if (isNaN(d.getTime())) {
      return 'Invalid date'
    }

    switch (format) {
      case 'short':
        // e.g., "Jan 21, 2026"
        return d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      
      case 'long':
        // e.g., "January 21, 2026"
        return d.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      
      case 'time':
        // e.g., "2:30 PM"
        return d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      
      case 'datetime':
        // e.g., "Jan 21, 2026 2:30 PM"
        return `${d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })} ${d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })}`
      
      default:
        return d.toLocaleDateString()
    }
  } catch (error) {
    console.error('[Date Formatter] Error formatting date:', error)
    return 'Invalid date'
  }
}

/**
 * Check if a date is today
 * @param {string|Date} date - The date to check
 * @returns {boolean}
 */
export const isToday = (date) => {
  try {
    const d = new Date(date)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  } catch (error) {
    return false
  }
}

/**
 * Check if a date is within the last N days
 * @param {string|Date} date - The date to check
 * @param {number} days - Number of days
 * @returns {boolean}
 */
export const isWithinDays = (date, days) => {
  try {
    const d = new Date(date)
    const now = new Date()
    const diffInDays = Math.floor((now - d) / (1000 * 60 * 60 * 24))
    return diffInDays <= days
  } catch (error) {
    return false
  }
}

export default {
  formatDistanceToNow,
  formatDate,
  isToday,
  isWithinDays
}
