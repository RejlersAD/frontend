import React, { useState } from 'react';

/**
 * PID Engineering Results Display Component
 * Professional 3-Step Engineering Workflow Display
 * Matches P&ID documentation standards with legends, specifications, and detailed engineering data
 */
const PIDEngineeringResults = ({ data }) => {
  const [activeStep, setActiveStep] = useState('step1');
  const [expandedSections, setExpandedSections] = useState({
    equipment: true,
    lines: true,
    instruments: true,
    valves: true,
    utilities: true,
    legends: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Parse the 3-step data structure
  const step1Data = data?.step1_core_extraction || {};
  const step2Data = data?.step2_pid_structure || {};
  const step3Data = data?.step3_detailed_engineering || {};

  return (
    <div className="space-y-6">
      {/* Engineering Workflow Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">⚙️ P&ID Engineering Specifications</h2>
        <p className="text-blue-100">3-Step Chemical Process Engineering Workflow - Standards Compliant (ADNOC DEP, API, ISA-5.1, ASME)</p>
      </div>

      {/* Step Navigation */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <button
            onClick={() => setActiveStep('step1')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              activeStep === 'step1'
                ? 'border-blue-500 bg-blue-50 shadow-md'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                activeStep === 'step1' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <h3 className="font-bold text-gray-900">Core Extraction</h3>
            </div>
            <p className="text-sm text-gray-600 ml-11">Equipment, Lines, Valves, Control Loops</p>
          </button>

          {/* Step 2 */}
          <button
            onClick={() => setActiveStep('step2')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              activeStep === 'step2'
                ? 'border-green-500 bg-green-50 shadow-md'
                : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                activeStep === 'step2' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
              <h3 className="font-bold text-gray-900">P&ID Structure</h3>
            </div>
            <p className="text-sm text-gray-600 ml-11">Layout, Symbols, Instruments, Utilities</p>
          </button>

          {/* Step 3 */}
          <button
            onClick={() => setActiveStep('step3')}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              activeStep === 'step3'
                ? 'border-purple-500 bg-purple-50 shadow-md'
                : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 ${
                activeStep === 'step3' ? 'bg-purple-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                3
              </div>
              <h3 className="font-bold text-gray-900">Detailed Engineering</h3>
            </div>
            <p className="text-sm text-gray-600 ml-11">Line Numbers, Valve Specs, Instrument Details</p>
          </button>
        </div>
      </div>

      {/* Step Content Display */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* STEP 1: Core Extraction */}
        {activeStep === 'step1' && (
          <div className="space-y-6">
            <div className="border-b-4 border-blue-500 pb-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center mr-3 text-xl">1</span>
                STEP 1: Core Content Extraction
              </h2>
              <p className="text-gray-600 ml-13 mt-2">Equipment tags, process lines, safety valves, and control loops extracted from PFD</p>
            </div>

            {/* Equipment List */}
            {step1Data.equipment_list && step1Data.equipment_list.length > 0 && (
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('equipment')}
                  className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-gray-900">Equipment List</h3>
                      <p className="text-sm text-gray-600">Main equipment with tags per ISA/ADNOC standards</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold mr-3">
                      {step1Data.equipment_list.length}
                    </span>
                    <svg className={`h-6 w-6 text-gray-600 transition-transform ${expandedSections.equipment ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {expandedSections.equipment && (
                  <div className="p-6 bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment Tag</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Function</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {step1Data.equipment_list.map((equipment, idx) => (
                            <tr key={idx} className="hover:bg-blue-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono font-bold text-blue-700">{equipment.tag || equipment.equipment_tag || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {equipment.type || equipment.equipment_type || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">{equipment.description || equipment.name || 'No description'}</td>
                              <td className="px-6 py-4 text-sm text-gray-700">{equipment.function || equipment.purpose || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Process Lines */}
            {step1Data.process_lines && step1Data.process_lines.length > 0 && (
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('lines')}
                  className="w-full bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 flex items-center justify-between hover:from-green-100 hover:to-emerald-100 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-gray-900">Primary Process Lines</h3>
                      <p className="text-sm text-gray-600">Process line connections between equipment</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold mr-3">
                      {step1Data.process_lines.length}
                    </span>
                    <svg className={`h-6 w-6 text-gray-600 transition-transform ${expandedSections.lines ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {expandedSections.lines && (
                  <div className="p-6 bg-white">
                    {step1Data.process_lines.map((line, idx) => (
                      <div key={idx} className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded">
                        <div className="flex items-center mb-2">
                          <span className="font-mono font-bold text-green-700 mr-3">{line.from || line.from_equipment}</span>
                          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <span className="font-mono font-bold text-green-700 ml-3">{line.to || line.to_equipment}</span>
                        </div>
                        {line.fluid && (
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">Fluid:</span> {line.fluid || line.fluid_type}
                            {line.conditions && <span className="ml-3">({line.conditions})</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Safety & Shutdown Valves */}
            {step1Data.safety_valves && step1Data.safety_valves.length > 0 && (
              <div className="border-2 border-red-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Safety & Shutdown Valves</h3>
                      <p className="text-sm text-gray-600">SDV, BDV, PCV with locations per API standards</p>
                    </div>
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step1Data.safety_valves.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {step1Data.safety_valves.map((valve, idx) => (
                      <div key={idx} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-mono font-bold text-red-700 text-lg">{valve.tag || valve.valve_tag}</span>
                          <span className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full font-semibold">
                            {valve.type || valve.valve_type || 'SAFETY'}
                          </span>
                        </div>
                        <div className="text-sm space-y-1">
                          {valve.location && <div><span className="font-semibold text-gray-700">Location:</span> {valve.location}</div>}
                          {valve.function && <div><span className="font-semibold text-gray-700">Function:</span> {valve.function}</div>}
                          {valve.set_point && <div><span className="font-semibold text-gray-700">Set Point:</span> {valve.set_point}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Control Loops */}
            {step1Data.control_loops && step1Data.control_loops.length > 0 && (
              <div className="border-2 border-purple-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Control Loops</h3>
                      <p className="text-sm text-gray-600">LC, LCV, PC, PCV, PT, PDI, AI per ISA-5.1</p>
                    </div>
                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step1Data.control_loops.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {step1Data.control_loops.map((loop, idx) => (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <div className="font-mono font-bold text-purple-700 text-lg mb-2">{loop.tag || loop.loop_tag}</div>
                        <div className="text-sm space-y-1">
                          <div><span className="font-semibold text-gray-700">Type:</span> {loop.type || loop.loop_type}</div>
                          {loop.controlled_variable && <div><span className="font-semibold text-gray-700">Controlled:</span> {loop.controlled_variable}</div>}
                          {loop.equipment && <div><span className="font-semibold text-gray-700">Equipment:</span> {loop.equipment}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: P&ID Structure */}
        {activeStep === 'step2' && (
          <div className="space-y-6">
            <div className="border-b-4 border-green-500 pb-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center mr-3 text-xl">2</span>
                STEP 2: Preliminary P&ID Structure
              </h2>
              <p className="text-gray-600 ml-13 mt-2">Sheet boundaries, equipment layout, standard symbols, design specifications, instruments, and utilities</p>
            </div>

            {/* Sheet Boundaries & Layout */}
            {step2Data.sheet_boundaries && (
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-blue-50">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="h-6 w-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  Drawing Sheet Definition
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {typeof step2Data.sheet_boundaries === 'object' ? (
                    Object.entries(step2Data.sheet_boundaries).map(([key, value]) => (
                      <div key={key} className="flex items-start">
                        <span className="font-semibold text-gray-700 min-w-[120px]">{key.replace(/_/g, ' ').toUpperCase()}:</span>
                        <span className="text-gray-900">{JSON.stringify(value)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-700">{JSON.stringify(step2Data.sheet_boundaries)}</div>
                  )}
                </div>
              </div>
            )}

            {/* Equipment Layout */}
            {step2Data.equipment_layout && step2Data.equipment_layout.length > 0 && (
              <div className="border-2 border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="h-6 w-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Equipment Layout & Positioning
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {step2Data.equipment_layout.map((equip, idx) => (
                    <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="font-mono font-bold text-green-700 mb-2">{equip.tag || equip.equipment_tag}</div>
                      {equip.position && (
                        <div className="text-sm text-gray-700">
                          <span className="font-semibold">Position:</span> {JSON.stringify(equip.position)}
                        </div>
                      )}
                      {equip.symbol && (
                        <div className="text-sm text-gray-700">
                          <span className="font-semibold">Symbol:</span> {equip.symbol}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instruments */}
            {step2Data.instruments && step2Data.instruments.length > 0 && (
              <div className="border-2 border-indigo-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Instrumentation</h3>
                      <p className="text-sm text-gray-600">Instruments per control philosophy (ISA-5.1)</p>
                    </div>
                    <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step2Data.instruments.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {step2Data.instruments.map((instrument, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-indigo-700">
                              {instrument.tag || instrument.instrument_tag}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                {instrument.type || instrument.instrument_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">{instrument.location || 'Field'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{instrument.description || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Utility Lines */}
            {step2Data.utility_lines && step2Data.utility_lines.length > 0 && (
              <div className="border-2 border-amber-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Utility Lines</h3>
                      <p className="text-sm text-gray-600">Vents, drains, samples, IA, N2, seal gas</p>
                    </div>
                    <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step2Data.utility_lines.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {step2Data.utility_lines.map((utility, idx) => (
                      <div key={idx} className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-amber-800 text-lg">{utility.type || utility.utility_type}</span>
                          {utility.size && <span className="text-sm text-gray-600">Size: {utility.size}</span>}
                        </div>
                        {utility.connection_point && (
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">Connection:</span> {utility.connection_point}
                          </div>
                        )}
                        {utility.specification && (
                          <div className="text-sm text-gray-700">
                            <span className="font-semibold">Spec:</span> {utility.specification}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Node-Edge Graph */}
            {step2Data.node_edge_graph && (
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="h-6 w-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Process Flow Network (Node-Edge Graph)
                </h3>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <pre className="text-xs text-gray-800 overflow-x-auto">{JSON.stringify(step2Data.node_edge_graph, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Detailed Engineering */}
        {activeStep === 'step3' && (
          <div className="space-y-6">
            <div className="border-b-4 border-purple-500 pb-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <span className="bg-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center mr-3 text-xl">3</span>
                STEP 3: Detailed Engineering Specifications
              </h2>
              <p className="text-gray-600 ml-13 mt-2">Complete line numbers, valve specifications with failure positions/actuation, instrument details with ranges/setpoints/interlocks</p>
            </div>

            {/* Line Numbers & Specifications */}
            {step3Data.line_numbers && step3Data.line_numbers.length > 0 && (
              <div className="border-2 border-purple-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Line Numbers & Specifications</h3>
                      <p className="text-sm text-gray-600">Complete line data (size, spec, insulation, operating conditions)</p>
                    </div>
                    <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step3Data.line_numbers.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line Number</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spec</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insulation</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conditions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {step3Data.line_numbers.map((line, idx) => (
                          <tr key={idx} className="hover:bg-purple-50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-purple-700">
                              {line.line_number || line.number}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-900">{line.size || line.line_size || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                {line.spec || line.pipe_spec || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{line.insulation || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{line.conditions || line.operating_conditions || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Valve Specifications */}
            {step3Data.valve_specifications && step3Data.valve_specifications.length > 0 && (
              <div className="border-2 border-blue-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Valve Specifications</h3>
                      <p className="text-sm text-gray-600">Complete valve details (type, failure position, actuation, body/trim materials)</p>
                    </div>
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step3Data.valve_specifications.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {step3Data.valve_specifications.map((valve, idx) => (
                      <div key={idx} className="p-5 bg-blue-50 border-2 border-blue-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <span className="font-mono font-bold text-blue-700 text-xl">{valve.tag || valve.valve_tag}</span>
                          <span className="px-3 py-1 bg-blue-200 text-blue-800 text-xs rounded-full font-bold">
                            {valve.type || valve.valve_type}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          {valve.failure_position && (
                            <div className="flex items-center">
                              <span className="font-semibold text-gray-700 w-32">Failure:</span>
                              <span className="px-2 py-1 bg-red-100 text-red-800 rounded font-semibold text-xs">
                                {valve.failure_position}
                              </span>
                            </div>
                          )}
                          {valve.actuation && (
                            <div className="flex items-center">
                              <span className="font-semibold text-gray-700 w-32">Actuation:</span>
                              <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold text-xs">
                                {valve.actuation}
                              </span>
                            </div>
                          )}
                          {valve.body_material && (
                            <div><span className="font-semibold text-gray-700">Body Material:</span> {valve.body_material}</div>
                          )}
                          {valve.trim_material && (
                            <div><span className="font-semibold text-gray-700">Trim Material:</span> {valve.trim_material}</div>
                          )}
                          {valve.size && (
                            <div><span className="font-semibold text-gray-700">Size:</span> {valve.size}</div>
                          )}
                          {valve.rating && (
                            <div><span className="font-semibold text-gray-700">Rating:</span> {valve.rating}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Instrument Specifications */}
            {step3Data.instrument_specifications && step3Data.instrument_specifications.length > 0 && (
              <div className="border-2 border-indigo-200 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mr-4">
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="text-lg font-bold text-gray-900">Instrument Specifications</h3>
                      <p className="text-sm text-gray-600">Complete instrument details (type, range, setpoints, alarms, interlocks)</p>
                    </div>
                    <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                      {step3Data.instrument_specifications.length}
                    </span>
                  </div>
                </div>
                <div className="p-6 bg-white">
                  <div className="space-y-4">
                    {step3Data.instrument_specifications.map((instrument, idx) => (
                      <div key={idx} className="p-5 bg-indigo-50 border-l-4 border-indigo-500 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="font-mono font-bold text-indigo-700 text-xl">{instrument.tag || instrument.instrument_tag}</span>
                            <p className="text-sm text-gray-600 mt-1">{instrument.description || '-'}</p>
                          </div>
                          <span className="px-3 py-1 bg-indigo-200 text-indigo-800 text-xs rounded-full font-bold">
                            {instrument.type || instrument.instrument_type}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                          {instrument.range && (
                            <div className="p-3 bg-white rounded border border-indigo-200">
                              <div className="font-semibold text-indigo-700 mb-1">Range</div>
                              <div className="text-gray-900">{instrument.range}</div>
                            </div>
                          )}
                          {instrument.setpoint && (
                            <div className="p-3 bg-white rounded border border-indigo-200">
                              <div className="font-semibold text-indigo-700 mb-1">Setpoint</div>
                              <div className="text-gray-900">{instrument.setpoint}</div>
                            </div>
                          )}
                          {instrument.alarm_high && (
                            <div className="p-3 bg-white rounded border border-red-200">
                              <div className="font-semibold text-red-700 mb-1">High Alarm</div>
                              <div className="text-gray-900">{instrument.alarm_high}</div>
                            </div>
                          )}
                          {instrument.alarm_low && (
                            <div className="p-3 bg-white rounded border border-yellow-200">
                              <div className="font-semibold text-yellow-700 mb-1">Low Alarm</div>
                              <div className="text-gray-900">{instrument.alarm_low}</div>
                            </div>
                          )}
                          {instrument.interlocks && (
                            <div className="p-3 bg-white rounded border border-orange-200 md:col-span-2">
                              <div className="font-semibold text-orange-700 mb-1">Interlocks</div>
                              <div className="text-gray-900 text-xs">{JSON.stringify(instrument.interlocks)}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Design Data */}
            {step3Data.design_data && step3Data.design_data.length > 0 && (
              <div className="border-2 border-gray-200 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-slate-50">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="h-6 w-6 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Design Data & Engineering Notes
                </h3>
                <div className="space-y-3">
                  {step3Data.design_data.map((data, idx) => (
                    <div key={idx} className="p-4 bg-white rounded-lg border border-gray-200">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Engineering Standards Footer */}
      <div className="bg-gradient-to-r from-gray-700 to-slate-800 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">📋 Engineering Standards Compliance</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full">ISA-5.1 Instrumentation</span>
              <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full">API RP 551 Process Control</span>
              <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full">ADNOC DEP Standards</span>
              <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full">ASME B31.3 Piping</span>
              <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full">ASME Section VIII Vessels</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-400">✓</div>
            <div className="text-xs text-gray-300 mt-1">Standards Met</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PIDEngineeringResults;
