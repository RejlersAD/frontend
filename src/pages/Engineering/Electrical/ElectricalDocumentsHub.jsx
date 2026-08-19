import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RocketLaunchIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import {
  ELECTRICAL_DOCUMENTS,
  DOCUMENT_CATEGORIES,
  CATEGORY_DISPLAY_NAMES,
  CATEGORY_DESCRIPTIONS,
  getDocumentsByCategory,
  getCategoryStats,
  DOCUMENT_STATUS,
  ELECTRICAL_DOCUMENTS_FEATURE_ENABLED // SOFT-CODED: Feature flag for content visibility
} from '../../../config/electricalDocuments.config';

/**
 * Electrical Documents Hub - Smart Unified Interface
 * Configuration-driven approach handling all 27 electrical initiatives
 */
const ElectricalDocumentsHub = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedCategories, setExpandedCategories] = useState({
    [DOCUMENT_CATEGORIES.DATASHEETS]: true,
    [DOCUMENT_CATEGORIES.CALCULATIONS]: true,
    [DOCUMENT_CATEGORIES.DIAGRAMS]: true,
    [DOCUMENT_CATEGORIES.LOAD_LISTS]: true,
    [DOCUMENT_CATEGORIES.STUDIES]: true,
    [DOCUMENT_CATEGORIES.SCHEDULES]: true
  });

  // SOFT-CODED: Return "Coming Soon" page when feature is disabled
  if (!ELECTRICAL_DOCUMENTS_FEATURE_ENABLED) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {/* Coming Soon Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 border-4 border-yellow-400">
            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <RocketLaunchIcon className="h-14 w-14 text-white" />
              </div>
            </div>

            {/* Coming Soon Badge */}
            <div className="flex justify-center mb-4">
              <span className="inline-flex items-center px-6 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg">
                🚀 COMING SOON
              </span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-4">
              Electrical Engineering Documents
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-center text-gray-600 mb-8">
              Comprehensive suite of electrical engineering initiatives
            </p>

            {/* Description */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 mb-8 border border-yellow-200">
              <p className="text-center text-gray-700 leading-relaxed">
                We're working on something amazing! This module will include <span className="font-semibold text-yellow-700">27 electrical engineering initiatives</span> covering technical datasheets, calculations, diagrams, layouts, and schedules - everything you need in one unified platform.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">11+</div>
                <div className="text-sm text-gray-600">Datasheets</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-600">7+</div>
                <div className="text-sm text-gray-600">Diagrams</div>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-2xl font-bold text-amber-600">9+</div>
                <div className="text-sm text-gray-600">Tools</div>
              </div>
            </div>

            {/* Footer Message */}
            <div className="text-center">
              <p className="text-gray-500 text-sm">
                Stay tuned for updates! This feature is under active development.
              </p>
            </div>
          </div>

          {/* Bottom Note */}
          <div className="text-center mt-6">
            <p className="text-gray-600 text-sm">
              Questions? Contact your system administrator for more information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Debug log to verify component is rendering
  console.log('[ElectricalDocumentsHub] Component rendered');
  console.log('[ElectricalDocumentsHub] Total documents:', ELECTRICAL_DOCUMENTS.length);
  console.log('[ElectricalDocumentsHub] Categories:', Object.keys(DOCUMENT_CATEGORIES));

  const categoryStats = useMemo(() => getCategoryStats(), []);

  // Filter documents based on search, category, and status
  const filteredDocuments = useMemo(() => {
    return ELECTRICAL_DOCUMENTS.filter(doc => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.code.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;

      // Status filter
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, selectedCategory, statusFilter]);

  // Group filtered documents by category
  const groupedDocuments = useMemo(() => {
    const grouped = {};
    Object.values(DOCUMENT_CATEGORIES).forEach(category => {
      grouped[category] = filteredDocuments.filter(doc => doc.category === category);
    });
    return grouped;
  }, [filteredDocuments]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleDocumentClick = (doc) => {
    if (doc.status === DOCUMENT_STATUS.ACTIVE) {
      // SOFT-CODED: Use route from config if available, fallback to upload page
      const targetRoute = doc.route || '/engineering/electrical/datasheet/upload';
      navigate(targetRoute);
    } else {
      // Show coming soon message
      alert(`${doc.name} is ${doc.status === DOCUMENT_STATUS.COMING_SOON ? 'coming soon' : 'in development'}!`);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      [DOCUMENT_STATUS.ACTIVE]: {
        text: 'Available',
        colors: 'bg-green-100 text-green-800 border-green-200'
      },
      [DOCUMENT_STATUS.COMING_SOON]: {
        text: 'Coming Soon',
        colors: 'bg-yellow-100 text-yellow-800 border-yellow-200'
      },
      [DOCUMENT_STATUS.IN_DEVELOPMENT]: {
        text: 'In Development',
        colors: 'bg-blue-100 text-blue-800 border-blue-200'
      },
      [DOCUMENT_STATUS.BETA]: {
        text: 'Beta',
        colors: 'bg-purple-100 text-purple-800 border-purple-200'
      }
    };
    return badges[status] || badges[DOCUMENT_STATUS.COMING_SOON];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* DEBUG BANNER - Remove after verification */}
      <div className="bg-green-600 text-white text-center py-2 font-bold">
        ✅ Electrical Documents Hub - UPDATED & ACTIVE - {ELECTRICAL_DOCUMENTS.length} Documents Available
      </div>
      
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <RocketLaunchIcon className="h-8 w-8 text-indigo-600" />
                Electrical Engineering Documents
              </h1>
              <p className="mt-2 text-gray-600">
                Comprehensive suite of 27 electrical engineering initiatives - Technical data sheets, calculations, diagrams, layouts, and schedules
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(CATEGORY_DISPLAY_NAMES).map(([key, name]) => (
              <div key={key} className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-100">
                <div className="text-2xl font-bold text-indigo-600">
                  {categoryStats[key]?.total || 0}
                </div>
                <div className="text-xs text-gray-600 mt-1">{name}</div>
                <div className="text-xs text-green-600 mt-1">
                  {categoryStats[key]?.active || 0} Active
                </div>
              </div>
            ))}
          </div>

          {/* Search and Filters */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="relative">
              <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_DISPLAY_NAMES).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value={DOCUMENT_STATUS.ACTIVE}>Available</option>
                <option value={DOCUMENT_STATUS.COMING_SOON}>Coming Soon</option>
                <option value={DOCUMENT_STATUS.IN_DEVELOPMENT}>In Development</option>
                <option value={DOCUMENT_STATUS.BETA}>Beta</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* SOFT-CODED: Featured Tools Section - Universal Tools shown prominently */}
      {ELECTRICAL_DOCUMENTS.some(doc => doc.featured && doc.status === DOCUMENT_STATUS.ACTIVE) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl shadow-2xl p-8 text-white mb-8">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircleIcon className="h-8 w-8" />
              <h2 className="text-2xl font-bold">Universal AI-Powered Tools</h2>
            </div>
            <p className="text-purple-100 mb-6">
              Smart tools that work with ALL equipment types - Upload any electrical datasheet and get instant AI-powered quality analysis
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ELECTRICAL_DOCUMENTS.filter(doc => doc.featured && doc.status === DOCUMENT_STATUS.ACTIVE).map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="bg-white/10 backdrop-blur-lg hover:bg-white/20 rounded-xl p-6 text-left transition-all border-2 border-white/20 hover:border-white/40 hover:scale-105"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs font-mono text-purple-200 mb-1">{doc.code}</div>
                      <h3 className="text-xl font-bold text-white">{doc.name}</h3>
                    </div>
                    {doc.badge && (
                      <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-xs font-bold">
                        {doc.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-purple-100 mb-4">{doc.description}</p>
                  <div className="flex items-center gap-2 text-white font-semibold">
                    Launch Tool
                    <RocketLaunchIcon className="h-5 w-5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documents Grid - Organized by Category */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {Object.entries(DOCUMENT_CATEGORIES).map(([categoryKey, category]) => {
          const docs = groupedDocuments[category];
          if (docs.length === 0) return null;

          return (
            <div key={category} className="mb-8">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg`}>
                    {docs.length}
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-gray-900">
                      {CATEGORY_DISPLAY_NAMES[category]}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {CATEGORY_DESCRIPTIONS[category]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {docs.filter(d => d.status === DOCUMENT_STATUS.ACTIVE).length} of {docs.length} available
                  </span>
                  {expandedCategories[category] ? (
                    <ChevronUpIcon className="h-6 w-6 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Category Documents */}
              {expandedCategories[category] && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {docs.map((doc) => {
                    const statusBadge = getStatusBadge(doc.status);

                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleDocumentClick(doc)}
                        className={`
                          relative bg-white rounded-lg shadow-sm border border-gray-200 p-6
                          hover:shadow-lg hover:border-indigo-300 transition-all duration-200
                          ${doc.status === DOCUMENT_STATUS.ACTIVE ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}
                          group
                        `}
                      >
                        {/* Status Badge */}
                        <div className="absolute top-3 right-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadge.colors}`}>
                            {statusBadge.text}
                          </span>
                        </div>

                        {/* Icon Placeholder */}
                        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                          <RocketLaunchIcon className="h-8 w-8 text-white" />
                        </div>

                        {/* Document Code */}
                        <div className="text-xs font-mono text-gray-500 mb-1">
                          {doc.code}
                        </div>

                        {/* Document Name */}
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                          {doc.name}
                        </h3>

                        {/* Full Name */}
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          {doc.fullName}
                        </p>

                        {/* Description */}
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                          {doc.description}
                        </p>

                        {/* Hover Effect */}
                        {doc.status === DOCUMENT_STATUS.ACTIVE && (
                          <div className="absolute inset-0 border-2 border-transparent group-hover:border-indigo-500 rounded-lg pointer-events-none transition-colors duration-200"></div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* No Results */}
        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-6 border border-indigo-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            About Electrical Engineering Documents
          </h3>
          <p className="text-sm text-gray-700 mb-4">
            This comprehensive suite covers all aspects of electrical engineering documentation required for industrial and commercial projects. 
            From technical datasheets to single line diagrams, cable schedules to lighting calculations - everything you need in one unified platform.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">
            <div>
              <div className="font-semibold text-gray-900">Datasheets</div>
              <div className="text-gray-600">11 types covering all major electrical equipment</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Calculations</div>
              <div className="text-gray-600">Engineering design calculations</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Diagrams</div>
              <div className="text-gray-600">7 SLD categories for complete systems</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Layouts</div>
              <div className="text-gray-600">6 layout types including lighting & earthing</div>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Schedules</div>
              <div className="text-gray-600">Cable, MTO, and interconnection schedules</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectricalDocumentsHub;
 