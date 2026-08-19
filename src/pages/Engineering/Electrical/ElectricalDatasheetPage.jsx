import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BoltIcon,
  CpuChipIcon,
  CircleStackIcon,
  ArrowLeftIcon,
  ServerIcon,
  PowerIcon
} from '@heroicons/react/24/outline';

/**
 * Electrical Data Sheet Page
 * Central hub for 6 electrical equipment datasheet types
 * Routes to Smart Datasheet Generator with pre-selected equipment type
 */
const ElectricalDatasheetPage = () => {
  const navigate = useNavigate();

  // 6 Equipment Types Configuration
  const dataSheetTypes = [
    {
      id: 'transformer',
      name: 'Transformers',
      fullName: 'Power & Distribution Transformers',
      description: 'AI-powered datasheet generation for power and distribution transformers with SLD analysis',
      icon: BoltIcon,
      emoji: '',
      color: 'blue',
      gradient: 'from-blue-500 to-indigo-600',
      path: '/engineering/electrical/datasheet/smart-generator?equipment=transformer',
      badge: 'AI Powered',
      features: [
        'SLD/Calculation Document Upload',
        'Technical Specification Analysis',
        'Automated Data Extraction',
        'Standards Compliance Check'
      ]
    },
    {
      id: 'dg_set',
      name: 'DG Set',
      fullName: 'Diesel Generator Sets',
      description: 'Smart datasheet generation for emergency diesel generators with load calculation',
      icon: CpuChipIcon,
      emoji: '',
      color: 'green',
      gradient: 'from-green-500 to-emerald-600',
      path: '/engineering/electrical/datasheet/smart-generator?equipment=dg_set',
      badge: 'AI Powered',
      features: [
        'SLD/Load List Processing',
        'Calculation Document Analysis',
        'Site Layout Integration',
        'Technical Specs Extraction'
      ]
    },
    {
      id: 'mv_switchgear',
      name: 'MV Switchgear',
      fullName: 'Medium Voltage Switchgear (11kV, 33kV)',
      description: 'Intelligent datasheet creation for MV switchgear with SLD drawing analysis',
      icon: CircleStackIcon,
      emoji: '',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-600',
      path: '/engineering/electrical/datasheet/smart-generator?equipment=mv_switchgear',
      badge: 'AI Powered',
      features: [
        'SLD Drawing Analysis',
        'Equipment Schedule Processing',
        'Protection Setting Review',
        'Technical Specification Mapping'
      ]
    },
    {
      id: 'lv_switchgear',
      name: 'LV Switchgear',
      fullName: 'Low Voltage Switchgear & Panels',
      description: 'Automated datasheet generation for LV switchgear with load schedule processing',
      icon: ServerIcon,
      emoji: '',
      color: 'yellow',
      gradient: 'from-yellow-500 to-orange-600',
      path: '/engineering/electrical/datasheet/smart-generator?equipment=lv_switchgear',
      badge: 'AI Powered',
      features: [
        'SLD Drawing Processing',
        'Load Schedule Analysis',
        'Panel Layout Review',
        'Cable Schedule Integration'
      ]
    },
    {
      id: 'ac_ups',
      name: 'AC UPS',
      fullName: 'AC Uninterruptible Power Supply',
      description: 'Smart datasheet generation for AC UPS systems with load calculation analysis',
      icon: PowerIcon,
      emoji: '',
      color: 'red',
      gradient: 'from-red-500 to-rose-600',
      path: '/engineering/electrical/datasheet/smart-generator?equipment=ac_ups',
      badge: 'AI Powered',
      features: [
        'Load Calculation Processing',
        'System Diagram Analysis',
        'Battery Sizing Review',
        'Technical Specs Extraction'
      ]
    },
    {
      id: 'dc_ups',
      name: 'DC UPS',
      fullName: 'DC Uninterruptible Power Supply',
      description: 'Intelligent datasheet creation for DC UPS with battery sizing calculations',
      icon: BoltIcon,
      emoji: '',
      color: 'indigo',
      gradient: 'from-indigo-500 to-purple-600',
      path: '/engineering/electrical/datasheet/smart-generator?equipment=dc_ups',
      badge: 'AI Powered',
      features: [
        'DC Load List Analysis',
        'Battery Sizing Calculations',
        'System Diagram Processing',
        'Technical Specification Review'
      ]
    }
  ];

  const handleNavigate = (type) => {
    navigate(type.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/engineering/electrical')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Electrical Engineering
          </button>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <BoltIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Electrical Equipment Datasheets</h1>
                <p className="text-gray-600 mt-1">AI-powered smart datasheet generation for 6 equipment types</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/engineering/electrical/datasheet/smart-generator')}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full text-sm font-semibold shadow-lg whitespace-nowrap hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                 Smart Datasheet Generator
              </button>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <BoltIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">AI-Powered Smart Generation</h3>
                <p className="text-sm text-blue-800">
                  Upload technical documents (PDF, Excel, Images) and let AI extract data to generate comprehensive datasheets automatically.
                  Select any equipment type below to start.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataSheetTypes.map((type) => {
            const IconComponent = type.icon;
            return (
              <div
                key={type.id}
                onClick={() => handleNavigate(type)}
                className="group relative bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden border border-gray-200 hover:border-blue-400 transform hover:-translate-y-1"
              >
                {/* Gradient Header */}
                <div className={`h-2 bg-gradient-to-r ${type.gradient}`}></div>

                {/* Content */}
                <div className="p-6">
                  {/* Icon and Badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 bg-gradient-to-br ${type.gradient} rounded-lg shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      {type.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="mb-3">
                    <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                      <span className="text-2xl">{type.emoji}</span>
                      {type.name}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium">{type.fullName}</p>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {type.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Key Features:</h4>
                    <ul className="space-y-1">
                      {type.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-xs text-gray-600 flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5"></span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Hover Arrow */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-semibold text-blue-600">
                      Generate 
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Info */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Select Equipment</h4>
                <p className="text-xs text-gray-600 mt-1">Choose from 6 equipment types</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Upload Documents</h4>
                <p className="text-xs text-gray-600 mt-1">PDF, Excel, or Images</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">AI Processing</h4>
                <p className="text-xs text-gray-600 mt-1">Automatic data extraction</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">Download</h4>
                <p className="text-xs text-gray-600 mt-1">Get complete Excel datasheet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectricalDatasheetPage;
