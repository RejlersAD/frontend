import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { 
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

import {
  ASSET_SERVICE_INFO,
  ASSET_FEATURES,
  INTEGRITY_PROCESS,
  ASSET_BENEFITS,
  ASSET_CATEGORIES,
  MONITORING_TECHNOLOGIES,
  COMPLIANCE_STANDARDS,
  INDUSTRY_USE_CASES,
  TECHNICAL_SPECS,
  ASSET_FAQ,
  ASSET_CTA,
  getHighImpactBenefits
} from '../config/assetIntegrity.config'

const AssetIntegrityService = () => {
  const { isDarkMode } = useSelector((state) => state.theme)
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id)
  }

  const toggleCategory = (id) => {
    setExpandedCategory(expandedCategory === id ? null : id)
  }

  const highImpactBenefits = getHighImpactBenefits()

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Hero Section */}
      <section className={`relative py-20 px-4 ${
        isDarkMode ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' : 'bg-gradient-to-br from-blue-50 via-white to-purple-50'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
              <span className="text-blue-500 text-sm font-semibold">
                {ASSET_SERVICE_INFO.moduleCode} v{ASSET_SERVICE_INFO.version}
              </span>
            </div>
            <h1 className={`text-5xl md:text-6xl font-bold mb-6 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {ASSET_SERVICE_INFO.title}
            </h1>
            <p className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {ASSET_SERVICE_INFO.tagline}
            </p>
            <p className={`text-lg mb-10 max-w-4xl mx-auto ${
              isDarkMode ? 'text-gray-400' : 'text-gray-700'
            }`}>
              {ASSET_SERVICE_INFO.description}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to={ASSET_CTA.primary.link}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {ASSET_CTA.primary.text}
              </Link>
              <Link
                to={ASSET_CTA.secondary.link}
                className={`px-8 py-4 rounded-lg border-2 font-semibold text-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'border-gray-600 text-gray-300 hover:border-blue-500 hover:text-blue-400' 
                    : 'border-gray-300 text-gray-700 hover:border-blue-600 hover:text-blue-600'
                }`}
              >
                {ASSET_CTA.secondary.text}
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
            Measurable Business Impact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ASSET_BENEFITS.map((benefit) => (
              <div
                key={benefit.id}
                className={`p-8 rounded-xl border-2 transition-all duration-300 hover:scale-105 ${
                  benefit.impact === 'high'
                    ? isDarkMode
                      ? 'border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50'
                      : 'border-blue-200 bg-blue-50 hover:border-blue-400'
                    : isDarkMode
                    ? 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="text-5xl mb-4">{benefit.icon}</div>
                <div className={`text-4xl font-bold mb-2 ${
                  benefit.impact === 'high' ? 'text-blue-500' : 'text-purple-500'
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

      {/* Features Section */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Comprehensive Asset Management Capabilities
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Advanced AI and IoT technologies for complete asset lifecycle management
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ASSET_FEATURES.map((feature) => {
              const IconComponent = feature.icon
              return (
                <div
                  key={feature.id}
                  className={`p-8 rounded-xl transition-all duration-300 hover:scale-105 ${
                    isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6`}>
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <div className="mb-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                    }`}>
                      {feature.accuracy} Accuracy
                    </span>
                  </div>
                  <h3 className={`text-xl font-semibold mb-3 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {feature.title}
                  </h3>
                  <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.details.map((detail, idx) => (
                      <li key={idx} className="flex items-start">
                        <CheckCircleIcon className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${
                          isDarkMode ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                        <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                          {detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Process Timeline */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            How It Works
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Six-step process to comprehensive asset integrity management
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {INTEGRITY_PROCESS.map((step, index) => {
              const IconComponent = step.icon
              return (
                <div
                  key={step.id}
                  className={`relative p-6 rounded-xl ${
                    isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {step.step}
                  </div>
                  
                  <div className="flex items-start mb-4 mt-4">
                    <IconComponent className={`h-8 w-8 mr-3 flex-shrink-0 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <div className="flex-1">
                      <h3 className={`text-xl font-semibold mb-2 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {step.title}
                      </h3>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                        isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {step.estimatedTime}
                      </span>
                    </div>
                  </div>
                  
                  <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {step.description}
                  </p>
                  
                  <ul className="space-y-2">
                    {step.actions.map((action, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {action}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Asset Categories */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Asset Coverage
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Comprehensive monitoring for all critical equipment types
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ASSET_CATEGORIES.map((category) => (
              <div
                key={category.id}
                className={`rounded-xl overflow-hidden border transition-all duration-300 ${
                  isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={`w-full p-6 flex items-center justify-between hover:bg-opacity-50 transition-all duration-300 ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                  }`}
                >
                  <h3 className={`text-xl font-semibold ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {category.category}
                  </h3>
                  {expandedCategory === category.id ? (
                    <ChevronUpIcon className="h-6 w-6 text-blue-500" />
                  ) : (
                    <ChevronDownIcon className="h-6 w-6 text-blue-500" />
                  )}
                </button>
                
                {expandedCategory === category.id && (
                  <div className={`px-6 pb-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                      {category.items.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg flex items-center ${
                            isDarkMode ? 'bg-gray-900' : 'bg-white'
                          }`}
                        >
                          <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                          <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Monitoring Technologies */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Advanced Monitoring Technologies
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Multiple detection methods for comprehensive asset health insights
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MONITORING_TECHNOLOGIES.map((tech) => (
              <div
                key={tech.id}
                className={`p-6 rounded-xl border transition-all duration-300 hover:scale-105 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <div className="text-4xl mb-4">{tech.icon}</div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {tech.name}
                </h3>
                <p className={`mb-4 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {tech.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {tech.applications.map((app, idx) => (
                    <span
                      key={idx}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {app}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Standards */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Industry Standards Compliance
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Built-in compliance with major international standards
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPLIANCE_STANDARDS.map((standard) => (
              <div
                key={standard.id}
                className={`p-6 rounded-xl border ${
                  isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <div className={`inline-block px-3 py-1 rounded-lg mb-3 text-xs font-semibold ${
                  isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                }`}>
                  {standard.category}
                </div>
                <h3 className={`text-xl font-bold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {standard.name}
                </h3>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  {standard.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Applications */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Industry Applications
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Tailored solutions for diverse industrial sectors
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {INDUSTRY_USE_CASES.map((industry) => (
              <div
                key={industry.id}
                className={`p-8 rounded-xl border transition-all duration-300 hover:scale-105 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="text-5xl mb-4">{industry.icon}</div>
                <h3 className={`text-2xl font-bold mb-3 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {industry.title}
                </h3>
                <p className={`mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {industry.description}
                </p>
                <div className={`border-t pt-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-sm font-semibold mb-3 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Key Challenges:
                  </p>
                  <ul className="space-y-2">
                    {industry.challenges.map((challenge, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {challenge}
                        </span>
                      </li>
                    ))}
                  </ul>
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
            Get answers to common questions about asset integrity management
          </p>
          <div className="space-y-4">
            {ASSET_FAQ.map((faq) => (
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
                    <ChevronUpIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
                  ) : (
                    <ChevronDownIcon className="h-6 w-6 text-blue-500 flex-shrink-0" />
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
        isDarkMode ? 'bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900' : 'bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Optimize Your Assets?
          </h2>
          <p className="text-xl text-gray-200 mb-10">
            Start your asset integrity transformation today with a free assessment
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to={ASSET_CTA.primary.link}
              className="px-8 py-4 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {ASSET_CTA.primary.text}
            </Link>
            <Link
              to={ASSET_CTA.demo.link}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white hover:text-purple-600 transition-all duration-300 font-semibold text-lg"
            >
              {ASSET_CTA.demo.text}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default AssetIntegrityService
