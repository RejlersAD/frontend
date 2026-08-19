import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BeakerIcon,
  CircleStackIcon,
  TableCellsIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
  CubeIcon,
  ArrowPathIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { FEATURES_CATALOG } from '../config/featuresCatalog.config';

/**
 * Process Data Sheet Page
 * Central hub for all process engineering data sheet functionality
 * Follows the same design pattern as Piping Data Sheets for consistency
 */
const ProcessDatasheetPage = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

  // Get module name from centralized config
  const moduleConfig = FEATURES_CATALOG.engineering.features.find(
    feature => feature.id === 'eng-process-datasheet'
  );
  const MODULE_NAME = moduleConfig?.name || 'Process Datasheets';

  // Soft-coded data sheet types configuration for Process Engineering
  const dataSheetTypes = [
    {
      id: 'pump_hydraulic',
      name: 'Pump Hydraulic Calculation',
      description: 'Advanced pump selection and hydraulic calculations with AI-powered optimization',
      icon: ArrowPathIcon,
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      path: '/engineering/process/datasheet/pfd',
      badge: 'AI Powered',
      features: [
        'Pump sizing & selection',
        'Head & NPSH calculations',
        'Power & efficiency analysis',
        'Pump curve matching',
        'System curve analysis'
      ]
    },
    {
      id: 'pressure_instrument',
      name: 'Pressure Instrument',
      description: 'Upload P&ID diagrams to detect and analyze pressure instruments automatically',
      icon: ChartBarIcon,
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600',
      path: '/engineering/process/datasheet/pressure-instrument',
      badge: 'Active',
      disabled: false,
      features: [
        'Pressure transmitter selection',
        'Range & accuracy specification',
        'Process connection sizing',
        'Output signal configuration',
        'Installation & calibration'
      ]
    },
    {
      id: 'equipment_datasheet',
      name: 'MOV Datasheets',
      description: 'Manage and generate datasheets for Motor Operated Valves (MOV)',
      icon: CubeIcon,
      color: 'emerald',
      gradient: 'from-emerald-500 to-emerald-600',
      path: '/engineering/process/datasheet/equipment',
      badge: 'Active',
      disabled: false,
      features: [
        'MOV specifications',
        'Actuator sizing',
        'Torque calculations',
        'Control requirements',
        'Installation details'
      ]
    },
    {
      id: 'stream_tables',
      name: 'SDV Datasheets',
      description: 'Manage and generate datasheets for Shut Down Valves (SDV)',
      icon: TableCellsIcon,
      color: 'amber',
      gradient: 'from-amber-500 to-amber-600',
      path: '/engineering/process/datasheet/streams',
      badge: 'Active',
      disabled: false,
      features: [
        'SDV specifications',
        'Fail-safe requirements',
        'Closure time calculations',
        'Safety integrity levels',
        'Emergency shutdown logic'
      ]
    },
    {
      id: 'process_simulation',
      name: 'Process Simulation Data',
      description: 'Integration with process simulation tools and data exchange',
      icon: ChartBarIcon,
      color: 'cyan',
      gradient: 'from-cyan-500 to-cyan-600',
      path: '/engineering/process/datasheet/simulation',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Simulation data import/export',
        'Model validation',
        'Optimization studies',
        'Sensitivity analysis',
        'Case comparison'
      ]
    },
    {
      id: 'utility_summary',
      name: 'Utility Summary',
      description: 'Track and analyze utility consumption across the process plant',
      icon: CircleStackIcon,
      color: 'rose',
      gradient: 'from-rose-500 to-rose-600',
      path: '/engineering/process/datasheet/utilities',
      badge: 'Coming Soon',
      disabled: true,
      features: [
        'Steam consumption',
        'Cooling water requirements',
        'Electrical load',
        'Instrument air',
        'Cost estimation'
      ]
    }
  ];

  const handleNavigate = (type) => {
    if (!type.disabled) {
      navigate(type.path);
    }
  };

  // Color map for badge & ring styles
  const colorMap = {
    blue:    { ring: 'ring-blue-400',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500',    glow: 'shadow-blue-200'   },
    purple:  { ring: 'ring-purple-400',  badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500', glow: 'shadow-purple-200' },
    emerald: { ring: 'ring-emerald-400', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', glow: 'shadow-emerald-200' },
    amber:   { ring: 'ring-amber-400',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',   glow: 'shadow-amber-200'  },
    cyan:    { ring: 'ring-cyan-400',    badge: 'bg-cyan-100 text-cyan-700',    dot: 'bg-cyan-500',    glow: 'shadow-cyan-200'   },
    rose:    { ring: 'ring-rose-400',    badge: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-500',    glow: 'shadow-rose-200'   },
  };

  return (
    <>
      {/* ── Keyframe animations ─────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes floatIcon {
          0%, 100% { transform: translateY(0px);  }
          50%       { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes pulseCTA {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,.45); }
          50%       { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
        }
        @keyframes orb {
          0%, 100% { transform: scale(1)   translate(0, 0);      }
          33%       { transform: scale(1.1) translate(20px,-15px); }
          66%       { transform: scale(.95) translate(-10px,10px); }
        }
        @keyframes badgePop {
          0%   { transform: scale(.7); opacity: 0; }
          70%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }
        .anim-fade-up   { animation: fadeSlideUp .55s ease both; }
        .anim-float     { animation: floatIcon 3.5s ease-in-out infinite; }
        .anim-shimmer-badge {
          background: linear-gradient(90deg, #dbeafe 25%, #e0e7ff 50%, #dbeafe 75%);
          background-size: 200% auto;
          animation: shimmer 2.4s linear infinite;
        }
        .anim-pulse-cta { animation: pulseCTA 2s ease-in-out infinite; }
        .anim-badge-pop { animation: badgePop .4s cubic-bezier(.34,1.56,.64,1) both; }
      `}</style>

    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 relative overflow-hidden">

      {/* Decorative floating orbs */}
      <div className="pointer-events-none select-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-100/60 blur-3xl" style={{animation:'orb 12s ease-in-out infinite'}} />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-indigo-100/50 blur-3xl" style={{animation:'orb 15s ease-in-out infinite reverse'}} />
        <div className="absolute top-1/2 left-1/2 w-60 h-60 rounded-full bg-cyan-50/60 blur-2xl" style={{animation:'orb 10s ease-in-out infinite 3s'}} />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`relative max-w-7xl mx-auto mb-10 anim-fade-up`} style={{animationDelay:'0ms'}}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          {/* Title block */}
          <div className="flex items-center gap-4">
            <div className="anim-float w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200 flex-shrink-0">
              <DocumentChartBarIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-3xl font-bold text-gray-900">{MODULE_NAME}</h1>
                <span className="anim-badge-pop px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold uppercase tracking-wide" style={{animationDelay:'300ms'}}>
                  Process Engineering
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-0.5">
                Comprehensive process engineering data management and analysis system
              </p>
            </div>
          </div>

          {/* Smart Analysis CTA */}
          <button
            onClick={() => navigate('/engineering/process/datasheet/smart')}
            className="anim-pulse-cta inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-200 flex-shrink-0"
          >
            <SparklesIcon className="w-5 h-5" />
            Smart Datasheet
          </button>
        </div>

        {/* AI capability strip */}
        <div className="flex flex-wrap gap-2 mt-5">
          {[
            '🤖 AI-Powered Analysis',
            '📊 Auto-Generated Reports',
            '⚡ Real-Time Calculations',
            '📂 PDF & Excel Export',
            '🔍 P&ID Integration',
          ].map((cap, i) => (
            <span
              key={cap}
              className="anim-fade-up inline-flex items-center px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-medium shadow-sm"
              style={{animationDelay:`${200 + i * 80}ms`}}
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      {/* ── Cards Grid ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataSheetTypes.map((type, idx) => {
            const IconComponent = type.icon;
            const isDisabled = type.disabled || false;
            const colors = colorMap[type.color] || colorMap.blue;

            return (
              <div
                key={type.id}
                onClick={() => handleNavigate(type)}
                className={[
                  'anim-fade-up group relative bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-300',
                  isDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : `cursor-pointer hover:-translate-y-2 hover:shadow-2xl ${colors.glow} hover:border-transparent`,
                ].join(' ')}
                style={{
                  boxShadow: '0 4px 24px 0 rgba(0,0,0,0.06)',
                  animationDelay: `${400 + idx * 100}ms`,
                }}
              >
                {/* Animated shimmer top bar */}
                <div className={`h-1.5 bg-gradient-to-r ${type.gradient} group-hover:h-2 transition-all duration-300`} />

                {/* Card body */}
                <div className="p-6">

                  {/* Icon + title row */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.gradient} flex items-center justify-center flex-shrink-0 shadow-md ${colors.glow} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 leading-tight">{type.name}</h3>
                      {type.badge && (
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full mt-1 ${
                          type.badge === 'AI Powered'
                            ? 'anim-shimmer-badge text-blue-700'
                            : type.badge === 'Active'
                            ? colors.badge
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {type.badge === 'AI Powered' && '✨ '}{type.badge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{type.description}</p>

                  {/* Feature list — items slide in on hover */}
                  <ul className="space-y-1.5 mb-5">
                    {type.features.slice(0, 3).map((feature, fi) => (
                      <li
                        key={fi}
                        className="flex items-center gap-2 text-sm text-gray-600 transition-transform duration-200 group-hover:translate-x-1"
                        style={{transitionDelay:`${fi * 40}ms`}}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA — rises from bottom on hover */}
                  {!isDisabled ? (
                    <div className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-center bg-gradient-to-r ${type.gradient} text-white opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-250 shadow-md`}>
                      Open {type.name} →
                    </div>
                  ) : (
                    <div className="w-full py-2.5 px-4 rounded-xl bg-gray-100 text-gray-400 text-sm text-center font-medium border border-dashed border-gray-200">
                      Coming Soon
                    </div>
                  )}
                </div>

                {/* Disabled overlay */}
                {isDisabled && (
                  <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px]" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Info Banner ──────────────────────────────────────────────────── */}
        <div
          className="anim-fade-up mt-8 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 flex items-start gap-4"
          style={{animationDelay:'1100ms'}}
        >
          <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center flex-shrink-0 shadow-sm">
            <SparklesIcon className="w-5 h-5 text-blue-600" style={{animation:'floatIcon 3s ease-in-out infinite'}} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-blue-900 mb-1">About {MODULE_NAME}</h4>
            <p className="text-sm text-blue-700 leading-relaxed">
              This centralized hub provides access to all process engineering data sheet functionality.
              Start with <strong>Pump Hydraulic Calculation</strong> for AI-powered pump sizing and optimization,
              or explore other modules. Each module is designed to streamline your process engineering
              workflow with intelligent automation and comprehensive data management.
            </p>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ProcessDatasheetPage;


