import React from 'react'

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581m-2.62-7.38A7.974 7.974 0 0012 4a8 8 0 100 16 7.974 7.974 0 006.38-3.02M4.582 9A7.974 7.974 0 0112 20a8 8 0 100-16 7.974 7.974 0 00-6.38 3.02" />
  </svg>
)

export const ErrorState = ({ 
  error, 
  onRetry, 
  title = "Failed to Load Data",
  message = "Please check your internet connection and try again."
}) => (
  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
    <h2 className="text-red-800 dark:text-red-200 font-semibold mb-2 text-lg">
      {title}
    </h2>
    <p className="text-red-700 dark:text-red-300 mb-2">
      Error: {error}
    </p>
    <p className="text-sm text-red-600 dark:text-red-400 mb-4">
      {message}
    </p>
    <button
      onClick={onRetry}
      className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
    >
      <RefreshIcon />
      <span className="ml-2">Try Again</span>
    </button>
  </div>
)