/**
 * Features Browser Component
 * Advanced features exploration with search, filters, and multiple views
 */

import React, { useState, useMemo } from 'react'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ChartBarIcon,
  SparklesIcon,
  StarIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline'
import AdvancedFeatureCard from './AdvancedFeatureCard'
import {
  FEATURES_CATALOG,
  getAllFeatures,
  searchFeatures,
  getFeaturesByCategory,
  sortFeatures,
  getCategoryStats,
  FEATURE_STATUS
} from '../../config/featuresCatalog.config'

const FeaturesBrowser = ({ userModules = [], isAdmin = false }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortBy, setSortBy] = useState('popularity')
  const [viewMode, setViewMode] = useState('grid') // grid, list, compact
  const [showMetrics, setShowMetrics] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  // Get filtered and sorted features
  const filteredFeatures = useMemo(() => {
    let features = getAllFeatures()

    // Filter by search query
    if (searchQuery.trim()) {
      features = searchFeatures(searchQuery)
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      features = features.filter(f => f.categoryId === selectedCategory)
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      features = features.filter(f => f.status?.id === selectedStatus)
    }

    // Filter by user access
    if (!isAdmin) {
      features = features.filter(f => 
        !f.moduleCode || userModules.includes(f.moduleCode)
      )
    }

    // Sort features
    features = sortFeatures(features, sortBy)

    return features
  }, [searchQuery, selectedCategory, selectedStatus, sortBy, userModules, isAdmin])

  // Get statistics
  const stats = useMemo(() => {
    const allFeatures = getAllFeatures()
    return {
      total: allFeatures.length,
      ai: allFeatures.filter(f => f.badges?.some(b => b.id === 'ai')).length,
      popular: allFeatures.filter(f => f.badges?.some(b => b.id === 'popular')).length,
      new: allFeatures.filter(f => f.status?.id === 'new').length,
      filtered: filteredFeatures.length
    }
  }, [filteredFeatures])

  // Categories for filter
  const categories = Object.values(FEATURES_CATALOG)

  return (
    <div className="space-y-6">
      {/* Statistics Bar */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-sm text-gray-600 mt-1">Total Features</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{stats.ai}</p>
            <p className="text-sm text-gray-600 mt-1">AI-Powered</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-yellow-600">{stats.popular}</p>
            <p className="text-sm text-gray-600 mt-1">Popular</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{stats.new}</p>
            <p className="text-sm text-gray-600 mt-1">New</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-600">{stats.filtered}</p>
            <p className="text-sm text-gray-600 mt-1">Showing</p>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search features, capabilities, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white shadow-md text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Grid View"
            >
              <Squares2X2Icon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list' ? 'bg-white shadow-md text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="List View"
            >
              <ListBulletIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
              showFilters 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
              >
                <option value="all">All Status</option>
                {Object.values(FEATURE_STATUS).map(status => (
                  <option key={status.id} value={status.id}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
              >
                <option value="popularity">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="name">Name (A-Z)</option>
                <option value="category">Category</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {searchQuery ? `Search Results (${filteredFeatures.length})` : 'Available Features'}
        </h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showMetrics}
              onChange={(e) => setShowMetrics(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            Show Metrics
          </label>
        </div>
      </div>

      {/* Features Grid/List */}
      {filteredFeatures.length > 0 ? (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
            : viewMode === 'list'
            ? 'space-y-4'
            : 'grid grid-cols-1 md:grid-cols-3 gap-4'
        }>
          {filteredFeatures.map((feature) => (
            <AdvancedFeatureCard
              key={feature.id}
              feature={feature}
              showMetrics={showMetrics}
              compact={viewMode === 'compact'}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-200">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Features Found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery 
              ? `No features match "${searchQuery}". Try different keywords.`
              : 'No features available with current filters.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedCategory('all')
              setSelectedStatus('all')
            }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Category Breakdown */}
      {selectedCategory === 'all' && !searchQuery && (
        <div className="bg-white rounded-2xl border-2 border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Features by Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(category => {
              const categoryStats = getCategoryStats(category.id)
              return (
                <div
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="p-4 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{category.icon}</span>
                    <div>
                      <h4 className="font-bold text-gray-900">{category.name}</h4>
                      <p className="text-xs text-gray-500">{categoryStats.total} features</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-center font-semibold">
                      {categoryStats.active} Active
                    </div>
                    {categoryStats.ai > 0 && (
                      <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-center font-semibold">
                        {categoryStats.ai} AI
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default FeaturesBrowser
