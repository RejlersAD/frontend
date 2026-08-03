import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { 
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

import {
  DATA_GOVERNANCE_INFO,
  GOVERNANCE_CAPABILITIES,
  GOVERNANCE_FRAMEWORK,
  GOVERNANCE_BENEFITS,
  GOVERNANCE_PILLARS,
  COMPLIANCE_STANDARDS,
  GOVERNANCE_USE_CASES,
  TECHNOLOGY_STACK,
  GOVERNANCE_FAQ,
  GOVERNANCE_CTA,
  getCriticalBenefits
} from '../config/dataGovernance.config'

const DataGovernanceService = () => {
  const { isDarkMode } = useSelector((state) => state.theme)
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [expandedCapability, setExpandedCapability] = useState(null)
  const [expandedUseCase, setExpandedUseCase] = useState(null)

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id)
  }

  const toggleCapability = (id) => {
    setExpandedCapability(expandedCapability === id ? null : id)
  }

  const toggleUseCase = (id) => {
    setExpandedUseCase(expandedUseCase === id ? null : id)
  }

  const criticalBenefits = getCriticalBenefits()

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Hero Section */}
      <section className={`relative py-20 px-4 ${
        isDarkMode ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' : 'bg-gradient-to-br from-green-50 via-white to-blue-50'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <span className="text-green-500 text-sm font-semibold">
                {DATA_GOVERNANCE_INFO.moduleCode} v{DATA_GOVERNANCE_INFO.version}
              </span>
            </div>
            <h1 className={`text-5xl md:text-6xl font-bold mb-6 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {DATA_GOVERNANCE_INFO.title}
            </h1>
            <p className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {DATA_GOVERNANCE_INFO.tagline}
            </p>
            <p className={`text-lg mb-10 max-w-4xl mx-auto ${
              isDarkMode ? 'text-gray-400' : 'text-gray-700'
            }`}>
              {DATA_GOVERNANCE_INFO.description}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to={GOVERNANCE_CTA.primary.link}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {GOVERNANCE_CTA.primary.text}
              </Link>
              <Link
                to={GOVERNANCE_CTA.secondary.link}
                className={`px-8 py-4 rounded-lg border-2 font-semibold text-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'border-gray-600 text-gray-300 hover:border-green-500 hover:text-green-400' 
                    : 'border-gray-300 text-gray-700 hover:border-green-600 hover:text-green-600'
                }`}
              >
                {GOVERNANCE_CTA.secondary.text}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Measurable Business Value
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {GOVERNANCE_BENEFITS.map((benefit) => (
              <div
                key={benefit.id}
                className={`p-8 rounded-xl border-2 text-center transition-all duration-300 hover:scale-105 ${
                  benefit.impact === 'critical' || benefit.impact === 'high'
                    ? isDarkMode
                      ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50'
                      : 'border-green-200 bg-green-50 hover:border-green-400'
                    : isDarkMode
                    ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="text-5xl mb-4">{benefit.icon}</div>
                <div className={`text-4xl font-bold mb-2 ${
                  benefit.impact === 'critical' ? 'text-red-500' : benefit.impact === 'high' ? 'text-green-500' : 'text-blue-500'
                }`}>
                  {benefit.metric}
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {benefit.title}
                </h3>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Comprehensive Governance Capabilities
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            End-to-end data governance platform for enterprise data management
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {GOVERNANCE_CAPABILITIES.map((capability) => {
              const IconComponent = capability.icon
              const isExpanded = expandedCapability === capability.id
              return (
                <div
                  key={capability.id}
                  className={`rounded-xl overflow-hidden border transition-all duration-300 ${
                    isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`p-6 bg-gradient-to-br ${capability.color} bg-opacity-10`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${capability.color} flex items-center justify-center`}>
                        <IconComponent className="h-7 w-7 text-white" />
                      </div>
                      <button
                        onClick={() => toggleCapability(capability.id)}
                        className="text-white bg-black/20 hover:bg-black/30 p-2 rounded-lg transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUpIcon className="h-5 w-5" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                    <h3 className={`text-2xl font-bold mb-3 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {capability.title}
                    </h3>
                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                      {capability.description}
                    </p>
                    
                    {/* Key Metrics */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {Object.entries(capability.metrics).map(([key, value]) => (
                        <div key={key} className={`text-center p-2 rounded ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'}`}>
                          <div className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                            {value}
                          </div>
                          <div className={`text-xs capitalize ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                            {key}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                      <h4 className={`text-lg font-semibold mb-3 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        Key Features:
                      </h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {capability.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <CheckCircleIcon className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${
                              isDarkMode ? 'text-green-400' : 'text-green-600'
                            }`} />
                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Implementation Framework */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Implementation Framework
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Structured six-phase approach to data governance success
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {GOVERNANCE_FRAMEWORK.map((phase) => {
              const IconComponent = phase.icon
              return (
                <div
                  key={phase.id}
                  className={`relative p-6 rounded-xl ${
                    isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {/* Phase Number Badge */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {phase.step}
                  </div>
                  
                  <IconComponent className={`h-10 w-10 mb-3 mt-4 ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`} />
                  
                  <h3 className={`text-xl font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {phase.title}
                  </h3>
                  
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                    isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {phase.duration}
                  </span>
                  
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {phase.description}
                  </p>
                  
                  <div className={`border-t pt-3 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <p className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Deliverables:
                    </p>
                    <ul className="space-y-1">
                      {phase.deliverables.slice(0, 3).map((deliverable, idx) => (
                        <li key={idx} className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          • {deliverable}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Governance Pillars */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Four Pillars of Data Governance
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Comprehensive framework covering all aspects of data management
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GOVERNANCE_PILLARS.map((pillar) => (
              <div
                key={pillar.id}
                className={`p-6 rounded-xl border transition-all duration-300 hover:scale-105 ${
                  isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <div className="text-5xl mb-4 text-center">{pillar.icon}</div>
                <h3 className={`text-lg font-bold mb-4 text-center ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {pillar.pillar}
                </h3>
                <ul className="space-y-2">
                  {pillar.components.map((component, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {component}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Standards */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Compliance & Regulatory Support
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Built-in support for major global compliance standards
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPLIANCE_STANDARDS.map((standard) => (
              <div
                key={standard.id}
                className={`p-6 rounded-xl border ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className={`text-2xl font-bold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {standard.name}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                  }`}>
                    {standard.coverage}
                  </span>
                </div>
                <p className={`mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {standard.description}
                </p>
                <div className={`inline-block px-3 py-1 rounded-lg text-xs font-medium ${
                  isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                }`}>
                  Region: {standard.region}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Success Stories
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Real-world results from data governance implementations
          </p>
          <div className="space-y-6">
            {GOVERNANCE_USE_CASES.map((useCase) => {
              const isExpanded = expandedUseCase === useCase.id
              return (
                <div
                  key={useCase.id}
                  className={`rounded-xl overflow-hidden border ${
                    isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => toggleUseCase(useCase.id)}
                    className={`w-full p-6 flex items-center justify-between hover:bg-opacity-50 transition-all duration-300 ${
                      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                        }`}>
                          {useCase.industry}
                        </span>
                      </div>
                      <h3 className={`text-xl font-bold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {useCase.title}
                      </h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUpIcon className="h-6 w-6 text-green-500 flex-shrink-0 ml-4" />
                    ) : (
                      <ChevronDownIcon className="h-6 w-6 text-green-500 flex-shrink-0 ml-4" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className={`px-6 pb-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                      <div className="grid md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Challenge:
                          </h4>
                          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {useCase.challenge}
                          </p>
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Solution:
                          </h4>
                          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {useCase.solution}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className={`text-sm font-semibold mb-3 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Results Achieved:
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {useCase.results.map((result, idx) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-lg flex items-start ${
                                isDarkMode ? 'bg-gray-900' : 'bg-white'
                              }`}
                            >
                              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                              <span className={`font-medium ${
                                isDarkMode ? 'text-green-400' : 'text-green-600'
                              }`}>
                                {result}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Technology Partners
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(TECHNOLOGY_STACK).map(([category, tools]) => (
              <div
                key={category}
                className={`p-6 rounded-xl border ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <h3 className={`text-lg font-bold mb-4 capitalize ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {category.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {tools.map((tool, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-4xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Frequently Asked Questions
          </h2>
          <p className={`text-center text-lg mb-12 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Get answers to common data governance questions
          </p>
          <div className="space-y-4">
            {GOVERNANCE_FAQ.map((faq) => (
              <div
                key={faq.id}
                className={`rounded-xl overflow-hidden border ${
                  isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className={`w-full p-6 flex items-center justify-between text-left hover:bg-opacity-50 transition-all duration-300 ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`font-semibold text-lg pr-4 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {faq.question}
                  </span>
                  {expandedFaq === faq.id ? (
                    <ChevronUpIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
                  ) : (
                    <ChevronDownIcon className="h-6 w-6 text-green-500 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === faq.id && (
                  <div className={`px-6 pb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-20 px-4 ${
        isDarkMode ? 'bg-gradient-to-br from-green-900 via-emerald-900 to-gray-900' : 'bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Data?
          </h2>
          <p className="text-xl text-gray-200 mb-10">
            Start your data governance journey with a free maturity assessment
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to={GOVERNANCE_CTA.primary.link}
              className="px-8 py-4 bg-white text-green-600 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {GOVERNANCE_CTA.primary.text}
            </Link>
            <Link
              to={GOVERNANCE_CTA.demo.link}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white hover:text-green-600 transition-all duration-300 font-semibold text-lg"
            >
              {GOVERNANCE_CTA.demo.text}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default DataGovernanceService
