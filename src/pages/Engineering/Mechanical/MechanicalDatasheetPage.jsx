import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CogIcon,
  CircleStackIcon,
  FireIcon,
  BeakerIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  BoltIcon
} from '@heroicons/react/24/outline';

/**
 * Mechanical Data Sheet Page
 * Central hub for all mechanical engineering data sheet functionality
 * Follows the same design pattern as Process, Instrument, Electrical, and Civil Data Sheets for consistency
 */
const MechanicalDatasheetPage = () => {
  const navigate = useNavigate();

  // Soft-coded data sheet types configuration for Mechanical Engineering
  const dataSheetTypes = [
    {
      id: 'pressure_vessel',
      name: 'Pressure Vessel Design',
      description: 'ASME pressure vessel design calculations, thickness determination, and stress analysis',
      icon: CircleStackIcon,
      color: 'indigo',
      gradient: 'from-indigo-500 to-blue-600',
      path: '/engineering/mechanical/datasheet/pressure-vessel',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'ASME Section VIII calculations',
        'Shell & head thickness',
        'Nozzle reinforcement',
        'Wind & seismic loads',
        'Stress analysis'
      ]
    },
    {
      id: 'heat_exchanger',
      name: 'Heat Exchanger Design',
      description: 'Thermal design, shell and tube calculations, and performance analysis',
      icon: FireIcon,
      color: 'indigo',
      gradient: 'from-blue-500 to-indigo-600',
      path: '/engineering/mechanical/datasheet/heat-exchanger',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'LMTD & NTU methods',
        'Heat duty calculations',
        'Tube side/shell side design',
        'Pressure drop analysis',
        'TEMA standards'
      ]
    },
    {
      id: 'rotating_equipment',
      name: 'Rotating Equipment',
      description: 'Pump, compressor, and turbine selection, sizing, and performance specifications',
      icon: ArrowPathIcon,
      color: 'indigo',
      gradient: 'from-indigo-600 to-blue-600',
      path: '/engineering/mechanical/datasheet/rotating-equipment',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Pump sizing & selection',
        'Compressor calculations',
        'NPSH calculations',
        'Power requirements',
        'Efficiency analysis'
      ]
    },
    {
      id: 'piping_stress',
      name: 'Piping Stress Analysis',
      description: 'Piping flexibility analysis, stress calculations, and support design',
      icon: BoltIcon,
      color: 'indigo',
      gradient: 'from-blue-600 to-indigo-700',
      path: '/engineering/mechanical/datasheet/piping-stress',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'ASME B31.3 compliance',
        'Thermal expansion',
        'Stress intensification',
        'Support spacing',
        'Nozzle loads'
      ]
    },
    {
      id: 'valve_sizing',
      name: 'Valve Sizing & Selection',
      description: 'Control valve, safety relief valve sizing, and selection calculations',
      icon: WrenchScrewdriverIcon,
      color: 'indigo',
      gradient: 'from-indigo-500 to-purple-600',
      path: '/engineering/mechanical/datasheet/valve',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Cv calculations',
        'Control valve sizing',
        'PSV/PRV sizing (API 520)',
        'Flashing & cavitation',
        'Noise analysis'
      ]
    },
    {
      id: 'hvac_design',
      name: 'HVAC Design',
      description: 'Heating, ventilation, and air conditioning load calculations and system design',
      icon: BeakerIcon,
      color: 'indigo',
      gradient: 'from-blue-500 to-cyan-600',
      path: '/engineering/mechanical/datasheet/hvac',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Cooling load calculations',
        'Heating load calculations',
        'Air flow requirements',
        'Duct sizing',
        'Equipment selection'
      ]
    },
    {
      id: 'static_equipment',
      name: 'Static Equipment Design',
      description: 'Storage tanks, columns, and vessel internals design and specifications',
      icon: CogIcon,
      color: 'indigo',
      gradient: 'from-indigo-600 to-blue-700',
      path: '/engineering/mechanical/datasheet/static-equipment',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Storage tank design (API 650)',
        'Column internals',
        'Tray & packing design',
        'Liquid holdup',
        'Separator sizing'
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
              Mechanical Data Sheets
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive mechanical engineering design calculations and specification system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm font-medium">
              Mechanical Engineering
            </span>
          </div>
        </div>
      </div>

      {/* Data Sheet Cards Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataSheetTypes.map((type) => {
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
                              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
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
        <div className="mt-8 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-1">
                About Mechanical Data Sheets
              </h4>
              <p className="text-sm text-indigo-800 dark:text-indigo-200">
                This centralized hub will provide access to all mechanical engineering data sheet functionality. 
                Comprehensive modules for pressure vessels (ASME), heat exchangers, rotating equipment, piping stress analysis, 
                valve sizing, HVAC design, and static equipment are currently under development. Each module will be designed 
                to streamline your mechanical engineering workflow with intelligent automation, industry-standard calculations 
                (ASME, API, TEMA), and comprehensive data management.
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
                All mechanical data sheet modules are currently under development and will be available soon. 
                We are building a comprehensive suite of tools to support your mechanical engineering design and calculation needs 
                following international standards (ASME, API, TEMA, B31.3, API 650).
                Check back regularly for updates and new module releases.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MechanicalDatasheetPage;
