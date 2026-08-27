/**
 * Smart Plant 3D Integration
 * Route:  /engineering/digitization/smart-plant-3d
 *
 * SmartPlant 3D data extraction, synchronization, and analysis hub.
 * Extract and process 3D model data, equipment specifications, and piping information
 * from SmartPlant 3D databases and models.
 *
 * Pattern: Similar to NonTeffMetadataPage with model upload and data extraction
 * Visual: Blue/cyan theme for 3D modeling focus
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../config/routes.config';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ArrowDownTrayIcon,
  CubeIcon,
  InformationCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
  LightBulbIcon,
  XMarkIcon,
  DocumentTextIcon,
  TableCellsIcon,
  CubeTransparentIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';
import { getApiBaseUrl } from '../../../config/environment.config';

// ---------------------------------------------------------------------------
// Feature Cards Configuration
// ---------------------------------------------------------------------------
const FEATURE_CARDS = [
  {
    id: 'valve-standards-reference',
    title: 'Valve Standards Reference',
    description: 'Browse and validate ASME B16.34 pressure-temperature ratings, wall thickness & material specs',
    icon: BookOpenIcon,
    path: ROUTES.VALVE_STANDARDS,
    badge: 'New',
  },
  {
    id: 'model-import',
    title: '3D Model Import',
    description: 'Import and extract data from SmartPlant 3D models and databases',
    icon: CubeIcon,
    comingSoon: true,
  },
  {
    id: 'equipment-extract',
    title: 'Equipment Extraction',
    description: 'Extract equipment specifications, tags, and attributes from 3D models',
    icon: TableCellsIcon,
    comingSoon: true,
  },
  {
    id: 'piping-data',
    title: 'Piping Data Sync',
    description: 'Synchronize piping specifications and line lists from SmartPlant 3D',
    icon: DocumentTextIcon,
    comingSoon: true,
  },
  {
    id: 'model-analytics',
    title: '3D Model Analytics',
    description: 'Analyze 3D model completeness, conflicts, and data quality',
    icon: SparklesIcon,
    comingSoon: true,
  },
];

const SmartPlant3DPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-8">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
            <CubeTransparentIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              Smart Plant 3D
            </h1>
            <p className="text-slate-600 mt-1">
              3D Model Data Extraction & Integration Hub
            </p>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
          <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/dashboard')}>
            Dashboard
          </span>
          <span>/</span>
          <span className="cursor-pointer hover:text-blue-600" onClick={() => navigate('/dashboard')}>
            Engineering
          </span>
          <span>/</span>
          <span className="cursor-pointer hover:text-blue-600">
            Digitization
          </span>
          <span>/</span>
          <span className="text-blue-600 font-medium">Smart Plant 3D</span>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg mb-6">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                SmartPlant 3D Integration Suite
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                Connect to SmartPlant 3D databases and models to extract equipment lists, piping data,
                and 3D model analytics. This module streamlines data synchronization between 3D design
                and engineering documentation systems.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {FEATURE_CARDS.map((card) => (
            <div
              key={card.id}
              onClick={() => card.path && navigate(card.path)}
              className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 p-6 border border-slate-200 relative overflow-hidden group ${card.path ? 'cursor-pointer' : ''}`}
            >
              {card.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold rounded-full shadow-sm">
                    Coming Soon
                  </span>
                </div>
              )}
              {card.badge && !card.comingSoon && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-semibold rounded-full shadow-sm">
                    {card.badge}
                  </span>
                </div>
              )}
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-lg group-hover:from-blue-200 group-hover:to-cyan-200 transition-colors">
                  <card.icon className="w-8 h-8 text-blue-600" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              {/* Decorative element */}
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/50 to-cyan-100/50 rounded-full blur-3xl -z-10 transform translate-x-16 translate-y-16 group-hover:scale-150 transition-transform duration-500" />
            </div>
          ))}
        </div>

        {/* Getting Started Section */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-slate-200">
          <div className="flex items-center gap-3 mb-6">
            <LightBulbIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-800">Getting Started</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Configure Database Connection</h4>
                <p className="text-slate-600 text-sm">
                  Set up connection to your SmartPlant 3D SQL Server database with appropriate credentials and access permissions.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Select Extraction Scope</h4>
                <p className="text-slate-600 text-sm">
                  Choose which data types to extract: equipment attributes, piping specifications, or complete model analytics.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold text-sm">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Extract & Export Data</h4>
                <p className="text-slate-600 text-sm">
                  Run extraction process and export results to Excel, CSV, or synchronize directly with your engineering documentation system.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-800 mb-1">Ready to integrate SmartPlant 3D?</h4>
                <p className="text-slate-600 text-sm">
                  Contact support to enable SmartPlant 3D integration for your organization.
                </p>
              </div>
              <button
                onClick={() => navigate('/contact-support')}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <span>Contact Support</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartPlant3DPage;
