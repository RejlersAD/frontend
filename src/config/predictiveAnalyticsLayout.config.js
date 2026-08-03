/**
 * ==================================================================================
 * PREDICTIVE ANALYTICS LAYOUT CONFIGURATION
 * ==================================================================================
 * Professional layout structure for the Predictive Analytics Dashboard
 * All styling and positioning is soft-coded here for easy customization
 */

export const LAYOUT_CONFIG = {
  // Header Section Configuration
  header: {
    enabled: true,
    backgroundColor: 'bg-white',
    border: 'border-2 border-gray-200',
    shadow: 'shadow-sm',
    padding: 'p-6',
    borderRadius: 'rounded-xl',
    spacing: 'mb-6',
    
    title: {
      text: 'Predictive Analytics Dashboard',
      fontSize: 'text-2xl',
      fontWeight: 'font-bold',
      color: 'text-gray-900'
    },
    
    subtitle: {
      text: 'AI-powered forecasting with intelligent insights',
      fontSize: 'text-sm',
      color: 'text-gray-600'
    },
    
    icon: {
      gradient: 'from-purple-500 to-blue-500',
      size: 'w-8 h-8',
      padding: 'p-3',
      borderRadius: 'rounded-xl',
      shadow: 'shadow-lg'
    }
  },

  // Forecast Metrics Section
  forecastMetrics: {
    enabled: true,
    title: 'Forecast Metrics',
    titleIcon: 'ChartBarIcon',
    iconColor: 'text-blue-600',
    spacing: 'mb-6',
    
    grid: {
      cols: {
        mobile: 'grid-cols-1',
        tablet: 'md:grid-cols-2',
        desktop: 'lg:grid-cols-3',
        wide: 'xl:grid-cols-5'
      },
      gap: 'gap-4'
    },
    
    card: {
      padding: 'p-6',
      borderRadius: 'rounded-xl',
      border: 'border-2',
      shadow: 'hover:shadow-lg',
      transition: 'transition-all duration-200',
      cursor: 'cursor-pointer',
      
      selected: {
        scale: 'scale-[1.02]',
        shadow: 'shadow-lg'
      },
      
      miniChart: {
        height: 'h-12',
        gap: 'gap-1',
        borderRadius: 'rounded-t'
      }
    }
  },

  // Insights Panel Configuration
  insightsPanel: {
    enabled: true,
    gridColumns: 'lg:col-span-2', // Takes 2/3 of the row
    
    container: {
      background: 'bg-gradient-to-br from-purple-50 to-blue-50',
      border: 'border-2 border-purple-200',
      borderRadius: 'rounded-xl',
      padding: 'p-6'
    },
    
    header: {
      icon: {
        background: 'bg-purple-100',
        borderRadius: 'rounded-lg',
        padding: 'p-2',
        iconSize: 'w-6 h-6',
        iconColor: 'text-purple-600'
      },
      title: 'AI-Powered Insights',
      subtitle: 'Intelligent analysis and recommendations'
    },
    
    insightCard: {
      background: 'bg-white',
      border: 'border border-gray-200',
      borderRadius: 'rounded-lg',
      padding: 'p-4',
      spacing: 'space-y-3',
      hover: 'hover:shadow-md',
      transition: 'transition-shadow'
    }
  },

  // Models Panel Configuration
  modelsPanel: {
    enabled: true,
    gridColumns: 'lg:col-span-1', // Takes 1/3 of the row
    
    container: {
      background: 'bg-white',
      border: 'border-2 border-gray-200',
      borderRadius: 'rounded-xl',
      padding: 'p-6'
    },
    
    header: {
      icon: 'BeakerIcon',
      iconColor: 'text-indigo-600',
      title: 'Prediction Models',
      subtitle: 'Select forecasting algorithm'
    },
    
    modelCard: {
      padding: 'p-4',
      borderRadius: 'rounded-lg',
      border: 'border-2',
      spacing: 'space-y-3',
      cursor: 'cursor-pointer',
      transition: 'transition-all',
      hover: 'hover:shadow-md'
    }
  },

  // Anomalies Section Configuration
  anomaliesSection: {
    enabled: true,
    title: 'Anomaly Detection',
    titleIcon: 'ExclamationTriangleIcon',
    iconColor: 'text-amber-600',
    spacing: 'mb-6',
    
    container: {
      background: 'bg-amber-50',
      border: 'border-2 border-amber-200',
      borderRadius: 'rounded-xl',
      padding: 'p-6'
    },
    
    grid: {
      cols: {
        mobile: 'grid-cols-1',
        tablet: 'md:grid-cols-2',
        desktop: 'lg:grid-cols-3',
        wide: 'xl:grid-cols-4'
      },
      gap: 'gap-4'
    },
    
    anomalyCard: {
      background: 'bg-white',
      border: 'border border-amber-200',
      borderRadius: 'rounded-lg',
      padding: 'p-4',
      hover: 'hover:shadow-md',
      transition: 'transition-shadow'
    }
  },

  // Buttons Configuration
  buttons: {
    liveMode: {
      active: {
        background: 'bg-green-500',
        text: 'text-white',
        hover: 'hover:bg-green-600'
      },
      paused: {
        background: 'bg-gray-200',
        text: 'text-gray-700',
        hover: 'hover:bg-gray-300'
      },
      padding: 'px-5 py-2.5',
      borderRadius: 'rounded-lg',
      fontWeight: 'font-medium',
      transition: 'transition-all',
      shadow: 'shadow-sm'
    },
    
    refresh: {
      background: 'bg-blue-500',
      text: 'text-white',
      hover: 'hover:bg-blue-600',
      padding: 'px-5 py-2.5',
      borderRadius: 'rounded-lg',
      fontWeight: 'font-medium',
      transition: 'transition-all',
      shadow: 'shadow-sm'
    }
  },

  // Responsive Breakpoints
  breakpoints: {
    mobile: 'max-width: 640px',
    tablet: '640px - 1024px',
    desktop: '1024px - 1280px',
    wide: '1280px+'
  },

  // Color Palette (Soft-coded colors)
  colors: {
    metrics: {
      blue: {
        light: '#EFF6FF',
        main: '#3B82F6',
        dark: '#1E40AF',
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-500'
      },
      purple: {
        light: '#F5F3FF',
        main: '#A855F7',
        dark: '#7E22CE',
        bg: 'bg-purple-50',
        text: 'text-purple-600',
        border: 'border-purple-500'
      },
      emerald: {
        light: '#ECFDF5',
        main: '#10B981',
        dark: '#047857',
        bg: 'bg-emerald-50',
        text: 'text-emerald-600',
        border: 'border-emerald-500'
      },
      green: {
        light: '#F0FDF4',
        main: '#22C55E',
        dark: '#15803D',
        bg: 'bg-green-50',
        text: 'text-green-600',
        border: 'border-green-500'
      },
      amber: {
        light: '#FFFBEB',
        main: '#F59E0B',
        dark: '#B45309',
        bg: 'bg-amber-50',
        text: 'text-amber-600',
        border: 'border-amber-500'
      }
    },
    
    insights: {
      growth: { color: 'green', icon: 'ArrowTrendingUpIcon' },
      decline: { color: 'red', icon: 'ArrowTrendingDownIcon' },
      anomaly: { color: 'amber', icon: 'ExclamationTriangleIcon' },
      pattern: { color: 'blue', icon: 'ChartBarIcon' },
      forecast: { color: 'purple', icon: 'LightBulbIcon' },
      optimization: { color: 'indigo', icon: 'SparklesIcon' }
    }
  },

  // Typography
  typography: {
    pageTitle: 'text-2xl font-bold text-gray-900',
    sectionTitle: 'text-xl font-bold text-gray-900',
    cardTitle: 'font-semibold text-gray-900',
    description: 'text-sm text-gray-600',
    label: 'text-xs text-gray-500',
    value: 'text-lg font-bold',
    badge: 'text-xs font-medium'
  },

  // Spacing System
  spacing: {
    section: 'space-y-6',
    container: 'max-w-7xl mx-auto',
    cardGap: 'gap-4',
    elementGap: 'gap-3',
    smallGap: 'gap-2'
  }
};

/**
 * Layout Utility Functions
 */

export const getGridClasses = (section) => {
  const config = LAYOUT_CONFIG[section]?.grid;
  if (!config) return '';
  
  return `grid ${config.cols.mobile} ${config.cols.tablet} ${config.cols.desktop} ${config.cols.wide} ${config.gap}`;
};

export const getCardClasses = (section, isSelected = false) => {
  const config = LAYOUT_CONFIG[section]?.card;
  if (!config) return '';
  
  let classes = `${config.padding} ${config.borderRadius} ${config.border} ${config.transition} ${config.cursor}`;
  
  if (isSelected && config.selected) {
    classes += ` ${config.selected.scale} ${config.selected.shadow}`;
  }
  
  return classes;
};

export const getButtonClasses = (buttonType, state = 'default') => {
  const config = LAYOUT_CONFIG.buttons[buttonType];
  if (!config) return '';
  
  const stateConfig = config[state] || {};
  return `${config.padding} ${config.borderRadius} ${config.fontWeight} ${config.transition} ${config.shadow} ${stateConfig.background} ${stateConfig.text} ${stateConfig.hover}`;
};

/**
 * Export default configuration
 */
export default LAYOUT_CONFIG;
