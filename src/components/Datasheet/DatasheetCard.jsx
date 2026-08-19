import React from 'react';
import PropTypes from 'prop-types';

/**
 * Reusable Datasheet Card Component
 * Provides consistent card UI across different engineering datasheet modules
 * 
 * @param {Object} type - Datasheet type configuration
 * @param {Function} onNavigate - Navigation handler function
 */
const DatasheetCard = ({ type, onNavigate }) => {
  const IconComponent = type.icon;
  const isDisabled = type.disabled || false;

  const handleClick = () => {
    if (!isDisabled && onNavigate) {
      onNavigate(type);
    }
  };

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden
        transition-all duration-300
        ${isDisabled 
          ? 'opacity-60 cursor-not-allowed' 
          : 'hover:shadow-2xl hover:-translate-y-1 cursor-pointer'}
      `}
      onClick={handleClick}
    >
      {/* Gradient Header */}
      <div className={`h-2 bg-gradient-to-r ${type.gradient}`} />
      
      {/* Card Content */}
      <div className="p-6">
        {/* Icon and Title */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`
              p-3 rounded-lg bg-gradient-to-r ${type.gradient} 
              ${isDisabled ? 'opacity-50' : ''}
            `}>
              <IconComponent className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {type.name}
              </h3>
              {type.badge && (
                <span className={`
                  inline-block px-2 py-1 text-xs font-medium rounded-full mt-1
                  ${type.badge === 'AI Powered' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : type.badge === 'New'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}
                `}>
                  {type.badge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
          {type.description}
        </p>

        {/* Features List */}
        {type.features && type.features.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Key Features:
            </p>
            <ul className="space-y-1">
              {type.features.slice(0, 3).map((feature, idx) => (
                <li 
                  key={idx} 
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Button */}
        {!isDisabled && (
          <button
            className={`
              w-full py-3 px-4 rounded-lg font-medium
              bg-gradient-to-r ${type.gradient}
              text-white hover:shadow-lg
              transition-all duration-300
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${type.color}-500
            `}
            onClick={handleClick}
          >
            Open {type.name}
          </button>
        )}
        
        {isDisabled && (
          <div className="w-full py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-center font-medium">
            Coming Soon
          </div>
        )}
      </div>

      {/* Disabled Overlay */}
      {isDisabled && (
        <div className="absolute inset-0 bg-gray-900/5 dark:bg-gray-900/20 backdrop-blur-[0.5px]" />
      )}
    </div>
  );
};

DatasheetCard.propTypes = {
  type: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    icon: PropTypes.elementType.isRequired,
    color: PropTypes.string,
    gradient: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    badge: PropTypes.string,
    disabled: PropTypes.bool,
    features: PropTypes.arrayOf(PropTypes.string)
  }).isRequired,
  onNavigate: PropTypes.func
};

export default DatasheetCard;
