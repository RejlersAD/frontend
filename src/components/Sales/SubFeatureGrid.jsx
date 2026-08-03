/**
 * Sub-Feature Grid Component
 * Smart, reusable grid for displaying sub-features with intelligent interactions
 * Supports actions, badges, and visual hierarchy
 */

import React from 'react';

const SubFeatureGrid = ({ subFeatures, onFeatureClick, columns = 3 }) => {
  if (!subFeatures || subFeatures.length === 0) {
    return null;
  }

  const getActionLabel = (action) => {
    const labels = {
      view: 'View',
      create: 'Create',
      analyze: 'Analyze',
      manage: 'Manage',
      browse: 'Browse',
      generate: 'Generate',
      configure: 'Configure',
      forecast: 'Forecast',
      predict: 'Predict',
      score: 'Score',
      monitor: 'Monitor',
      segment: 'Segment'
    };
    return labels[action] || 'Open';
  };

  const getActionIcon = (action) => {
    const icons = {
      view: '👁️',
      create: '✨',
      analyze: '🔬',
      manage: '⚙️',
      browse: '🔍',
      generate: '📝',
      configure: '🛠️',
      forecast: '🔮',
      predict: '🎯',
      score: '⭐',
      monitor: '📡',
      segment: '🎯'
    };
    return icons[action] || '→';
  };

  const gridColumns = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'
  };

  return (
    <div className={`grid ${gridColumns[columns]} gap-4`}>
      {subFeatures
        .filter(feature => feature.enabled)
        .map((feature, index) => (
          <button
            key={feature.id}
            onClick={() => onFeatureClick && onFeatureClick(feature)}
            disabled={!feature.enabled}
            className="group relative bg-white rounded-2xl shadow-lg border-2 border-gray-200 hover:border-blue-400 hover:shadow-2xl transition-all duration-300 p-6 text-left overflow-hidden transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
            
            <div className="relative z-10">
              {/* Header with Icon and Badge */}
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-3xl shadow-md transform group-hover:rotate-12 group-hover:scale-110 transition-all duration-300`}>
                  {feature.icon}
                </div>
                {feature.badge && (
                  <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-sm animate-pulse">
                    {feature.badge}
                  </span>
                )}
              </div>
              
              {/* Title */}
              <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              
              {/* Description */}
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                {feature.description}
              </p>
              
              {/* Action Button */}
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${feature.gradient} text-white text-xs font-semibold rounded-lg shadow-sm group-hover:shadow-md transition-shadow`}>
                  <span>{getActionIcon(feature.action)}</span>
                  <span>{getActionLabel(feature.action)}</span>
                </span>
                
                {/* Arrow indicator */}
                <div className="text-2xl text-gray-400 opacity-0 group-hover:opacity-100 transform translate-x-0 group-hover:translate-x-1 transition-all duration-300">
                  →
                </div>
              </div>
            </div>
            
            {/* Hover Glow Effect */}
            <div className={`absolute -inset-1 bg-gradient-to-r ${feature.gradient} rounded-2xl blur-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10`}></div>
          </button>
        ))}
    </div>
  );
};

export default SubFeatureGrid;
