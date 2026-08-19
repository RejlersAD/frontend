import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURES_CATALOG } from '../../config/featuresCatalog.config';
import { 
  ArrowLeftIcon,
  ArrowPathIcon,
  CalculatorIcon,
  ChartBarIcon,
  CheckCircleIcon,
  BeakerIcon,
  CogIcon
} from '@heroicons/react/24/outline';

/**
 * Pump Hydraulic Calculation Page
 * AI-powered pump sizing, selection, and hydraulic calculations
 * Soft-coded design for flexibility and maintainability
 */
const PumpHydraulicCalculation = () => {
  const navigate = useNavigate();
  
  // Get module name from centralized config
  const moduleConfig = FEATURES_CATALOG.engineering.features.find(
    feature => feature.id === 'eng-process-datasheet'
  );
  const MODULE_NAME = moduleConfig?.name || 'Process Datasheets';
  
  // State management - soft-coded for easy expansion
  const [calculationMode, setCalculationMode] = useState('');
  const [pumpType, setPumpType] = useState('');
  const [inputData, setInputData] = useState({
    flowRate: '',
    totalHead: '',
    suction: '',
    discharge: '',
    fluid: 'water',
    temperature: '',
    specificGravity: '1.0',
    viscosity: ''
  });

  // Soft-coded calculation modes
  const calculationModes = [
    {
      value: 'sizing',
      label: 'Pump Sizing',
      icon: '📏',
      description: 'Calculate required pump specifications'
    },
    {
      value: 'selection',
      label: 'Pump Selection',
      icon: '🎯',
      description: 'Select optimal pump from database'
    },
    {
      value: 'verification',
      label: 'Design Verification',
      icon: '✓',
      description: 'Verify existing pump design'
    },
    {
      value: 'optimization',
      label: 'Performance Optimization',
      icon: '⚡',
      description: 'Optimize pump performance'
    }
  ];

  // Soft-coded pump types
  const pumpTypes = [
    { 
      value: 'centrifugal', 
      label: 'Centrifugal Pump', 
      icon: '🔄',
      description: 'Most common for general applications'
    },
    { 
      value: 'positive_displacement', 
      label: 'Positive Displacement', 
      icon: '⚙️',
      description: 'For high pressure, viscous fluids'
    },
    { 
      value: 'multistage', 
      label: 'Multistage Centrifugal', 
      icon: '📊',
      description: 'For high head applications'
    },
    { 
      value: 'submersible', 
      label: 'Submersible Pump', 
      icon: '🌊',
      description: 'For submerged applications'
    }
  ];

  // Soft-coded fluid types
  const fluidTypes = [
    { value: 'water', label: 'Water', sg: '1.0' },
    { value: 'seawater', label: 'Seawater', sg: '1.025' },
    { value: 'oil_light', label: 'Light Oil', sg: '0.85' },
    { value: 'oil_medium', label: 'Medium Oil', sg: '0.90' },
    { value: 'diesel', label: 'Diesel', sg: '0.85' },
    { value: 'gasoline', label: 'Gasoline', sg: '0.74' },
    { value: 'crude_oil', label: 'Crude Oil', sg: '0.88' },
    { value: 'custom', label: 'Custom Fluid', sg: '' }
  ];

  // Calculation steps - soft-coded for flexibility
  const calculationSteps = [
    {
      id: 1,
      title: 'Select Calculation Mode',
      description: 'Choose your calculation objective',
      icon: CalculatorIcon,
      status: calculationMode ? 'completed' : 'current'
    },
    {
      id: 2,
      title: 'Choose Pump Type',
      description: 'Select appropriate pump category',
      icon: CogIcon,
      status: pumpType ? 'completed' : calculationMode ? 'current' : 'pending'
    },
    {
      id: 3,
      title: 'Input Parameters',
      description: 'Enter hydraulic requirements',
      icon: BeakerIcon,
      status: 'pending'
    },
    {
      id: 4,
      title: 'AI Calculation',
      description: 'Automated pump calculations',
      icon: ChartBarIcon,
      status: 'pending'
    },
    {
      id: 5,
      title: 'Results & Report',
      description: 'Review calculations and generate report',
      icon: CheckCircleIcon,
      status: 'pending'
    }
  ];

  const handleInputChange = (field, value) => {
    setInputData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-update specific gravity when fluid type changes
    if (field === 'fluid') {
      const selectedFluid = fluidTypes.find(f => f.value === value);
      if (selectedFluid && selectedFluid.sg) {
        setInputData(prev => ({
          ...prev,
          specificGravity: selectedFluid.sg
        }));
      }
    }
  };

  const isFormValid = () => {
    return calculationMode && 
           pumpType && 
           inputData.flowRate && 
           inputData.totalHead &&
           inputData.fluid;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header with Back Button */}
      <div className="max-w-7xl mx-auto mb-8">
        <button
          onClick={() => navigate('/engineering/process/datasheet')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>Back to {MODULE_NAME}</span>
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Pump Hydraulic Calculation
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered pump sizing, selection, and performance optimization
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              AI Powered
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Calculation Mode Selection */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Step 1: Select Calculation Mode
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {calculationModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => setCalculationMode(mode.value)}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-300 text-left
                      ${calculationMode === mode.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{mode.icon}</span>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {mode.label}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {mode.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Pump Type Selection */}
            {calculationMode && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Step 2: Select Pump Type
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pumpTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setPumpType(type.value)}
                      className={`
                        p-4 rounded-lg border-2 transition-all duration-300 text-left
                        ${pumpType === type.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'}
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{type.icon}</span>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {type.label}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Input Parameters */}
            {pumpType && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 animate-fadeIn">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Step 3: Enter Hydraulic Parameters
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Flow Rate */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Flow Rate (m³/h) *
                    </label>
                    <input
                      type="number"
                      value={inputData.flowRate}
                      onChange={(e) => handleInputChange('flowRate', e.target.value)}
                      placeholder="e.g., 100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Total Head */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Total Head (m) *
                    </label>
                    <input
                      type="number"
                      value={inputData.totalHead}
                      onChange={(e) => handleInputChange('totalHead', e.target.value)}
                      placeholder="e.g., 50"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Suction Pressure */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Suction Pressure (bar)
                    </label>
                    <input
                      type="number"
                      value={inputData.suction}
                      onChange={(e) => handleInputChange('suction', e.target.value)}
                      placeholder="e.g., 1.0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Discharge Pressure */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Discharge Pressure (bar)
                    </label>
                    <input
                      type="number"
                      value={inputData.discharge}
                      onChange={(e) => handleInputChange('discharge', e.target.value)}
                      placeholder="e.g., 6.0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Fluid Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Fluid Type *
                    </label>
                    <select
                      value={inputData.fluid}
                      onChange={(e) => handleInputChange('fluid', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {fluidTypes.map((fluid) => (
                        <option key={fluid.value} value={fluid.value}>
                          {fluid.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Temperature */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Temperature (°C)
                    </label>
                    <input
                      type="number"
                      value={inputData.temperature}
                      onChange={(e) => handleInputChange('temperature', e.target.value)}
                      placeholder="e.g., 20"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Specific Gravity */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Specific Gravity
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={inputData.specificGravity}
                      onChange={(e) => handleInputChange('specificGravity', e.target.value)}
                      placeholder="e.g., 1.0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Viscosity */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Viscosity (cP)
                    </label>
                    <input
                      type="number"
                      value={inputData.viscosity}
                      onChange={(e) => handleInputChange('viscosity', e.target.value)}
                      placeholder="e.g., 1.0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Calculate Button */}
                <button
                  disabled={!isFormValid()}
                  className={`
                    mt-6 w-full py-3 px-6 rounded-lg font-semibold text-white
                    transition-all duration-300 flex items-center justify-center gap-2
                    ${isFormValid()
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg hover:from-blue-600 hover:to-blue-700'
                      : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'}
                  `}
                >
                  <CalculatorIcon className="w-5 h-5" />
                  Calculate Pump Requirements
                </button>
              </div>
            )}
          </div>

          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sticky top-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Calculation Progress
              </h3>
              <div className="space-y-4">
                {calculationSteps.map((step, index) => {
                  const IconComponent = step.icon;
                  const isCompleted = step.status === 'completed';
                  const isCurrent = step.status === 'current';
                  
                  return (
                    <div key={step.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center
                          ${isCompleted 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : isCurrent
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : 'bg-gray-100 dark:bg-gray-700'}
                        `}>
                          <IconComponent className={`
                            w-5 h-5
                            ${isCompleted 
                              ? 'text-green-600 dark:text-green-400' 
                              : isCurrent
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400 dark:text-gray-500'}
                          `} />
                        </div>
                        {index < calculationSteps.length - 1 && (
                          <div className="w-0.5 h-12 bg-gray-200 dark:bg-gray-700 mt-2" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className={`
                          font-semibold text-sm
                          ${isCompleted || isCurrent
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'}
                        `}>
                          {step.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {step.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info Box */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>💡 Calculations Include:</strong><br/>
                  • Required pump power (BHP/kW)<br/>
                  • NPSH available & required<br/>
                  • System curve analysis<br/>
                  • Efficiency calculations<br/>
                  • Pump curve matching<br/>
                  • Vendor recommendations
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PumpHydraulicCalculation;
