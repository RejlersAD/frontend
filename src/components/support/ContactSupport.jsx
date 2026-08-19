import React, { useState } from 'react'
import { SUPPORT_CONFIG } from '../../config/support.config'

/**
 * ContactSupport Component
 * Attractive and user-friendly contact support interface
 * Soft coded with configurable options and themes
 * Configuration can be modified in: src/config/support.config.js
 */

const ContactSupport = ({ isModal = false, onClose }) => {
  const [showFAQ, setShowFAQ] = useState(false)
  const [expandedFAQ, setExpandedFAQ] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    priority: 'medium'
  })
  const [showContactForm, setShowContactForm] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)

  const handleContactMethod = (method) => {
    if (!method.available) {
      alert('This contact method is coming soon!')
      return
    }

    if (method.action === 'chat') {
      alert('Live chat coming soon!')
    } else if (method.action.startsWith('http')) {
      window.open(method.action, '_blank')
    } else {
      window.location.href = method.action
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setSubmitStatus('sending')

    // Simulate API call - replace with actual API endpoint
    setTimeout(() => {
      setSubmitStatus('success')
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        priority: 'medium'
      })
      
      setTimeout(() => {
        setSubmitStatus(null)
        setShowContactForm(false)
      }, 3000)
    }, 1500)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className={`${isModal ? 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4' : 'w-full'}`}>
      <div className={`${isModal ? 'bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto' : 'w-full'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white p-8 rounded-t-3xl relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <span className="text-4xl">🎧</span>
                </div>
                <div>
                  <h2 className="text-3xl font-bold">{SUPPORT_CONFIG.title}</h2>
                  <p className="text-blue-100 mt-1">{SUPPORT_CONFIG.subtitle}</p>
                </div>
              </div>
              {isModal && (
                <button
                  onClick={onClose}
                  className="w-10 h-10 bg-white bg-opacity-20 rounded-xl flex items-center justify-center hover:bg-opacity-30 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Business Hours */}
            <div className="flex items-center gap-2 text-sm bg-white bg-opacity-10 rounded-xl px-4 py-2 w-fit backdrop-blur-sm">
              <span>🕐</span>
              <span>{SUPPORT_CONFIG.businessHours.days}</span>
              <span className="text-blue-200">•</span>
              <span>{SUPPORT_CONFIG.businessHours.hours}</span>
              <span className="text-blue-200">•</span>
              <span className="text-blue-200">{SUPPORT_CONFIG.businessHours.timezone}</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Quick Actions */}
          <div className="mb-8 flex gap-3 flex-wrap">
            <button
              onClick={() => {
                setShowContactForm(!showContactForm)
                setShowFAQ(false)
              }}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                showContactForm
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ✉️ Send Message
            </button>
            <button
              onClick={() => {
                setShowFAQ(!showFAQ)
                setShowContactForm(false)
              }}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                showFAQ
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              ❓ View FAQs
            </button>
          </div>

          {/* Contact Form */}
          {showContactForm && (
            <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📝</span>
                Send us a message
              </h3>
              
              {submitStatus === 'success' ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="text-xl font-bold text-green-900 mb-2">{SUPPORT_CONFIG.form.successMessage}</h4>
                  <p className="text-green-700">{SUPPORT_CONFIG.form.successSubMessage}</p>
                </div>
              ) : (
                <form onSubmit={handleFormSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="How can we help?"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        {SUPPORT_CONFIG.form.priorities.map(priority => (
                          <option key={priority.value} value={priority.value}>
                            {priority.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      rows="4"
                      className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      placeholder="Please describe your issue or question..."
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={submitStatus === 'sending'}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitStatus === 'sending' ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <span>✉️</span>
                        Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* FAQ Section */}
          {showFAQ && (
            <div className="mb-8 space-y-3">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>💡</span>
                Frequently Asked Questions
              </h3>
              {SUPPORT_CONFIG.faq.map((item, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-blue-300 transition-all"
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-all"
                  >
                    <span className="font-medium text-gray-900">{item.question}</span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedFAQ === index ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedFAQ === index && (
                    <div className="px-6 pb-4 text-gray-600 bg-gray-50">
                      {item.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Contact Methods Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {SUPPORT_CONFIG.contactMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => handleContactMethod(method)}
                disabled={!method.available}
                className={`group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-gray-100 hover:border-transparent overflow-hidden ${
                  !method.available ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                {/* Gradient Background on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${method.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="text-5xl mb-4">{method.icon}</div>
                  <h3 className="text-lg font-bold text-gray-900 group-hover:text-white transition-colors mb-2">
                    {method.name}
                  </h3>
                  <p className="text-sm text-gray-600 group-hover:text-white group-hover:text-opacity-90 transition-colors mb-3">
                    {method.description}
                  </p>
                  
                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 group-hover:text-white group-hover:text-opacity-75 transition-colors">⚡</span>
                      <span className="text-gray-600 group-hover:text-white group-hover:text-opacity-90 transition-colors">
                        {method.responseTime}
                      </span>
                    </div>
                    <div className={`text-xs font-medium ${method.available ? 'text-' + method.color + '-600' : 'text-gray-500'} group-hover:text-white transition-colors`}>
                      {method.details}
                    </div>
                  </div>

                  {/* Status Badge */}
                  {!method.available && (
                    <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-75 text-white text-xs px-3 py-1 rounded-full">
                      Soon
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUPPORT_CONFIG.features.map((feature) => (
              <div 
                key={feature.id}
                className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h4 className="font-bold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContactSupport
