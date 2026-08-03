import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ENGINEERING_DISCIPLINES } from '../../../config/engineeringStructure.config';

/**
 * Piping Engineering Hub
 *
 * Landing page for /engineering/piping.
 *
 * Soft-coded: this page renders cards directly from the shared
 * ENGINEERING_DISCIPLINES.piping.subFeatures config. Adding/removing a
 * sub-feature in engineeringStructure.config.js automatically updates
 * this hub — there is no duplicated routing or feature metadata here.
 *
 * Mirrors the visual pattern used by ElectricalDocumentsHub /
 * PipingDataSheet so the look stays consistent across disciplines.
 */

// Soft-coded discipline key — single source of truth.
const DISCIPLINE_KEY = 'piping';

const PipingHub = () => {
  const navigate = useNavigate();
  const discipline = ENGINEERING_DISCIPLINES[DISCIPLINE_KEY];

  // Defensive: if the config is missing for any reason, render a minimal
  // fallback rather than crashing the route.
  if (!discipline) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">
          Piping discipline configuration is unavailable.
        </p>
      </div>
    );
  }

  const subFeatures = discipline.subFeatures || [];
  const HeaderIcon = discipline.icon;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {HeaderIcon && (
              <div className={`p-3 rounded-lg bg-gradient-to-r ${discipline.gradient}`}>
                <HeaderIcon className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                {discipline.fullName || discipline.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {discipline.description}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-medium">
            {discipline.name} Engineering
          </span>
        </div>
      </div>

      {/* Sub-Feature Cards Grid */}
      <div className="max-w-7xl mx-auto">
        {subFeatures.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center text-gray-600 dark:text-gray-400">
            No piping modules are configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => navigate(feature.path)}
                  className="group relative text-left bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <div className={`h-2 bg-gradient-to-r ${discipline.gradient}`} />
                  <div className="p-6">
                    <div className="flex items-start gap-3 mb-4">
                      {Icon && (
                        <div className={`p-3 rounded-lg bg-gradient-to-r ${discipline.gradient}`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          {feature.name}
                        </h3>
                        {feature.badge && (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full mt-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                            {feature.badge}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="text-sm font-medium text-orange-600 dark:text-orange-400 group-hover:underline">
                      Open {feature.name} →
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
            About Piping Engineering
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Centralized landing page for all piping engineering tools — critical line management,
            valve material take-off and piping datasheets. New modules added in the engineering
            structure configuration will appear here automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PipingHub;
