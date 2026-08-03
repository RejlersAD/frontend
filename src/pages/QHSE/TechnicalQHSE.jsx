import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  DocumentMagnifyingGlassIcon,
  CogIcon,
  BeakerIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

/**
 * Technical QHSE Component
 * Quality, Health, Safety, and Environment - Technical Management
 */

const TechnicalQHSE = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')

  // Soft-coded feature cards configuration
  const featureCards = [
    {
      id: 'inspections',
      title: 'Technical Inspections',
      description: 'Equipment and facility inspections',
      icon: DocumentMagnifyingGlassIcon,
      color: 'indigo',
      gradient: 'from-indigo-500 to-purple-500',
      bgGradient: 'from-indigo-50 to-purple-50',
      onClick: () => console.log('Navigate to Technical Inspections')
    },
    {
      id: 'maintenance',
      title: 'Safety Maintenance',
      description: 'Safety equipment maintenance tracking',
      icon: WrenchScrewdriverIcon,
      color: 'orange',
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-50 to-amber-50',
      onClick: () => console.log('Navigate to Maintenance')
    },
    {
      id: 'testing',
      title: 'Safety Testing',
      description: 'Safety systems testing and validation',
      icon: BeakerIcon,
      color: 'teal',
      gradient: 'from-teal-500 to-cyan-500',
      bgGradient: 'from-teal-50 to-cyan-50',
      onClick: () => console.log('Navigate to Testing')
    },
    {
      id: 'certifications',
      title: 'Technical Certifications',
      description: 'Manage technical certifications',
      icon: CheckCircleIcon,
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50 to-emerald-50',
      onClick: () => console.log('Navigate to Certifications')
    }
  ]

  // Soft-coded tabs configuration
  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'equipment', label: 'Equipment', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'compliance', label: 'Compliance', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50 to-indigo-50 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
            <ShieldCheckIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Technical QHSE
            </h1>
            <p className="text-gray-600 mt-1">
              Technical Safety & Quality Management
            </p>
          </div>
        </div>
        
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <button onClick={() => navigate('/dashboard')} className="hover:text-purple-600">
            Dashboard
          </button>
          <span>/</span>
          <span className="text-purple-600 font-medium">Technical QHSE</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg mb-6">
        <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-purple-600 border-b-2 border-purple-600 bg-gradient-to-t from-purple-50 to-transparent'
                  : 'text-gray-600 hover:text-purple-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Technical QHSE Features</h2>
              
              {/* Feature Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {featureCards.map((feature) => (
                  <div
                    key={feature.id}
                    onClick={feature.onClick}
                    className={`bg-gradient-to-br ${feature.bgGradient} p-6 rounded-xl border-2 border-${feature.color}-200 shadow-lg hover:shadow-xl transition-all cursor-pointer group`}
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 bg-gradient-to-br ${feature.gradient} rounded-xl shadow-lg group-hover:scale-110 transition-transform`}>
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                        <p className="text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Info Section */}
              <div className="mt-8 bg-purple-50 border-l-4 border-purple-500 p-6 rounded-lg">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-lg font-semibold text-purple-900 mb-2">About Technical QHSE</h4>
                    <p className="text-purple-800">
                      Technical QHSE focuses on the engineering and technical aspects of safety and quality 
                      management. Manage equipment inspections, safety testing, maintenance schedules, and 
                      ensure all technical certifications are up to date.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'equipment' && (
            <div className="text-center py-12">
              <CogIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Equipment Management</h3>
              <p className="text-gray-600">Equipment tracking features coming soon...</p>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="text-center py-12">
              <CheckCircleIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Technical Compliance</h3>
              <p className="text-gray-600">Compliance tracking features coming soon...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TechnicalQHSE
