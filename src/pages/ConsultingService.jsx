import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { 
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

import {
  CONSULTING_SERVICE_INFO,
  CONSULTING_SERVICES,
  ENGAGEMENT_MODELS,
  CONSULTING_PROCESS,
  INDUSTRY_EXPERTISE,
  SUCCESS_METRICS,
  SUCCESS_STORIES,
  EXPERTISE_AREAS,
  CONSULTING_FAQ,
  CONSULTING_CTA
} from '../config/consulting.config'

const ConsultingService = () => {
  const { isDarkMode } = useSelector((state) => state.theme)
  const [expandedFaq, setExpandedFaq] = useState(null)
  const [expandedService, setExpandedService] = useState(null)
  const [expandedStory, setExpandedStory] = useState(null)

  const toggleFaq = (id) => {
    setExpandedFaq(expandedFaq === id ? null : id)
  }

  const toggleService = (id) => {
    setExpandedService(expandedService === id ? null : id)
  }

  const toggleStory = (id) => {
    setExpandedStory(expandedStory === id ? null : id)
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Hero Section */}
      <section className={`relative py-20 px-4 ${
        isDarkMode ? 'bg-gradient-to-br from-gray-800 via-gray-900 to-black' : 'bg-gradient-to-br from-purple-50 via-white to-blue-50'
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
              <span className="text-purple-500 text-sm font-semibold">
                {CONSULTING_SERVICE_INFO.moduleCode} v{CONSULTING_SERVICE_INFO.version}
              </span>
            </div>
            <h1 className={`text-5xl md:text-6xl font-bold mb-6 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              {CONSULTING_SERVICE_INFO.title}
            </h1>
            <p className={`text-xl md:text-2xl mb-8 max-w-3xl mx-auto ${
              isDarkMode ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {CONSULTING_SERVICE_INFO.tagline}
            </p>
            <p className={`text-lg mb-10 max-w-4xl mx-auto ${
              isDarkMode ? 'text-gray-400' : 'text-gray-700'
            }`}>
              {CONSULTING_SERVICE_INFO.description}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to={CONSULTING_CTA.primary.link}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {CONSULTING_CTA.primary.text}
              </Link>
              <Link
                to={CONSULTING_CTA.demo.link}
                className={`px-8 py-4 rounded-lg border-2 font-semibold text-lg transition-all duration-300 ${
                  isDarkMode 
                    ? 'border-gray-600 text-gray-300 hover:border-purple-500 hover:text-purple-400' 
                    : 'border-gray-300 text-gray-700 hover:border-purple-600 hover:text-purple-600'
                }`}
              >
                {CONSULTING_CTA.demo.text}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Success Metrics */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Proven Track Record
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SUCCESS_METRICS.map((metric) => (
              <div
                key={metric.id}
                className={`p-8 rounded-xl border-2 text-center transition-all duration-300 hover:scale-105 ${
                  isDarkMode 
                    ? 'border-purple-500/30 bg-purple-500/5 hover:border-purple-500/50'
                    : 'border-purple-200 bg-purple-50 hover:border-purple-400'
                }`}
              >
                <div className="text-5xl mb-4">{metric.icon}</div>
                <div className={`text-4xl font-bold mb-2 ${
                  isDarkMode ? 'text-purple-400' : 'text-purple-600'
                }`}>
                  {metric.metric}
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {metric.label}
                </h3>
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Consulting Services */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Our Consulting Services
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Comprehensive consulting services tailored to your industry needs
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CONSULTING_SERVICES.map((service) => {
              const IconComponent = service.icon
              const isExpanded = expandedService === service.id
              return (
                <div
                  key={service.id}
                  className={`rounded-xl overflow-hidden border transition-all duration-300 ${
                    isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className={`p-6 bg-gradient-to-br ${service.color} bg-opacity-10`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${service.color} flex items-center justify-center`}>
                        <IconComponent className="h-7 w-7 text-white" />
                      </div>
                      <button
                        onClick={() => toggleService(service.id)}
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
                      {service.title}
                    </h3>
                    <p className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                      {service.description}
                    </p>
                  </div>
                  
                  {isExpanded && (
                    <div className={`p-6 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="mb-6">
                        <h4 className={`text-lg font-semibold mb-3 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          What We Do:
                        </h4>
                        <ul className="space-y-2">
                          {service.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start">
                              <CheckCircleIcon className={`h-5 w-5 mr-2 mt-0.5 flex-shrink-0 ${
                                isDarkMode ? 'text-purple-400' : 'text-purple-600'
                              }`} />
                              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>
                                {detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className={`text-lg font-semibold mb-3 ${
                          isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          Expected Outcomes:
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {service.outcomes.map((outcome, idx) => (
                            <div
                              key={idx}
                              className={`p-3 rounded-lg ${
                                isDarkMode ? 'bg-gray-900' : 'bg-white'
                              }`}
                            >
                              <span className={`text-sm font-medium ${
                                isDarkMode ? 'text-green-400' : 'text-green-600'
                              }`}>
                                ✓ {outcome}
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

      {/* Engagement Models */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Flexible Engagement Models
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Choose the engagement model that fits your needs and timeline
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ENGAGEMENT_MODELS.map((model) => {
              const IconComponent = model.icon
              return (
                <div
                  key={model.id}
                  className={`p-6 rounded-xl border transition-all duration-300 hover:scale-105 ${
                    isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <IconComponent className={`h-12 w-12 mb-4 ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-600'
                  }`} />
                  <h3 className={`text-xl font-bold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {model.title}
                  </h3>
                  <p className={`mb-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {model.description}
                  </p>
                  <div className={`mb-4 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {model.duration}
                  </div>
                  
                  <div className={`border-t pt-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <p className={`text-xs font-semibold mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Key Deliverables:
                    </p>
                    <ul className="space-y-1">
                      {model.deliverables.slice(0, 3).map((deliverable, idx) => (
                        <li key={idx} className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          • {deliverable}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className={`border-t pt-4 mt-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    <p className={`text-xs font-semibold mb-2 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Best For:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {model.bestFor.slice(0, 2).map((item, idx) => (
                        <span
                          key={idx}
                          className={`px-2 py-1 rounded text-xs ${
                            isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Consulting Process */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Our Consulting Process
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Structured approach ensuring successful outcomes
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {CONSULTING_PROCESS.map((step) => {
              const IconComponent = step.icon
              return (
                <div
                  key={step.id}
                  className={`relative p-6 rounded-xl ${
                    isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'
                  }`}
                >
                  {/* Step Number Badge */}
                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {step.step}
                  </div>
                  
                  <IconComponent className={`h-10 w-10 mb-3 mt-4 ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-600'
                  }`} />
                  
                  <h3 className={`text-lg font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    {step.title}
                  </h3>
                  
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                    isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {step.duration}
                  </span>
                  
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {step.description}
                  </p>
                  
                  <ul className="space-y-1">
                    {step.activities.slice(0, 3).map((activity, idx) => (
                      <li key={idx} className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                        • {activity}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Industry Expertise */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Deep Industry Expertise
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Decades of experience across major process industries
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {INDUSTRY_EXPERTISE.map((expertise) => (
              <div
                key={expertise.id}
                className={`p-6 rounded-xl border transition-all duration-300 hover:scale-105 ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                }`}
              >
                <div className="text-5xl mb-4 text-center">{expertise.icon}</div>
                <h3 className={`text-xl font-bold mb-2 text-center ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {expertise.industry}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      isDarkMode ? 'text-purple-400' : 'text-purple-600'
                    }`}>
                      {expertise.experience}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Experience
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`}>
                      {expertise.projects}
                    </div>
                    <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Projects
                    </div>
                  </div>
                </div>
                
                <div className={`border-t pt-4 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <p className={`text-xs font-semibold mb-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Specialties:
                  </p>
                  <ul className="space-y-1">
                    {expertise.specialties.map((specialty, idx) => (
                      <li key={idx} className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        • {specialty}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Success Stories */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Client Success Stories
          </h2>
          <p className={`text-center text-lg mb-12 max-w-3xl mx-auto ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Real results from our consulting engagements
          </p>
          <div className="space-y-6">
            {SUCCESS_STORIES.map((story) => {
              const isExpanded = expandedStory === story.id
              return (
                <div
                  key={story.id}
                  className={`rounded-xl overflow-hidden border ${
                    isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => toggleStory(story.id)}
                    className={`w-full p-6 flex items-center justify-between hover:bg-opacity-50 transition-all duration-300 ${
                      isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {story.industry}
                        </span>
                        <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          {story.duration}
                        </span>
                      </div>
                      <h3 className={`text-xl font-bold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {story.title}
                      </h3>
                    </div>
                    {isExpanded ? (
                      <ChevronUpIcon className="h-6 w-6 text-purple-500 flex-shrink-0 ml-4" />
                    ) : (
                      <ChevronDownIcon className="h-6 w-6 text-purple-500 flex-shrink-0 ml-4" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className={`px-6 pb-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                      <div className="grid md:grid-cols-3 gap-6 mb-6">
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Client:
                          </h4>
                          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {story.client}
                          </p>
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Challenge:
                          </h4>
                          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {story.challenge}
                          </p>
                        </div>
                        <div>
                          <h4 className={`text-sm font-semibold mb-2 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Solution:
                          </h4>
                          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {story.solution}
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
                          {story.results.map((result, idx) => (
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

      {/* Expertise Areas */}
      <section className={`py-16 px-4 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            Our Expertise
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXPERTISE_AREAS.map((area, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl border ${
                  isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <h3 className={`text-lg font-bold mb-4 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {area.category}
                </h3>
                <ul className="space-y-2">
                  {area.skills.map((skill, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-purple-500 mr-2">•</span>
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {skill}
                      </span>
                    </li>
                  ))}
                </ul>
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
            Common questions about our consulting services
          </p>
          <div className="space-y-4">
            {CONSULTING_FAQ.map((faq) => (
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
                    <ChevronUpIcon className="h-6 w-6 text-purple-500 flex-shrink-0" />
                  ) : (
                    <ChevronDownIcon className="h-6 w-6 text-purple-500 flex-shrink-0" />
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
        isDarkMode ? 'bg-gradient-to-br from-purple-900 via-blue-900 to-gray-900' : 'bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Let's Transform Your Operations Together
          </h2>
          <p className="text-xl text-gray-200 mb-10">
            Schedule a free consultation to discuss your challenges and explore solutions
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to={CONSULTING_CTA.primary.link}
              className="px-8 py-4 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {CONSULTING_CTA.primary.text}
            </Link>
            <Link
              to={CONSULTING_CTA.secondary.link}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg hover:bg-white hover:text-purple-600 transition-all duration-300 font-semibold text-lg"
            >
              {CONSULTING_CTA.secondary.text}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default ConsultingService
