import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  PID_SERVICE_INFO,
  PID_FEATURES,
  ANALYSIS_STEPS,
  PID_BENEFITS,
  SUPPORTED_STANDARDS,
  PID_USE_CASES,
  TECHNICAL_SPECS,
  PRICING_TIERS,
  PID_FAQ,
  PID_CTA,
  getHighImpactBenefits,
  getRecommendedTier
} from '../config/pidAnalysis.config'
import {
  SparklesIcon,
  ArrowRightIcon,
  PlayIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RocketLaunchIcon
} from '@heroicons/react/24/outline'

/**
 * PID Analysis Service Page
 * Smart, soft-coded design for P&ID Analysis service
 */

const PIDAnalysisService = () => {
  const { isAuthenticated } = useSelector((state) => state.auth)
  const [activeStep, setActiveStep] = useState(null)
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [selectedTier, setSelectedTier] = useState('professional')

  const highImpactBenefits = getHighImpactBenefits()
  const recommendedTier = getRecommendedTier()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-950 dark:to-indigo-950">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-64 h-64 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <SparklesIcon className="w-5 h-5 mr-2" />
              <span className="text-sm font-semibold">AI-Powered Engineering Intelligence • Version {PID_SERVICE_INFO.version}</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-tight">
              {PID_SERVICE_INFO.title}
            </h1>
            
            <p className="text-xl lg:text-2xl text-blue-100 max-w-4xl mx-auto mb-10 leading-relaxed">
              {PID_SERVICE_INFO.description}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isAuthenticated ? (
                <Link
                  to={PID_CTA.primary.link}
                  className="px-8 py-4 bg-white text-blue-600 font-black rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2"
                >
                  <PlayIcon className="w-6 h-6" />
                  {PID_CTA.primary.text}
                </Link>
              ) : (
                <Link
                  to="/register"
                  className="px-8 py-4 bg-white text-blue-600 font-black rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2"
                >
                  <RocketLaunchIcon className="w-6 h-6" />
                  Get Started Free
                </Link>
              )}
              <Link
                to={PID_CTA.demo.link}
                className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white font-bold rounded-xl hover:bg-white/20 transition-all transform hover:scale-105"
              >
                {PID_CTA.demo.text}
              </Link>
            </div>
            
            <p className="mt-6 text-sm text-blue-200">
              {PID_CTA.primary.description} • No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative -mt-16 z-10 mb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {PID_BENEFITS.map((benefit) => (
              <div 
                key={benefit.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 text-center transform hover:scale-105 transition-all duration-300 hover:shadow-2xl"
              >
                <div className="text-4xl mb-2">{benefit.icon}</div>
                <div className="text-3xl font-black text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text mb-1">
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
              Powerful AI Features
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Industry-leading accuracy powered by advanced computer vision and deep learning
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PID_FEATURES.map((feature) => {
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

      {/* Analysis Process */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Simple 5-step process from upload to insights
            </p>
          </div>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-12 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 hidden lg:block"></div>

            <div className="grid md:grid-cols-5 gap-8">
              {ANALYSIS_STEPS.map((step) => {
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
                      <div className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-2xl shadow-xl transition-all ${isActive ? 'scale-110' : ''}`}>
                        <Icon className="w-12 h-12" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg transition-all ${isActive ? 'shadow-2xl scale-105' : ''}`}>
                      <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-1">
                        Step {step.step}
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                        {step.description}
                      </p>
                      <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
                        ⏱️ {step.estimatedTime}
                      </div>

                      {/* Actions (shown on hover) */}
                      {isActive && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <ul className="space-y-1">
                            {step.actions.map((action, idx) => (
                              <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                                <span className="text-blue-600">•</span>
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

      {/* Supported Standards */}
      <section className="py-20 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Industry Standards
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Full compliance with major international standards
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SUPPORTED_STANDARDS.map((standard) => (
              <div
                key={standard.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white">
                    {standard.name}
                  </h3>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    standard.compliance === 'Full' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                  }`}>
                    {standard.compliance}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {standard.fullName}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  {standard.description}
                </p>
                <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full">
                  {standard.category}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Real-World Applications
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Proven solutions across diverse engineering scenarios
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {PID_USE_CASES.map((useCase) => (
              <div
                key={useCase.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
              >
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-3">
                  {useCase.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {useCase.description}
                </p>
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold rounded-full">
                    {useCase.industry}
                  </span>
                </div>
                <ul className="space-y-2">
                  {useCase.scenarios.map((scenario, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckIcon className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                      {scenario}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            {PID_FAQ.map((faq) => {
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
      <section className="py-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-black mb-6">
            Ready to Transform Your P&ID Workflow?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-3xl mx-auto">
            Join engineering teams worldwide using AI to analyze P&IDs faster, more accurately, and with better insights
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to={isAuthenticated ? PID_CTA.primary.link : '/register'}
              className="px-8 py-4 bg-white text-blue-600 font-black rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2"
            >
              <RocketLaunchIcon className="w-5 h-5" />
              {isAuthenticated ? PID_CTA.primary.text : 'Start Free Trial'}
            </Link>
            <Link
              to={PID_CTA.demo.link}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-white text-white font-bold rounded-xl hover:bg-white/20 transition-all transform hover:scale-105"
            >
              {PID_CTA.demo.text}
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-blue-200">
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

export default PIDAnalysisService
