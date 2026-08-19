import React from 'react'
import { RefreshCw } from 'lucide-react'

export const EmptyDataState = ({ 
  title = "No Data Available",
  message = "No data found in the system.",
  troubleshootingSteps = [
    "Check if any data has been added to the system",
    "Verify your access permissions", 
    "Contact your administrator if this issue persists"
  ],
  onRetry = null
}) => {
  const handleRetry = () => {
    console.log('🔄 Manual retry triggered from EmptyDataState');
    if (onRetry) {
      onRetry();
    } else {
      // Fallback: reload the page
      window.location.reload();
    }
  };

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <h2 className="text-yellow-800 dark:text-yellow-200 font-semibold mb-2 text-lg">
        {title}
      </h2>
      <p className="text-yellow-700 dark:text-yellow-300 mb-4">
        {message}
      </p>
      
      <div className="mt-4">
        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          Troubleshooting Steps:
        </h3>
        <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
          {troubleshootingSteps.map((step, index) => (
            <li key={index}>• {step}</li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleRetry}
        className="mt-6 flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Retry Loading Data
      </button>

      <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700 rounded-md">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Debug Info:</strong> Check browser console (F12) for detailed logs
        </p>
      </div>
    </div>
  )
}