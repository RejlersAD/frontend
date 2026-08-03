import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  PFD_SERVICE_INFO,
  PFD_FEATURES,
  CONVERSION_STEPS,
  PFD_BENEFITS,
  CONVERSION_CAPABILITIES,
  OUTPUT_FORMATS,
  INDUSTRY_APPLICATIONS,
  QUALITY_STANDARDS,
  PFD_FAQ,
  PFD_CTA,
  getPopularFormats
} from '../config/pfdConversion.config'
import {
  SparklesIcon,
  ArrowRightIcon,
  PlayIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RocketLaunchIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline'

/**
 * PFD Conversion Service Page
 * Smart, soft-coded design for PFD to P&ID conversion service
 */

const PFDConversionService = () => {
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [activeStep, setActiveStep] = useState(null)
  const [expandedFaq, setExpandedFaq] = useState(null)
  
  const popularFormats = getPopularFormats()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 text-white">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <SparklesIcon className="w-5 h-5 mr-2" />
              <span className="text-sm font-semibold">AI-Powered Conversion Engine • Version {PFD_SERVICE_INFO.version}</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              {PFD_SERVICE_INFO.title}
            </h1>
            
            <p className="text-xl lg:text-2xl text-purple-100 max-w-4xl mx-auto mb-10 leading-relaxed">
              {PFD_SERVICE_INFO.description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isAuthenticated ? (
                <Link
                  to={PFD_CTA.primary.link}
                  className="px-8 py-4 bg-white text-indigo-600 font-black rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2"
                >
                  <PlayIcon className="w-6 h-6" />
                  {PFD_CTA.primary.text}
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="px-8 py-4 bg-white text-indigo-600 font-black rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2"
                >
                  <RocketLaunchIcon className="w-6 h-6" />
                  Get Started Free
                </Link>
              )}
              <Link
                to={PFD_CTA.demo.link}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white font-bold rounded-xl hover:bg-white/20 transition-all transform hover:scale-105"
              >
                {PFD_CTA.demo.text}
              </Link>
            </div>
            
            <p className="mt-6 text-sm text-purple-200">
              {PFD_CTA.primary.description} • 30-day free trial
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative -mt-16 z-10 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {PFD_BENEFITS.map((benefit) => (
              <div 
                key={benefit.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center transform hover:scale-105 transition-all duration-300 hover:shadow-2xl"
              >
                <div className="text-4xl mb-2">{benefit.icon}</div>
                <div className="text-3xl font-black text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text mb-1">
                  {benefit.metric}
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                  {benefit.title}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {benefit.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Intelligent Conversion Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Transform PFDs into detailed P&IDs with AI-powered precision
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PFD_FEATURES.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden group"
                >
                  <div className={`p-6 bg-gradient-to-r ${feature.color}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-white/90 rounded-xl shadow-lg">
                        <Icon className="w-8 h-8 text-gray-900" />
                      </div>
                      <div className="px-3 py-1 bg-white/90 text-gray-900 text-xs font-black rounded-full">
                        {feature.accuracy} Accuracy
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">
                      {feature.title}
                    </h3>
                  </div>

                  <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          {detail}
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

      {/* Conversion Process */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Conversion Process
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Simple 6-step process from PFD to detailed P&ID
            </p>
          </div>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-12 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-pink-500 hidden lg:block"></div>

            <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-6">
              {CONVERSION_STEPS.map((step) => {
                const Icon = step.icon
                const isActive = activeStep === step.id
                
                return (
                  <div
                    key={step.id}
                    className="relative"
                    onMouseEnter={() => setActiveStep(step.id)}
                    onMouseLeave={() => setActiveStep(null)}
                  >
                    {/* Step Number Circle */}
                    <div className="flex justify-center mb-4">
                      <div className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-2xl shadow-xl transition-all ${isActive ? 'scale-110' : ''}`}>
                        <Icon className="w-12 h-12" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg transition-all ${isActive ? 'shadow-2xl scale-105' : ''}`}>
                      <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        Step {step.step}
                      </div>
                      <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                        {step.description}
                      </p>
                      <div className="inline-flex items-center px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full">
                        ⏱️ {step.estimatedTime}
                      </div>

                      {/* Actions (shown on hover) */}
                      {isActive && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <ul className="space-y-1">
                            {step.actions.map((action, idx) => (
                              <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                                <span className="text-indigo-600">•</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Conversion Capabilities */}
      <section className="py-20 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Comprehensive Capabilities
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Recognize and convert all process equipment and instrumentation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CONVERSION_CAPABILITIES.map((capability) => (
              <div
                key={capability.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
              >
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-4">
                  {capability.category}
                </h3>
                <ul className="space-y-2">
                  {capability.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckIcon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Output Formats */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Multiple Output Formats
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Export to your preferred CAD system or data format
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {OUTPUT_FORMATS.map((format) => (
              <div
                key={format.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all ${format.popular ? 'ring-2 ring-indigo-500' : ''}`}
              >
                {format.popular && (
                  <div className="inline-flex items-center px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold rounded-full mb-3">
                    ⭐ Popular
                  </div>
                )}
                <div className="text-4xl mb-3">{format.icon}</div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                  {format.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {format.description}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {format.compatibility}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Applications */}
      <section className="py-20 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Industry Applications
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Proven across diverse industries and applications
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {INDUSTRY_APPLICATIONS.map((industry) => (
              <div
                key={industry.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-center"
              >
                <div className="text-5xl mb-4">{industry.icon}</div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                  {industry.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {industry.description}
                </p>
                <ul className="space-y-1 text-left">
                  {industry.examples.map((example, idx) => (
                    <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                      <span className="text-indigo-600">•</span>
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quality Standards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Quality Standards
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Full compliance with industry standards
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {QUALITY_STANDARDS.map((standard) => (
              <div
                key={standard.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all text-center"
              >
                <CheckBadgeIcon className="w-12 h-12 mx-auto text-green-600 mb-3" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  {standard.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {standard.description}
                </p>
                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                  standard.compliance === 'Full' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                }`}>
                  {standard.compliance}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {PFD_FAQ.map((faq) => {
              const isExpanded = expandedFaq === faq.id
              
              return (
                <div
                  key={faq.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFaq(isExpanded ? null : faq.id)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-lg font-bold text-gray-900 dark:text-white pr-8">
                      {faq.question}
                    </span>
                    {isExpanded ? (
                      <ChevronUpIcon className="w-6 h-6 text-gray-600 flex-shrink-0" />
                    ) : (
                      <ChevronDownIcon className="w-6 h-6 text-gray-600 flex-shrink-0" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="px-6 pb-5 text-gray-600 dark:text-gray-400 leading-relaxed animate-fade-in">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-black mb-6">
            Ready to Accelerate Your P&ID Development?
          </h2>
          <p className="text-xl text-purple-100 mb-10 max-w-3xl mx-auto">
            Transform your PFDs into detailed P&IDs 80% faster with AI-powered conversion
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to={isAuthenticated ? PFD_CTA.primary.link : '/register'}
              className="px-8 py-4 bg-white text-indigo-600 font-black rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2"
            >
              <RocketLaunchIcon className="w-5 h-5" />
              {isAuthenticated ? PFD_CTA.primary.text : 'Start Free Trial'}
            </Link>
            <Link
              to={PFD_CTA.demo.link}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white font-bold rounded-xl hover:bg-white/20 transition-all transform hover:scale-105"
            >
              {PFD_CTA.demo.text}
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-purple-200">
            30-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* Animation Styles */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default PFDConversionService
