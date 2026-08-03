import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable Info Card Component
 * Displays informational messages with consistent styling
 * 
 * @param {string} title - Card title
 * @param {string} content - Card content/message
 * @param {string} variant - Color variant (blue, green, yellow, red)
 */
const InfoCard = ({ title, content, variant = 'blue', className = '' }) => {
  const variantStyles = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-100',
      content: 'text-blue-800 dark:text-blue-200'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      title: 'text-green-900 dark:text-green-100',
      content: 'text-green-800 dark:text-green-200'
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      icon: 'text-yellow-600 dark:text-yellow-400',
      title: 'text-yellow-900 dark:text-yellow-100',
      content: 'text-yellow-800 dark:text-yellow-200'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400',
      title: 'text-orange-900 dark:text-orange-100',
      content: 'text-orange-800 dark:text-orange-200'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      title: 'text-red-900 dark:text-red-100',
      content: 'text-red-800 dark:text-red-200'
    }
  };

  const styles = variantStyles[variant] || variantStyles.blue;

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg 
            className={`w-6 h-6 ${styles.icon}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className={`text-sm font-semibold ${styles.title} mb-1`}>
            {title}
          </h4>
          <div className={`text-sm ${styles.content}`}>
            {typeof content === 'string' ? (
              <p dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              content
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

InfoCard.propTypes = {
  title: PropTypes.string.isRequired,
  content: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.node
  ]).isRequired,
  variant: PropTypes.oneOf(['blue', 'green', 'yellow', 'orange', 'red']),
  className: PropTypes.string
};

export default InfoCard;
