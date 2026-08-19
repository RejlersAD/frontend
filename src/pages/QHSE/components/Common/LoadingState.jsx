import React from 'react'

export const LoadingState = ({ 
  message = "Loading...", 
  subtitle = "Please wait while we fetch the data..." 
}) => (
  <div className="flex justify-center items-center min-h-[400px]">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <h2 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
        {message}
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  </div>
)