import React, { useRef, useState } from 'react'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import { Link } from 'react-router-dom'
import { getNavItems } from '../../config/navigation.config'
import {
  BRANDING,
  PAGE_CONTENT,
  FORM_CONFIG,
  THEME,
  LOGIN_RESPONSIVE,
  ICON,
  INTERACTIONS,
  BUTTON_SHIMMER,
  FORM_TILT,
} from '../../config/login.config'

/**
 * LoginForm Component
 * Right side login form - Oil & Gas Industrial Design
 * Advanced Engineering Interface
 */
const LoginForm = ({ loginSchema, isLoading, onSubmit, loginGate, onDismissGate }) => {
  const { company } = BRANDING
  const { title, subtitle } = PAGE_CONTENT
  const { fields, buttons, options } = FORM_CONFIG
  const { colors, gradients } = THEME

  // Soft-coded UX state — purely cosmetic, never affects auth payload
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const handleCapsLock = (e) => {
    if (!INTERACTIONS.capsLockWarning.enabled) return
    if (typeof e.getModifierState === 'function') setCapsLockOn(e.getModifierState('CapsLock'))
  }

  // 3D card tilt — pure CSS transform tracked by mouse position
  const cardRef = useRef(null)
  const buttonRef = useRef(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })
  const [buttonMagnet, setButtonMagnet] = useState({ x: 0, y: 0 })
  const [holographicPosition, setHolographicPosition] = useState(50)
  
  const handleTiltMove = (e) => {
    if (!FORM_TILT.enabled || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width  // 0..1
    const py = (e.clientY - rect.top) / rect.height
    setTilt({
      ry: (px - 0.5) * 2 * FORM_TILT.maxDeg,   // left/right
      rx: -(py - 0.5) * 2 * FORM_TILT.maxDeg,  // up/down
    })
    
    // Holographic shine effect follows mouse
    setHolographicPosition(px * 100)
    
    // Magnetic button attraction
    if (buttonRef.current && !isLoading) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const buttonCenterX = buttonRect.left + buttonRect.width / 2
      const buttonCenterY = buttonRect.top + buttonRect.height / 2
      const distanceX = e.clientX - buttonCenterX
      const distanceY = e.clientY - buttonCenterY
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)
      
      if (distance < 150) {
        const magnetStrength = (150 - distance) / 150
        setButtonMagnet({
          x: (distanceX / distance) * magnetStrength * 8,
          y: (distanceY / distance) * magnetStrength * 8
        })
      } else {
        setButtonMagnet({ x: 0, y: 0 })
      }
    }
  }
  
  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0 })
    setButtonMagnet({ x: 0, y: 0 })
  }

  return (
    <div className="relative">
      {/* Premium Glass Form Card */}
      <div
        ref={cardRef}
        onMouseMove={handleTiltMove}
        onMouseLeave={resetTilt}
        className="relative backdrop-blur-xl bg-gradient-to-br from-white/95 to-white/85 rounded-3xl p-8 border border-white/30 shadow-2xl overflow-hidden"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), inset 0 0 30px rgba(255, 255, 255, 0.1)',
          ...(FORM_TILT.enabled ? {
            perspective: `${FORM_TILT.perspective}px`,
            transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            transformStyle: 'preserve-3d',
            transition: `transform ${FORM_TILT.resetMs}ms ease-out`,
            willChange: 'transform',
          } : {})
        }}
      >
        {/* Holographic Shine Effect */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: `linear-gradient(110deg, transparent 30%, rgba(115, 189, 200, 0.3) ${holographicPosition}%, transparent 70%)`,
            transition: 'background 0.3s ease-out'
          }}
        />
        
        {/* Noise Texture for Depth */}
        <div 
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat'
          }}
        />
        {/* Accent Line */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-1 rounded-full" 
             style={{ background: 'linear-gradient(to right, #73BDC8, #7FCAB5, #73BDC8)' }}></div>

        {/* Welcome Section */}
        <div className="text-center mb-8">
          {/* Professional Rejlers Logo Badge */}
          <div className="inline-flex items-center justify-center mb-4 relative">
            <div className="relative">
              {/* Official Rejlers Logo */}
              <img 
                src="/assets/Rejlers_Logo.png" 
                alt="Rejlers" 
                className="h-16 w-auto"
                style={{
                  filter: 'drop-shadow(0 0 15px rgba(8, 145, 178, 0.3))'
                }}
              />
              
              {/* Pulsing glow effect */}
              <div 
                className="absolute inset-0 -z-10 blur-lg opacity-20"
                style={{
                  background: 'radial-gradient(circle, #0891b2 0%, #06b6d4 50%, transparent 70%)',
                  animation: 'glowPulse 3s ease-in-out infinite'
                }}
              />
            </div>
          </div>

          {/* Powered By Label */}
          <div className="mb-3">
            <div className="text-xs font-bold text-cyan-600 tracking-widest">POWERED BY REJLERS</div>
          </div>

          <h2 className="text-3xl font-black mb-2 bg-gradient-to-r from-slate-800 via-blue-700 to-cyan-600 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-gray-600 text-sm font-medium mb-4">
            {subtitle}
          </p>

          {/* Secure Portal Indicator */}
          <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-green-700 font-bold">🔐 Secure Industrial Portal</span>
          </div>
        </div>

        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={loginSchema}
          onSubmit={onSubmit}
        >
          {({ errors, touched }) => (
            <Form className="space-y-5">
              {/* Gate Banner */}
              {loginGate && (
                <div
                  className={`rounded-2xl border-2 p-4 shadow-lg ${
                    loginGate.severity === 'error'
                      ? 'bg-red-50 border-red-300 text-red-900'
                      : loginGate.severity === 'warning'
                        ? 'bg-orange-50 border-orange-300 text-orange-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl leading-none" aria-hidden>{loginGate.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold mb-1">{loginGate.title}</h4>
                      <p className="text-xs leading-relaxed">{loginGate.body}</p>
                      {loginGate.helpEmail && (
                        <a
                          href={
                            'mailto:' +
                            loginGate.helpEmail +
                            (loginGate.autoSubject
                              ? `?subject=${encodeURIComponent(loginGate.autoSubject)}`
                              : '') +
                            (loginGate.autoBody
                              ? `${loginGate.autoSubject ? '&' : '?'}body=${encodeURIComponent(loginGate.autoBody)}`
                              : '')
                          }
                          className="inline-flex items-center gap-1 mt-2 text-xs font-semibold underline hover:no-underline"
                        >
                          ✉️ {loginGate.helpEmailLabel || loginGate.helpEmail}
                        </a>
                      )}
                    </div>
                    {typeof onDismissGate === 'function' && (
                      <button
                        type="button"
                        onClick={onDismissGate}
                        className="text-xs opacity-60 hover:opacity-100 flex-shrink-0"
                        aria-label="Dismiss"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Email Field - Enhanced Industrial Design - Compact */}
              <div className={`relative group ${INTERACTIONS.errorShake.enabled && errors.email && touched.email ? 'login-shake' : ''}`}>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center">
                  <span className="w-1 h-3.5 bg-gradient-to-b from-blue-600 to-cyan-600 rounded-full mr-2"></span>
                  {fields.email.label}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                  </div>
                  <Field
                    name="email"
                    type={fields.email.type}
                    className={`w-full pl-16 pr-4 py-3 text-base border-2 rounded-xl 
                      ${errors.email && touched.email 
                        ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                      }
                      bg-white text-gray-900 placeholder-gray-400 
                      transition-all duration-300 font-medium
                      shadow-sm hover:shadow-md focus:shadow-lg`}
                    placeholder={fields.email.placeholder}
                  />
                </div>
                <ErrorMessage
                  name="email"
                  component="div"
                  className="text-red-600 text-xs mt-1.5 flex items-center font-semibold"
                />
              </div>

              {/* Password Field - Enhanced Industrial Design - Compact */}
              <div className={`relative group ${INTERACTIONS.errorShake.enabled && errors.password && touched.password ? 'login-shake' : ''}`}>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center">
                    <span className="w-1 h-3.5 bg-gradient-to-b from-amber-600 to-orange-600 rounded-full mr-2"></span>
                    {fields.password.label}
                  </span>
                  {INTERACTIONS.capsLockWarning.enabled && capsLockOn && (
                    <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full animate-pulse">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 01.78.375l6 7.5a1 1 0 01-.78 1.625H13v5a1 1 0 01-1 1H8a1 1 0 01-1-1v-5H4a1 1 0 01-.78-1.625l6-7.5A1 1 0 0110 2z"/></svg>
                      {INTERACTIONS.capsLockWarning.message}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                  <Field
                    name="password"
                    type={INTERACTIONS.passwordToggle.enabled && showPassword ? 'text' : fields.password.type}
                    onKeyDown={handleCapsLock}
                    onKeyUp={handleCapsLock}
                    className={`w-full pl-16 pr-14 py-3 text-base border-2 rounded-xl 
                      ${errors.password && touched.password 
                        ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' 
                        : 'border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                      }
                      bg-white text-gray-900 placeholder-gray-400 
                      transition-all duration-300 font-medium
                      shadow-sm hover:shadow-md focus:shadow-lg`}
                    placeholder={fields.password.placeholder}
                  />
                  {INTERACTIONS.passwordToggle.enabled && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPassword ? INTERACTIONS.passwordToggle.hideLabel : INTERACTIONS.passwordToggle.showLabel}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-blue-600 transition-colors z-10"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.93 11.93 0 013.34-4.66M9.88 9.88a3 3 0 104.24 4.24M3 3l18 18" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  )}
                </div>
                <ErrorMessage
                  name="password"
                  component="div"
                  className="text-red-600 text-xs mt-1.5 flex items-center font-semibold"
                />
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between pt-1">
                {options.rememberMe.enabled && (
                  <label className="flex items-center cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
                    />
                    <span className="ml-3 text-sm text-gray-700 font-semibold group-hover:text-blue-600 transition-colors">{options.rememberMe.label}</span>
                  </label>
                )}
                <a href={buttons.forgotPassword.link} className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center group">
                  {buttons.forgotPassword.text}
                  <svg className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </a>
              </div>

              {/* Sign In Button - Advanced with Magnetic Effect */}
              <button
                ref={buttonRef}
                type="submit"
                disabled={isLoading}
                className="relative w-full text-white font-bold py-4 px-6 rounded-xl overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg hover:shadow-2xl"
                style={{ 
                  background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)',
                  transform: `translate(${buttonMagnet.x}px, ${buttonMagnet.y}px) scale(${buttonMagnet.x || buttonMagnet.y ? 1.03 : 1})`,
                  boxShadow: buttonMagnet.x || buttonMagnet.y 
                    ? '0 20px 60px -10px rgba(8, 145, 178, 0.5), 0 0 0 2px rgba(115, 189, 200, 0.3)'
                    : '0 10px 30px -5px rgba(8, 145, 178, 0.3)',
                }}
              >
                {/* Animated Energy Flow Background */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 animate-pulse"></div>
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
                      animation: 'slideRight 2s linear infinite'
                    }}
                  />
                </div>
                
                {/* Technical Grid Overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                                   linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }}></div>

                {/* Soft-coded shimmer sweep */}
                {BUTTON_SHIMMER.enabled && !isLoading && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%)',
                      backgroundSize: '200% 100%',
                      animation: `login-shimmer ${BUTTON_SHIMMER.intervalMs}ms ease-in-out infinite`,
                    }}
                  />
                )}

                {/* Button Content */}
                <div className="relative z-10 flex items-center justify-center space-x-2.5">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-base tracking-wide">{buttons.submit.loadingText}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                      </svg>
                      <span className="text-base tracking-wide">{buttons.submit.text}</span>
                      <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </div>
              </button>

              {/* Security Badge */}
              <div className="flex items-center justify-center space-x-2 pt-1.5">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span className="text-xs text-gray-600 font-semibold">256-bit SSL Encrypted Connection</span>
              </div>

              {/* SOFT-CODED: Subscription button disabled for in-house deployment */}
              {/* {buttons.subscription?.enabled && (
                <div className="pt-2">
                  <Link 
                    to={buttons.subscription.link}
                    className="relative w-full flex items-center justify-center space-x-2 px-6 py-3 rounded-xl overflow-hidden transition-all duration-300 group shadow-md hover:shadow-lg border-2"
                    style={{
                      background: buttons.subscription.style === 'primary' 
                        ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)'
                        : buttons.subscription.style === 'outline'
                        ? 'transparent'
                        : 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
                      borderColor: buttons.subscription.style === 'outline' ? '#7c3aed' : 'transparent',
                      color: buttons.subscription.style === 'outline' ? '#7c3aed' : '#ffffff'
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative z-10 flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-bold text-sm">{buttons.subscription.text}</span>
                      <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </Link>
                  {buttons.subscription.description && (
                    <p className="text-center text-xs text-gray-500 mt-2">{buttons.subscription.description}</p>
                  )}
                </div>
              )} */}
            </Form>
          )}
        </Formik>

        {/* Footer - Industrial Style - Compact */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          {/* Soft-coded Navigation Links - From navigation.config.js */}
          <div className="flex items-center justify-center flex-wrap gap-2 mb-2">
            {getNavItems('public')
              .filter(item => item.id !== 'home')
              .map((item, index, array) => (
                <React.Fragment key={item.id}>
                  <Link 
                    to={item.path}
                    className="text-xs text-gray-500 hover:text-blue-600 transition-colors font-medium"
                  >
                    {item.label}
                  </Link>
                  {index < array.length - 1 && <span className="text-gray-300">|</span>}
                </React.Fragment>
              ))}
          </div>

          {/* Copyright & Status Combined */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>© 2025 RADAI</span>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .login-shake { animation: login-shake ${INTERACTIONS.errorShake.durationMs}ms ease-in-out; }
        @keyframes login-shimmer {
          0%   { background-position: 200% 0; }
          60%  { background-position: -100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes slideRight {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export default LoginForm
