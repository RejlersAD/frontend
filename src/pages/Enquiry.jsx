/**
 * Enquiry Form Page - REJLERS RADAI
 * Advanced customer inquiry form with Rejlers brand theme
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiService from '../services/api.service';
import { ENQUIRY_CONFIG } from '../config/enquiry.config';
import { REJLERS_COLORS } from '../config/theme.config';

const Enquiry = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [progress, setProgress] = useState(0);
  
  // Initialize form data from URL params (for universal enquiry support)
  const preSelectedService = searchParams.get('service') || '';
  const preSelectedSubject = searchParams.get('subject') || '';
  const preSelectedMessage = searchParams.get('message') || '';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    subject: preSelectedSubject,
    message: preSelectedMessage,
    service: preSelectedService,
    urgency: 'normal'
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Calculate form completion progress
  useEffect(() => {
    const requiredFields = ['name', 'email', 'phone', 'subject', 'message'];
    const filledFields = requiredFields.filter(field => formData[field]?.trim().length > 0);
    const newProgress = (filledFields.length / requiredFields.length) * 100;
    setProgress(newProgress);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Real-time validation
    if (touched[name]) {
      validateField(name, value);
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFocusedField(null);
    validateField(field, formData[field]);
  };

  const handleFocus = (field) => {
    setFocusedField(field);
  };

  const validateField = (name, value) => {
    const newErrors = { ...errors };
    
    switch (name) {
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'Name is required';
        } else if (value.trim().length < 2) {
          newErrors.name = 'Name must be at least 2 characters';
        } else {
          delete newErrors.name;
        }
        break;
      
      case 'email':
        if (!value.trim()) {
          newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Invalid email format';
        } else {
          delete newErrors.email;
        }
        break;
      
      case 'phone':
        if (!value.trim()) {
          newErrors.phone = 'Phone number is required';
        } else if (value.trim().length < 8) {
          newErrors.phone = 'Phone number too short';
        } else {
          delete newErrors.phone;
        }
        break;
      
      case 'subject':
        if (!value.trim()) {
          newErrors.subject = 'Subject is required';
        } else if (value.trim().length < 5) {
          newErrors.subject = 'Subject too short (min 5 characters)';
        } else {
          delete newErrors.subject;
        }
        break;
      
      case 'message':
        if (!value.trim()) {
          newErrors.message = 'Message is required';
        } else if (value.trim().length < 10) {
          newErrors.message = `Need ${10 - value.trim().length} more characters (min 10)`;
        } else {
          delete newErrors.message;
        }
        break;
      
      default:
        break;
    }
    
    setErrors(newErrors);
  };

  const validateForm = () => {
    const requiredFields = ['name', 'email', 'phone', 'subject', 'message'];
    requiredFields.forEach(field => validateField(field, formData[field]));
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach(key => { allTouched[key] = true; });
    setTouched(allTouched);
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('📧 [Enquiry] Submitting form:', formData);
      
      const response = await apiService.post('/enquiry/submit/', formData);
      
      console.log('✅ [Enquiry] Form submitted successfully:', response);
      
      setSubmitted(true);
      
      // Redirect after 5 seconds
      setTimeout(() => {
        navigate('/');
      }, 5000);
      
    } catch (error) {
      console.error('❌ [Enquiry] Submission failed:', error);
      setErrors({
        submit: error.response?.data?.message || 'Failed to submit enquiry. Please try again or contact us directly.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-lg w-full text-center transform animate-fade-in">
          {/* Success Animation */}
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full animate-pulse"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center transform animate-bounce">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-4" style={{ color: REJLERS_COLORS.primary.base }}>
            Enquiry Submitted!
          </h2>
          <p className="text-lg text-gray-700 mb-3">
            Thank you for reaching out to <span className="font-bold" style={{ color: REJLERS_COLORS.secondary.green.base }}>REJLERS RADAI</span>
          </p>
          <p className="text-gray-600 mb-6">
            Our team will review your message and respond within 24 hours.
          </p>
          
          {/* Features */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl mb-2">📧</div>
                <p className="text-xs text-gray-600 font-semibold">Email Sent</p>
              </div>
              <div>
                <div className="text-3xl mb-2">⏱️</div>
                <p className="text-xs text-gray-600 font-semibold">24h Response</p>
              </div>
              <div>
                <div className="text-3xl mb-2">✅</div>
                <p className="text-xs text-gray-600 font-semibold">Confirmed</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 px-6 rounded-xl font-bold text-white transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.primary.base}, ${REJLERS_COLORS.primary.accent})` }}
            >
              Return Home
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 border-2 rounded-xl font-bold transition-all hover:bg-gray-50"
              style={{ borderColor: REJLERS_COLORS.neutral.gray300, color: REJLERS_COLORS.primary.base }}
            >
              New Enquiry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 rounded-lg font-semibold transition-all transform hover:scale-105 hover:shadow-md mb-6"
            style={{ color: REJLERS_COLORS.primary.base, backgroundColor: REJLERS_COLORS.primary.complement }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </button>
          
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-2 rounded-full mb-4" style={{ backgroundColor: REJLERS_COLORS.secondary.green.complement }}>
              <span className="text-sm font-bold" style={{ color: REJLERS_COLORS.secondary.green.accent }}>
                💬 GET IN TOUCH
              </span>
            </div>
            <h1 className="text-5xl font-bold mb-4" style={{ color: REJLERS_COLORS.primary.base }}>
              {ENQUIRY_CONFIG.page.title}
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {ENQUIRY_CONFIG.page.subtitle}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: REJLERS_COLORS.primary.base }}>
                Form Completion
              </span>
              <span className="text-sm font-bold" style={{ color: REJLERS_COLORS.secondary.green.accent }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ 
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.green.accent})`
                }}
              />
            </div>
          </div>
        </div>

        {/* Quick Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {ENQUIRY_CONFIG.contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.link}
              className="bg-white rounded-2xl shadow-lg p-6 text-center hover:shadow-2xl transition-all transform hover:-translate-y-2 duration-300"
              style={{ borderTop: `4px solid ${REJLERS_COLORS.secondary.green.base}` }}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transform hover:rotate-12 transition-transform"
                style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.primary.base}, ${REJLERS_COLORS.primary.accent})` }}>
                <span className="text-3xl">{method.icon}</span>
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                {method.title}
              </h3>
              <p className="font-semibold hover:underline" style={{ color: REJLERS_COLORS.secondary.green.accent }}>
                {method.value}
              </p>
            </a>
          ))}
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information Section */}
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: REJLERS_COLORS.primary.base }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-white text-sm font-bold"
                  style={{ backgroundColor: REJLERS_COLORS.secondary.green.base }}>
                  1
                </span>
                Personal Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name Field */}
                <div className="transform transition-all duration-300" style={{ 
                  transform: focusedField === 'name' ? 'scale(1.02)' : 'scale(1)'
                }}>
                  <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                    Full Name <span style={{ color: REJLERS_COLORS.status.error }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    onFocus={() => handleFocus('name')}
                    onBlur={() => handleBlur('name')}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:outline-none transition-all ${
                      errors.name && touched.name
                        ? 'border-red-500 focus:ring-red-200'
                        : focusedField === 'name'
                        ? 'focus:ring-opacity-30'
                        : 'border-gray-300 focus:ring-opacity-30'
                    }`}
                    style={focusedField === 'name' ? { 
                      borderColor: REJLERS_COLORS.secondary.green.accent,
                      boxShadow: `0 0 0 4px ${REJLERS_COLORS.secondary.green.complement}`
                    } : {}}
                    placeholder="John Doe"
                  />
                  {errors.name && touched.name && (
                    <p className="mt-2 text-sm font-semibold flex items-center" style={{ color: REJLERS_COLORS.status.error }}>
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email Field */}
                <div className="transform transition-all duration-300" style={{ 
                  transform: focusedField === 'email' ? 'scale(1.02)' : 'scale(1)'
                }}>
                  <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                    Email Address <span style={{ color: REJLERS_COLORS.status.error }}>*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => handleFocus('email')}
                    onBlur={() => handleBlur('email')}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:outline-none transition-all ${
                      errors.email && touched.email
                        ? 'border-red-500 focus:ring-red-200'
                        : focusedField === 'email'
                        ? 'focus:ring-opacity-30'
                        : 'border-gray-300 focus:ring-opacity-30'
                    }`}
                    style={focusedField === 'email' ? { 
                      borderColor: REJLERS_COLORS.secondary.green.accent,
                      boxShadow: `0 0 0 4px ${REJLERS_COLORS.secondary.green.complement}`
                    } : {}}
                    placeholder="john.doe@company.com"
                  />
                  {errors.email && touched.email && (
                    <p className="mt-2 text-sm font-semibold flex items-center" style={{ color: REJLERS_COLORS.status.error }}>
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone Field */}
                <div className="transform transition-all duration-300" style={{ 
                  transform: focusedField === 'phone' ? 'scale(1.02)' : 'scale(1)'
                }}>
                  <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                    Phone Number <span style={{ color: REJLERS_COLORS.status.error }}>*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    onFocus={() => handleFocus('phone')}
                    onBlur={() => handleBlur('phone')}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:outline-none transition-all ${
                      errors.phone && touched.phone
                        ? 'border-red-500 focus:ring-red-200'
                        : focusedField === 'phone'
                        ? 'focus:ring-opacity-30'
                        : 'border-gray-300 focus:ring-opacity-30'
                    }`}
                    style={focusedField === 'phone' ? { 
                      borderColor: REJLERS_COLORS.secondary.green.accent,
                      boxShadow: `0 0 0 4px ${REJLERS_COLORS.secondary.green.complement}`
                    } : {}}
                    placeholder="+971 50 123 4567"
                  />
                  {errors.phone && touched.phone && (
                    <p className="mt-2 text-sm font-semibold flex items-center" style={{ color: REJLERS_COLORS.status.error }}>
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* Company Field */}
                <div className="transform transition-all duration-300" style={{ 
                  transform: focusedField === 'company' ? 'scale(1.02)' : 'scale(1)'
                }}>
                  <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    onFocus={() => handleFocus('company')}
                    onBlur={() => handleBlur('company')}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-opacity-30 focus:outline-none transition-all"
                    style={focusedField === 'company' ? { 
                      borderColor: REJLERS_COLORS.secondary.green.accent,
                      boxShadow: `0 0 0 4px ${REJLERS_COLORS.secondary.green.complement}`
                    } : {}}
                    placeholder="Your Company"
                  />
                </div>
              </div>
            </div>

            {/* Enquiry Details Section */}
            <div className="pt-6 border-t-2 border-gray-200">
              <h2 className="text-2xl font-bold mb-6 flex items-center" style={{ color: REJLERS_COLORS.primary.base }}>
                <span className="w-8 h-8 rounded-full flex items-center justify-center mr-3 text-white text-sm font-bold"
                  style={{ backgroundColor: REJLERS_COLORS.secondary.turbine.base }}>
                  2
                </span>
                Enquiry Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Service Field */}
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                    Service of Interest
                  </label>
                  <select
                    name="service"
                    value={formData.service}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-opacity-30 focus:outline-none transition-all cursor-pointer"
                    style={{ color: REJLERS_COLORS.primary.base }}
                  >
                    <option value="">Select a service...</option>
                    {ENQUIRY_CONFIG.services.map((service, index) => (
                      <option key={index} value={service.value}>{service.label}</option>
                    ))}
                  </select>
                </div>

                {/* Urgency Field */}
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                    Urgency Level
                  </label>
                  <select
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-4 focus:ring-opacity-30 focus:outline-none transition-all cursor-pointer"
                    style={{ color: REJLERS_COLORS.primary.base }}
                  >
                    {ENQUIRY_CONFIG.urgencyLevels.map((level, index) => (
                      <option key={index} value={level.value}>{level.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Field */}
              <div className="mb-6 transform transition-all duration-300" style={{ 
                transform: focusedField === 'subject' ? 'scale(1.02)' : 'scale(1)'
              }}>
                <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                  Subject <span style={{ color: REJLERS_COLORS.status.error }}>*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  onFocus={() => handleFocus('subject')}
                  onBlur={() => handleBlur('subject')}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:outline-none transition-all ${
                    errors.subject && touched.subject
                      ? 'border-red-500 focus:ring-red-200'
                      : focusedField === 'subject'
                      ? 'focus:ring-opacity-30'
                      : 'border-gray-300 focus:ring-opacity-30'
                  }`}
                  style={focusedField === 'subject' ? { 
                    borderColor: REJLERS_COLORS.secondary.green.accent,
                    boxShadow: `0 0 0 4px ${REJLERS_COLORS.secondary.green.complement}`
                  } : {}}
                  placeholder="Brief description of your enquiry"
                />
                {errors.subject && touched.subject && (
                  <p className="mt-2 text-sm font-semibold flex items-center" style={{ color: REJLERS_COLORS.status.error }}>
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.subject}
                  </p>
                )}
              </div>

              {/* Message Field */}
              <div className="transform transition-all duration-300" style={{ 
                transform: focusedField === 'message' ? 'scale(1.02)' : 'scale(1)'
              }}>
                <label className="block text-sm font-bold mb-2" style={{ color: REJLERS_COLORS.primary.base }}>
                  Message <span style={{ color: REJLERS_COLORS.status.error }}>*</span>
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  onFocus={() => handleFocus('message')}
                  onBlur={() => handleBlur('message')}
                  rows={6}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-4 focus:outline-none transition-all resize-none ${
                    errors.message && touched.message
                      ? 'border-red-500 focus:ring-red-200'
                      : focusedField === 'message'
                      ? 'focus:ring-opacity-30'
                      : 'border-gray-300 focus:ring-opacity-30'
                  }`}
                  style={focusedField === 'message' ? { 
                    borderColor: REJLERS_COLORS.secondary.green.accent,
                    boxShadow: `0 0 0 4px ${REJLERS_COLORS.secondary.green.complement}`
                  } : {}}
                  placeholder="Please provide details about your enquiry..."
                />
                <div className="mt-2 flex justify-between items-center">
                  {errors.message && touched.message ? (
                    <p className="text-sm font-semibold flex items-center" style={{ color: REJLERS_COLORS.status.error }}>
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.message}
                    </p>
                  ) : (
                    <span className="text-sm font-semibold" style={{ 
                      color: formData.message.length >= 10 ? REJLERS_COLORS.secondary.green.accent : REJLERS_COLORS.neutral.gray600
                    }}>
                      {formData.message.length >= 10 ? '✓ Looking good!' : 'Start typing...'}
                    </span>
                  )}
                  <span className="text-sm font-semibold" style={{ color: REJLERS_COLORS.neutral.gray600 }}>
                    {formData.message.length} / 1000
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="rounded-xl p-4" style={{ 
                backgroundColor: REJLERS_COLORS.status.error + '20',
                border: `2px solid ${REJLERS_COLORS.status.error}`
              }}>
                <div className="flex items-center">
                  <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 20 20" style={{ color: REJLERS_COLORS.status.error }}>
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="font-semibold" style={{ color: REJLERS_COLORS.status.error }}>{errors.submit}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={loading || Object.keys(errors).length > 0}
                className="flex-1 py-4 px-8 rounded-xl font-bold text-lg text-white transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-xl"
                style={{ 
                  background: Object.keys(errors).length === 0
                    ? `linear-gradient(135deg, ${REJLERS_COLORS.secondary.green.accent}, ${REJLERS_COLORS.secondary.green.base})`
                    : REJLERS_COLORS.neutral.gray400
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Submit Enquiry
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="sm:w-auto px-8 py-4 border-2 rounded-xl font-bold transition-all hover:bg-gray-50 transform hover:scale-105 active:scale-95"
                style={{ 
                  borderColor: REJLERS_COLORS.neutral.gray300,
                  color: REJLERS_COLORS.primary.base
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Security & Contact Info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center px-6 py-3 rounded-full mb-4" style={{ backgroundColor: REJLERS_COLORS.primary.complement }}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: REJLERS_COLORS.primary.base }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-bold" style={{ color: REJLERS_COLORS.primary.base }}>
              Your information is secure and confidential
            </span>
          </div>
          <p className="text-gray-600">
            For urgent matters, call us at{' '}
            <a href="tel:+971505606987" className="font-bold hover:underline" style={{ color: REJLERS_COLORS.secondary.green.accent }}>
              +971 50 560 6987
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Enquiry;
