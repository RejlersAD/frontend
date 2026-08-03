import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BuildingOfficeIcon,
  CubeTransparentIcon,
  BeakerIcon,
  ArrowPathIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  MapIcon,
} from '@heroicons/react/24/outline';

/**
 * Civil Data Sheet Page
 * Soft-coded hub for all civil engineering data sheet functionality.
 * All items are configured in the `dataSheetTypes` array below —
 * no code change required to add/remove/enable cards.
 */

// ─── Soft-coded card configuration ───────────────────────────────────────────
const dataSheetTypes = [
  {
    id: 'foundation_design',
    name: 'Foundation Design',
    description: 'Shallow and deep foundation analysis, bearing capacity calculations, and settlement analysis.',
    icon: BuildingOfficeIcon,
    gradient: 'from-amber-500 to-orange-600',
    path: '/engineering/civil/datasheet/foundation',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Bearing capacity (Terzaghi / Meyerhof)',
      'Settlement analysis',
      'Pile design (axial & lateral)',
      'Mat foundation calculations',
      'Soil-structure interaction',
    ],
  },
  {
    id: 'structural_design',
    name: 'Structural Analysis',
    description: 'Reinforced concrete and steel structural design calculations for industrial facilities.',
    icon: CubeTransparentIcon,
    gradient: 'from-orange-500 to-amber-700',
    path: '/engineering/civil/datasheet/structural',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'RC beam & column design',
      'Steel frame analysis',
      'Load combinations (dead/live/wind)',
      'Seismic load assessment',
      'Connection design',
    ],
  },
  {
    id: 'drainage_design',
    name: 'Drainage & Storm Water',
    description: 'Storm water runoff, drainage network sizing, and open channel hydraulics for industrial sites.',
    icon: BeakerIcon,
    gradient: 'from-sky-500 to-blue-600',
    path: '/engineering/civil/datasheet/drainage',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Rational method runoff',
      'Pipe sizing (Manning equation)',
      'Culvert design',
      'Open channel flow',
      'Retention pond design',
    ],
  },
  {
    id: 'road_pavement',
    name: 'Road & Pavement Design',
    description: 'Flexible and rigid pavement design, sub-base calculations, and road geometry for plant roads.',
    icon: MapIcon,
    gradient: 'from-stone-500 to-amber-600',
    path: '/engineering/civil/datasheet/road-pavement',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'AASHTO pavement design',
      'CBR-based sub-base sizing',
      'Flexible & rigid pavement',
      'Road cross-section geometry',
      'Earthworks volume calculations',
    ],
  },
  {
    id: 'retaining_wall',
    name: 'Retaining Wall Design',
    description: 'Gravity, cantilever, and sheet pile retaining wall stability and reinforcement calculations.',
    icon: ShieldCheckIcon,
    gradient: 'from-amber-600 to-yellow-700',
    path: '/engineering/civil/datasheet/retaining-wall',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Rankine / Coulomb earth pressure',
      'Overturning & sliding stability',
      'Cantilever wall reinforcement',
      'Sheet pile embedment depth',
      'Surcharge load effects',
    ],
  },
  {
    id: 'grading_earthworks',
    name: 'Grading & Earthworks',
    description: 'Site grading plans, cut-and-fill volume estimation, and compaction specifications.',
    icon: ArrowPathIcon,
    gradient: 'from-yellow-500 to-orange-500',
    path: '/engineering/civil/datasheet/grading',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Cut & fill volume calculation',
      'Mass haul diagram',
      'Compaction requirements',
      'Sub-grade preparation',
      'Borrow pit analysis',
    ],
  },
  {
    id: 'geotechnical',
    name: 'Geotechnical Report',
    description: 'Soil investigation interpretation, boring log analysis, and geotechnical parameter extraction.',
    icon: ChartBarIcon,
    gradient: 'from-orange-600 to-red-600',
    path: '/engineering/civil/datasheet/geotechnical',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'Boring log interpretation',
      'SPT N-value correlation',
      'Soil classification (USCS)',
      'Liquefaction assessment',
      'Design parameter summary',
    ],
  },
  {
    id: 'concrete_mix',
    name: 'Concrete Mix Design',
    description: 'ACI / BS concrete mix proportioning, admixture selection, and durability verification.',
    icon: WrenchScrewdriverIcon,
    gradient: 'from-amber-500 to-stone-600',
    path: '/engineering/civil/datasheet/concrete-mix',
    badge: 'Coming Soon',
    disabled: true,
    features: [
      'ACI 211 mix proportioning',
      'w/c ratio for durability',
      'Admixture dosage',
      'Compressive strength target',
      'Exposure class compliance',
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

const CivilDatasheetPage = () => {
  const navigate = useNavigate();

  const handleNavigate = (item) => {
    if (!item.disabled) {
      navigate(item.path);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Civil Data Sheets
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive civil engineering design calculations and specification system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium">
              Civil Engineering
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full text-sm font-medium">
              Coming Soon
            </span>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <BuildingOfficeIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 dark:text-amber-300 font-semibold text-sm">
              Civil Engineering Module — Under Development
            </p>
            <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
              These tools are currently in development. They will provide AI-assisted civil engineering
              calculations, design verification, and automated data sheet generation tailored to your
              project standards.
            </p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dataSheetTypes.map((item) => {
            const IconComponent = item.icon;
            const isDisabled = item.disabled ?? true;

            return (
              <div
                key={item.id}
                className={`
                  relative bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden
                  transition-all duration-300
                  ${isDisabled
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:shadow-2xl hover:-translate-y-1 cursor-pointer'}
                `}
                onClick={() => handleNavigate(item)}
              >
                {/* Gradient top bar */}
                <div className={`h-2 bg-gradient-to-r ${item.gradient}`} />

                {/* Card body */}
                <div className="p-6">
                  {/* Icon + Title */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${item.gradient} ${isDisabled ? 'opacity-50' : ''}`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          {item.name}
                        </h3>
                        {item.badge && (
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Features */}
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Key Features:
                    </p>
                    <ul className="space-y-1">
                      {item.features.slice(0, 3).map((feature, idx) => (
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

                  {/* Footer badge */}
                  <div className={`mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between`}>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {item.features.length} capabilities planned
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                      In Development
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CivilDatasheetPage;
