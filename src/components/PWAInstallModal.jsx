import React, { useState, useEffect } from 'react'
import { PWA_MODAL_CONFIG, PWA_BROWSER_MESSAGES } from '../config/pwa.config'

/**
 * Professional PWA Installation Modal
 * Shows before triggering browser's native install prompt
 * Provides clear instructions and benefits
 */
const PWAInstallModal = ({ isOpen, onClose, onInstall }) => {
  const [showTechnical, setShowTechnical] = useState(false)
  const [browserType, setBrowserType] = useState('default')

  useEffect(() => {
    // Detect browser for custom instructions
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('chrome') && !ua.includes('edg')) setBrowserType('chrome')
    else if (ua.includes('edg')) setBrowserType('edge')
    else if (ua.includes('safari') && !ua.includes('chrome')) setBrowserType('safari')
    else if (ua.includes('firefox')) setBrowserType('firefox')
  }, [])

  if (!isOpen) return null

  const { header, appInfo, steps, benefits, technicalInfo, cta, trustSignals, theme, animations } = PWA_MODAL_CONFIG

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1c2e48 0%, #2B3A55 100%)',
          animation: `modalPop ${animations.modalDuration} cubic-bezier(0.34, 1.56, 0.64, 1)`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all hover:scale-110"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Section */}
        <div className="relative px-8 pt-8 pb-6 text-center overflow-hidden">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: `radial-gradient(circle, ${theme.secondary}, transparent)` }} />

          <div className="relative z-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 text-xs font-bold"
              style={{
                background: header.badge.gradient,
                color: '#fff',
                boxShadow: '0 4px 14px rgba(8, 145, 178, 0.3)'
              }}
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {header.badge.text}
            </div>

            {/* Rejlers Logo with Professional Styling */}
            <div className="flex justify-center mb-6">
              <div className="relative group">
                {/* Animated glow ring */}
                <div 
                  className="absolute -inset-4 rounded-2xl opacity-75 blur-xl transition-all duration-500 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(135deg, ${theme.secondary}, ${theme.accent}, ${theme.primary})`,
                    animation: 'logoGlow 3s ease-in-out infinite'
                  }}
                />
                
                {/* Logo container with glassmorphism */}
                <div 
                  className="relative bg-white rounded-2xl p-6 shadow-2xl transform transition-all duration-300 group-hover:scale-105"
                  style={{
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <img 
                    src={header.logo} 
                    alt="Rejlers Logo" 
                    className="h-20 w-auto"
                    style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1))' }}
                    onError={(e) => { 
                      // Fallback to rocket emoji if logo fails to load
                      e.target.style.display = 'none'
                      e.target.parentElement.innerHTML = '<div class="text-6xl">🚀</div>'
                    }}
                  />
                </div>

                {/* Floating particles */}
                <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
                <div className="absolute -bottom-1 -left-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" 
                  style={{ animationDelay: '0.5s' }} />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-black text-white mb-2">
              {header.title}
            </h2>
            <p className="text-lg font-semibold mb-3" style={{ color: theme.secondary }}>
              {header.subtitle}
            </p>

            {/* App Info */}
            <div className="max-w-xl mx-auto">
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                {appInfo.description}
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <img src="/assets/Rejlers_Logo.png" alt="Rejlers" className="h-4 w-auto opacity-80" />
                  {appInfo.publisher}
                </span>
                <span>•</span>
                <span>v{appInfo.version}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Installation Steps */}
        <div className="px-8 py-6" style={{ background: 'rgba(0, 0, 0, 0.15)' }}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 text-center">
            How It Works
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="relative p-4 rounded-xl transition-all hover:scale-105"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  animation: `slideInUp 0.4s ease-out ${animations.stepDelay * index}s both`
                }}
              >
                {/* Step number */}
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                  style={{
                    background: `linear-gradient(135deg, ${step.color}, ${theme.secondary})`,
                    color: '#fff',
                    boxShadow: `0 4px 12px ${step.color}40`
                  }}
                >
                  {step.id}
                </div>

                {/* Icon */}
                <div className="text-3xl mb-2 text-center">{step.icon}</div>

                {/* Content */}
                <h4 className="text-white font-bold text-sm mb-1 text-center">
                  {step.title}
                </h4>
                <p className="text-gray-400 text-xs text-center leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="px-8 py-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 text-center">
            Why Install?
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.title}
                className="p-3 rounded-lg text-center transition-all hover:scale-105"
                style={{
                  background: 'rgba(42, 167, 132, 0.05)',
                  border: '1px solid rgba(42, 167, 132, 0.15)',
                  animation: `fadeInScale 0.3s ease-out ${animations.benefitDelay * index}s both`
                }}
              >
                <div className="text-2xl mb-1">{benefit.icon}</div>
                <div className="text-xs font-bold text-white mb-1">{benefit.title}</div>
                <div className="text-[10px] font-semibold mb-1" style={{ color: theme.secondary }}>
                  {benefit.metric}
                </div>
                <div className="text-[10px] text-gray-400 leading-tight">
                  {benefit.description}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Browser-specific instruction */}
        <div className="px-8 py-4">
          <div className="p-4 rounded-lg" style={{ background: 'rgba(8, 145, 178, 0.1)', border: '1px solid rgba(8, 145, 178, 0.3)' }}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">ℹ️</div>
              <div>
                <div className="text-xs font-bold text-white mb-1">Next Step:</div>
                <div className="text-xs text-gray-300">
                  {PWA_BROWSER_MESSAGES[browserType]}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Signals */}
        <div className="px-8 py-4">
          <div className="grid grid-cols-2 gap-2">
            {trustSignals.map((signal) => (
              <div key={signal} className="flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: theme.secondary }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{signal}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Details (Expandable) */}
        <div className="px-8 py-4">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="w-full flex items-center justify-between p-3 rounded-lg transition-all"
            style={{ background: 'rgba(255, 255, 255, 0.03)' }}
          >
            <span className="text-xs font-semibold text-gray-300">Technical Details</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${showTechnical ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showTechnical && (
            <div className="mt-3 p-4 rounded-lg text-xs text-gray-400 space-y-2"
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                animation: 'slideDown 0.2s ease-out'
              }}
            >
              <div className="flex justify-between">
                <span>Download Size:</span>
                <span className="text-white font-semibold">{technicalInfo.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform:</span>
                <span className="text-white font-semibold">{technicalInfo.platform}</span>
              </div>
              <div className="flex justify-between">
                <span>Requirements:</span>
                <span className="text-white font-semibold">{technicalInfo.requirements}</span>
              </div>
              <div className="flex justify-between">
                <span>Updates:</span>
                <span className="text-white font-semibold">{technicalInfo.updates}</span>
              </div>
              <div className="flex justify-between">
                <span>Security:</span>
                <span className="text-white font-semibold">{technicalInfo.security}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-6 flex gap-3">
          <button
            onClick={onInstall}
            className="flex-1 py-4 rounded-xl font-bold text-white transition-all hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
            style={{
              background: cta.primary.gradient,
              boxShadow: '0 8px 24px rgba(42, 167, 132, 0.3)'
            }}
          >
            <span className="text-xl">{cta.primary.icon}</span>
            <span>{cta.primary.text}</span>
          </button>

          <button
            onClick={onClose}
            className="px-6 py-4 rounded-xl font-semibold text-gray-300 transition-all hover:bg-white/5"
            style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <span className="text-sm">{cta.secondary.icon}</span>
            <span className="ml-2 text-sm">{cta.secondary.text}</span>
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalPop {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(30px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }

        @keyframes logoGlow {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  )
}

export default PWAInstallModal
