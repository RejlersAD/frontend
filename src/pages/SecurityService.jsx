import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ChevronDownIcon, ChevronUpIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { SECURITY_SERVICE_INFO, SECURITY_SERVICES, SECURITY_FRAMEWORK, SECURITY_BENEFITS, SECURITY_STANDARDS, SECURITY_FAQ, SECURITY_CTA } from '../config/security.config'

const SecurityService = () => {
  const { isDarkMode } = useSelector((state) => state.theme)
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [expandedService, setExpandedService] = useState(null)

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Hero */}
      <section className={`relative py-20 px-4 ${isDarkMode ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' : 'bg-gradient-to-br from-red-50 via-white to-orange-50'}`}>
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
            <span className="text-red-500 text-sm font-semibold">{SECURITY_SERVICE_INFO.moduleCode} v{SECURITY_SERVICE_INFO.version}</span>
          </div>
          <h1 className={`text-5xl md:text-6xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{SECURITY_SERVICE_INFO.title}</h1>
          <p className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{SECURITY_SERVICE_INFO.tagline}</p>
          <p className={`text-lg mb-10 max-w-4xl mx-auto ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>{SECURITY_SERVICE_INFO.description}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to={SECURITY_CTA.primary.link} className="px-8 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105">{SECURITY_CTA.primary.text}</Link>
            <Link to={SECURITY_CTA.secondary.link} className={`px-8 py-4 rounded-lg border-2 font-semibold text-lg transition-all duration-300 ${isDarkMode ? 'border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400' : 'border-gray-300 text-gray-700 hover:border-red-600 hover:text-red-600'}`}>{SECURITY_CTA.secondary.text}</Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Security Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SECURITY_BENEFITS.map((benefit) => (
              <div key={benefit.id} className={`p-8 rounded-xl border-2 text-center transition-all duration-300 hover:scale-105 ${benefit.impact === 'critical' ? isDarkMode ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50' : isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
                <div className="text-5xl mb-4">{benefit.icon}</div>
                <div className={`text-4xl font-bold mb-2 ${benefit.impact === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>{benefit.metric}</div>
                <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{benefit.title}</h3>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Security Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SECURITY_SERVICES.map((service) => {
              const IconComponent = service.icon
              const isExpanded = expandedService === service.id
              return (
                <div key={service.id} className={`rounded-xl overflow-hidden border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                  <div className={`p-6 bg-gradient-to-br ${service.color} bg-opacity-10`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center`}>
                        <IconComponent className="h-7 w-7 text-white" />
                      </div>
                      <button onClick={() => setExpandedService(isExpanded ? null : service.id)} className="text-white bg-black/20 hover:bg-black/30 p-2 rounded-lg">
                        {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    <h3 className={`text-2xl font-bold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{service.title}</h3>
                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>{service.description}</p>
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      {Object.entries(service.metrics).map(([key, value]) => (
                        <div key={key} className={`text-center p-2 rounded ${isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'}`}>
                          <div className={`text-lg font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{value}</div>
                          <div className={`text-xs capitalize ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{key}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <CheckCircleIcon className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{feature}</span>
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

      {/* Framework */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Security Implementation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {SECURITY_FRAMEWORK.map((phase) => {
              const IconComponent = phase.icon
              return (
                <div key={phase.id} className={`relative p-6 rounded-xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">{phase.step}</div>
                  <IconComponent className={`h-10 w-10 mb-3 mt-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                  <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{phase.title}</h3>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>{phase.duration}</span>
                  <ul className="space-y-1">
                    {phase.activities.slice(0, 3).map((activity, idx) => (
                      <li key={idx} className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>• {activity}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Compliance Frameworks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SECURITY_STANDARDS.map((framework) => (
              <div key={framework.id} className={`p-6 rounded-xl border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-3xl mb-2 block">{framework.logo}</span>
                    <h3 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{framework.name}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`}>{framework.category}</span>
                </div>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>{framework.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-4xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Frequently Asked Questions</h2>
          <div className="space-y-4">
            {SECURITY_FAQ.map((faq) => (
              <div key={faq.id} className={`rounded-xl overflow-hidden border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                <button onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)} className={`w-full p-6 flex items-center justify-between text-left ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}>
                  <span className={`font-semibold text-lg pr-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{faq.question}</span>
                  {expandedFaq === faq.id ? <ChevronUpIcon className="h-6 w-6 text-red-500 flex-shrink-0" /> : <ChevronDownIcon className="h-6 w-6 text-red-500 flex-shrink-0" />}
                </button>
                {expandedFaq === faq.id && <div className={`px-6 pb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{faq.answer}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`py-20 px-4 ${isDarkMode ? 'bg-gradient-to-br from-red-900 via-orange-900 to-gray-900' : 'bg-gradient-to-br from-red-600 via-orange-600 to-red-700'}`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Protect Your Digital Assets</h2>
          <p className="text-xl text-gray-200 mb-10">Get a comprehensive security assessment today</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to={SECURITY_CTA.primary.link} className="px-8 py-4 bg-white text-red-600 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold text-lg shadow-lg">{SECURITY_CTA.primary.text}</Link>
            <Link to={SECURITY_CTA.demo.link} className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white hover:text-red-600 transition-all duration-300 font-semibold text-lg">{SECURITY_CTA.demo.text}</Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default SecurityService
