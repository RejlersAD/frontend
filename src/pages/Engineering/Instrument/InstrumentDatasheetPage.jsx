import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CpuChipIcon,
  SignalIcon,
  AdjustmentsHorizontalIcon,
  CircleStackIcon,
  ChartBarIcon,
  DocumentTextIcon,
  WrenchScrewdriverIcon,
  TableCellsIcon,
  RectangleStackIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

/**
 * Instrument Data Sheet Page
 * Central hub for all instrumentation engineering data sheet functionality
 * Follows the same design pattern as Process Datasheets for consistency
 */
// SOFT-CODED: IO List has been promoted to a first-class sub-feature under
// 1.3 Instrument (see engineeringStructure.config.js → instrumentIoList).
// Set this flag to true if you ever need to surface it inside the Datasheets
// hub again — no other change required.
const SHOW_IO_LIST_IN_DATASHEET_HUB = false;

const InstrumentDatasheetPage = () => {
  const navigate = useNavigate();

  // Soft-coded data sheet types configuration for Instrumentation Engineering
  const dataSheetTypes = [
    {
      id: 'io_list',
      name: 'IO List',
      description: 'Generate a canonical IO list from your instrument register, or run a deterministic quality check on an existing list.',
      icon: TableCellsIcon,
      color: 'purple',
      gradient: 'from-purple-600 to-indigo-600',
      path: '/engineering/instrument/datasheet/io-list',
      badge: 'Generator + QC',
      disabled: false,
      features: [
        'Excel / CSV ingestion',
        'Alias-tolerant headers',
        'Duplicate tag detection',
        'Signal type enum check',
        'Download as XLSX'
      ]
    },
    {
      id: 'cable_block_diagram',
      name: 'Cable Block Diagram',
      description: 'Aggregate IO points into cable bundles per panel and signal type for the cable block diagram, or QC an existing bundle list.',
      icon: RectangleStackIcon,
      color: 'purple',
      gradient: 'from-indigo-600 to-blue-600',
      path: '/engineering/instrument/datasheet/cable-block-diagram',
      badge: 'Generator + QC',
      disabled: false,
      features: [
        'Per-panel bundling',
        'Signal-type grouping',
        'Auto cable type mapping',
        'Source/destination check',
        'Block diagram export'
      ]
    },
    {
      id: 'cable_schedule',
      name: 'Cable Schedule',
      description: 'Synthesise a per-cable schedule from the IO list, or validate an existing schedule for duplicates and integrity issues.',
      icon: BoltIcon,
      color: 'purple',
      gradient: 'from-violet-600 to-fuchsia-600',
      path: '/engineering/instrument/datasheet/cable-schedule',
      badge: 'Generator + QC',
      disabled: false,
      features: [
        'One row per IO point',
        'Auto cable tag prefixing',
        'Length / cores validation',
        'Duplicate cable detection',
        'Excel download'
      ]
    },
    {
      id: 'control_valve',
      name: 'Control Valve Sizing',
      description: 'Comprehensive control valve selection, sizing, and specification generation',
      icon: AdjustmentsHorizontalIcon,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      path: '/engineering/instrument/datasheet/control-valve',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Cv calculation',
        'Valve sizing & selection',
        'Noise & cavitation analysis',
        'Actuator sizing',
        'Datasheet generation'
      ]
    },
    {
      id: 'flow_meter',
      name: 'Flow Meter Sizing',
      description: 'Flow meter selection and sizing for various measurement applications',
      icon: SignalIcon,
      color: 'purple',
      gradient: 'from-purple-500 to-indigo-600',
      path: '/engineering/instrument/datasheet/flow-meter',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Meter type selection',
        'Sizing calculations',
        'Accuracy requirements',
        'Installation guidelines',
        'Specification sheets'
      ]
    },
    {
      id: 'pressure_transmitter',
      name: 'Pressure Transmitters',
      description: 'Pressure measurement instrument selection and specification',
      icon: ChartBarIcon,
      color: 'purple',
      gradient: 'from-indigo-500 to-purple-600',
      path: '/engineering/instrument/datasheet/pressure',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Range selection',
        'Accuracy & calibration',
        'Process connection',
        'Output signal type',
        'Environmental specifications'
      ]
    },
    {
      id: 'temperature_instrument',
      name: 'Temperature Instruments',
      description: 'Temperature sensors, transmitters and thermowells specification',
      icon: WrenchScrewdriverIcon,
      color: 'purple',
      gradient: 'from-purple-600 to-pink-600',
      path: '/engineering/instrument/datasheet/temperature',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Sensor type selection (RTD, TC)',
        'Thermowell design',
        'Insertion length calculation',
        'Transmitter configuration',
        'Material selection'
      ]
    },
    {
      id: 'level_instrument',
      name: 'Level Measurement',
      description: 'Level instruments selection for tanks, vessels, and process applications',
      icon: CircleStackIcon,
      color: 'purple',
      gradient: 'from-purple-500 to-violet-600',
      path: '/engineering/instrument/datasheet/level',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Technology selection',
        'Range & accuracy',
        'Interface detection',
        'Tank specifications',
        'Installation requirements'
      ]
    },
    {
      id: 'analyzer',
      name: 'Analyzers & Sensors',
      description: 'Process analyzers, gas detectors, and analytical instrumentation',
      icon: CpuChipIcon,
      color: 'purple',
      gradient: 'from-violet-500 to-purple-600',
      path: '/engineering/instrument/datasheet/analyzer',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Analyzer type selection',
        'Sample system design',
        'Calibration requirements',
        'Response time',
        'Maintenance planning'
      ]
    },
    {
      id: 'safety_instrument',
      name: 'Safety Instrumented Systems',
      description: 'SIS design, SIL calculations, and safety instrument specifications',
      icon: DocumentTextIcon,
      color: 'purple',
      gradient: 'from-red-500 to-purple-600',
      path: '/engineering/instrument/datasheet/sis',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'SIL verification',
        'Safety function design',
        'Device selection (SIL rated)',
        'Redundancy configuration',
        'Proof test planning'
      ]
    }
  ];

  const handleNavigate = (type) => {
    if (!type.disabled) {
      navigate(type.path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Instrument Datasheets
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive instrumentation engineering data management and specification system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
              Instrumentation Engineering
            </span>
          </div>
        </div>
      </div>

      {/* Data Sheet Cards Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataSheetTypes
            .filter((type) => SHOW_IO_LIST_IN_DATASHEET_HUB || type.id !== 'io_list')
            .map((type) => {
            const IconComponent = type.icon;
            const isDisabled = type.disabled || false;

            return (
              <div
                key={type.id}
                className={`
                  relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden
                  transition-all duration-300
                  ${isDisabled 
                    ? 'opacity-60 cursor-not-allowed' 
                    : 'hover:shadow-2xl hover:-translate-y-1 cursor-pointer'}
                `}
                onClick={() => handleNavigate(type)}
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
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
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
                      onClick={() => handleNavigate(type)}
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
          })}
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-1">
                About Instrument Datasheets
              </h4>
              <p className="text-sm text-purple-800 dark:text-purple-200">
                This centralized hub will provide access to all instrumentation engineering data sheet functionality. 
                Comprehensive modules for control valves, flow meters, transmitters, analyzers, and safety instrumented systems 
                are currently under development. Each module will be designed to streamline your instrumentation engineering 
                workflow with intelligent automation, specification generation, and comprehensive data management.
              </p>
            </div>
          </div>
        </div>

        {/* Development Status Banner */}
        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                Under Development
              </h4>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                All instrumentation data sheet modules are currently under development and will be available soon. 
                We are building a comprehensive suite of tools to support your instrumentation engineering needs.
                Check back regularly for updates and new module releases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstrumentDatasheetPage;
