import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import * as Yup from 'yup'
import { toast } from 'react-toastify'
import { loginStart, loginSuccess, loginFailure } from '../store/slices/authSlice'
import { authService } from '../services/auth.service'
import LoginBranding from '../components/login/LoginBranding'
import LoginForm from '../components/login/LoginForm'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import {
  VALIDATION_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  NAVIGATION,
  LOGGING,
  HTTP_STATUS,
  THEME,
  LOGIN_RESPONSIVE,
  parseLoginError,
} from '../config/login.config'
import { REDIRECT_AFTER_LOGIN_KEY } from '../config/solutions.config'

/**
 * Login Page
 * Soft-coded login form with validation
 * All configuration moved to login.config.js
 * Fully responsive for all devices
 */

// Validation schema from configuration
const loginSchema = Yup.object().shape({
  email: Yup.string().email(VALIDATION_CONFIG.email.invalid).required(VALIDATION_CONFIG.email.required),
  password: Yup.string().required(VALIDATION_CONFIG.password.required),
})

const Login = () => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [isLoading, setIsLoading] = useState(false)
  // Soft-coded gate banner state: populated by parseLoginError when the
  // backend returns a non_field_errors message that matches LOGIN_GATES
  // (e.g. 'pending administrator approval'). Cleared on a fresh submit.
  const [loginGate, setLoginGate] = useState(null)
  
  // Advanced interactive effects
  const containerRef = useRef(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [particles, setParticles] = useState([])
  
  // Advanced mouse tracking for interactive spotlight & particle effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])
  
  // Initialize advanced particle system with cursor attraction
  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      color: ['#73BDC8', '#7FCAB5', '#617AAD', '#F6B2BB'][Math.floor(Math.random() * 4)],
      opacity: Math.random() * 0.6 + 0.2
    }))
    setParticles(newParticles)
  }, [])

  const handleSubmit = async (values) => {
    setIsLoading(true)
    setLoginGate(null)
    dispatch(loginStart())

    try {
      // Logging - controlled by configuration
      if (LOGGING.enabled) {
        console.log(LOGGING.login.attempt, values.email)
        console.log(LOGGING.login.sending)
      }
      
      const startTime = Date.now()
      const userData = await authService.login(values)
      const endTime = Date.now()
      
      if (LOGGING.enabled) {
        console.log(LOGGING.login.success, endTime - startTime, 'ms')
        console.log(LOGGING.login.userData, userData)
      }
      
      dispatch(loginSuccess(userData))
      toast.success(SUCCESS_MESSAGES.login)

      // SOFT-CODED: If the user arrived here via a "Get Started" button on the
      // Solutions page, redirect them directly to the feature they clicked.
      // The destination is stored under REDIRECT_AFTER_LOGIN_KEY in sessionStorage.
      // Clear the key after reading so subsequent logins use the default route.
      const intendedPath = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY)
      if (intendedPath) {
        sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY)
        navigate(intendedPath)
      } else {
        navigate(NAVIGATION.afterLogin)
      }
    } catch (error) {
      // Comprehensive error logging - controlled by configuration
      if (LOGGING.enabled) {
        console.group(LOGGING.login.failed)
        console.error('Error Type:', error.constructor.name)
        console.error('Error Message:', error.message)
        console.error('Is Timeout:', error.isTimeout || false)
        console.error('Is Network Error:', error.isNetworkError || false)
        console.error('HTTP Status:', error.response?.status)
        console.error('Response Data:', error.response?.data)
        console.error('Full Error:', error)
        console.groupEnd()
      }
      
      // Determine user-friendly error message from configuration
      // Soft-coded: parseLoginError reads every Django/DRF response shape
      // (detail, message, error, non_field_errors, first-field-error) and
      // matches against LOGIN_GATES so the user sees the real reason
      // (e.g. 'pending administrator approval') instead of a silent '400'.
      const { message: parsedMessage, gate } = parseLoginError(error)
      let errorMessage = parsedMessage || ERROR_MESSAGES.unexpected.message

      if (gate) {
        // Surface gate in the inline banner; suppress duplicate toast so the
        // banner is the single source of truth for the user.
        setLoginGate(gate)
        if (LOGGING.enabled) {
          console.info('[Login] Matched gate:', gate.id, '-', gate.title)
        }
      } else if (error.isTimeout) {
        errorMessage = ERROR_MESSAGES.timeout.message
        if (LOGGING.enabled) console.error(ERROR_MESSAGES.timeout.console)
      } else if (error.isNetworkError) {
        errorMessage = ERROR_MESSAGES.network.message
        if (LOGGING.enabled) console.error(ERROR_MESSAGES.network.console)
      }

      dispatch(loginFailure(errorMessage))
      if (!gate) toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div 
      ref={containerRef}
      className="min-h-screen relative flex items-center justify-center overflow-hidden" 
      style={{ 
        background: 'linear-gradient(135deg, #0A1628 0%, #0D1B33 50%, #0A1628 100%)',
        backgroundSize: '200% 200%',
        animation: 'gradientShift 15s ease infinite'
      }}
    >
      {/* Noise Texture Overlay for Premium Feel */}
      <div 
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      />

      {/* Mouse-Tracked Spotlight Effect */}
      <div 
        className="absolute pointer-events-none transition-opacity duration-300"
        style={{
          width: '600px',
          height: '600px',
          left: mousePosition.x - 300,
          top: mousePosition.y - 300,
          background: 'radial-gradient(circle, rgba(115, 189, 200, 0.15) 0%, rgba(127, 202, 181, 0.08) 30%, transparent 70%)',
          filter: 'blur(40px)',
          opacity: containerRef.current ? 1 : 0
        }}
      />

      {/* Advanced Interactive Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(particle => {
          const dx = mousePosition.x - (particle.x / 100 * (containerRef.current?.offsetWidth || window.innerWidth))
          const dy = mousePosition.y - (particle.y / 100 * (containerRef.current?.offsetHeight || window.innerHeight))
          const distance = Math.sqrt(dx * dx + dy * dy)
          const maxDistance = 200
          const force = Math.max(0, 1 - distance / maxDistance)
          
          return (
            <div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                width: particle.size + 'px',
                height: particle.size + 'px',
                left: `calc(${particle.x}% + ${dx * force * 0.1}px)`,
                top: `calc(${particle.y}% + ${dy * force * 0.1}px)`,
                backgroundColor: particle.color,
                opacity: particle.opacity + force * 0.3,
                boxShadow: `0 0 ${10 + force * 20}px ${particle.color}`,
                transition: 'all 0.3s ease-out',
                animation: `floatAdvanced ${15 + particle.id * 2}s linear infinite`,
                animationDelay: `-${particle.id * 0.5}s`
              }}
            />
          )
        })}
      </div>

      {/* Animated Oil & Gas Industry Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Pipeline Network Animation */}
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#73BDC8', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#7FCAB5', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#617AAD', stopOpacity: 1 }} />
            </linearGradient>
            
            {/* Flowing particles in pipeline */}
            <circle id="particle" r="2" fill="#7FCAB5" opacity="0.8">
              <animate attributeName="opacity" values="0.3;0.9;0.3" dur="2s" repeatCount="indefinite"/>
            </circle>
          </defs>
          
          {/* Horizontal pipeline paths */}
          <path d="M 0,100 Q 400,80 800,100 T 1600,100" stroke="url(#pipeGrad)" strokeWidth="2" fill="none" opacity="0.4">
            <animate attributeName="d" 
              values="M 0,100 Q 400,80 800,100 T 1600,100; M 0,100 Q 400,120 800,100 T 1600,100; M 0,100 Q 400,80 800,100 T 1600,100" 
              dur="8s" repeatCount="indefinite"/>
          </path>
          <path d="M 0,300 Q 500,280 1000,300 T 2000,300" stroke="url(#pipeGrad)" strokeWidth="2" fill="none" opacity="0.3">
            <animate attributeName="d" 
              values="M 0,300 Q 500,280 1000,300 T 2000,300; M 0,300 Q 500,320 1000,300 T 2000,300; M 0,300 Q 500,280 1000,300 T 2000,300" 
              dur="10s" repeatCount="indefinite"/>
          </path>
          <path d="M 0,500 Q 600,480 1200,500 T 2400,500" stroke="url(#pipeGrad)" strokeWidth="2" fill="none" opacity="0.2">
            <animate attributeName="d" 
              values="M 0,500 Q 600,480 1200,500 T 2400,500; M 0,500 Q 600,520 1200,500 T 2400,500; M 0,500 Q 600,480 1200,500 T 2400,500" 
              dur="12s" repeatCount="indefinite"/>
          </path>
          
          {/* Vertical connections */}
          <line x1="200" y1="100" x2="200" y2="300" stroke="url(#pipeGrad)" strokeWidth="1.5" opacity="0.3"/>
          <line x1="600" y1="300" x2="600" y2="500" stroke="url(#pipeGrad)" strokeWidth="1.5" opacity="0.2"/>
          <line x1="1000" y1="100" x2="1000" y2="500" stroke="url(#pipeGrad)" strokeWidth="1.5" opacity="0.25"/>
          
          {/* Pipeline nodes */}
          <circle cx="200" cy="100" r="6" fill="#73BDC8" opacity="0.6">
            <animate attributeName="r" values="6;8;6" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="600" cy="300" r="6" fill="#7FCAB5" opacity="0.6">
            <animate attributeName="r" values="6;9;6" dur="4s" repeatCount="indefinite"/>
          </circle>
          <circle cx="1000" cy="500" r="6" fill="#617AAD" opacity="0.6">
            <animate attributeName="r" values="6;10;6" dur="5s" repeatCount="indefinite"/>
          </circle>
        </svg>

        {/* 3D Floating Orbs with Perspective */}
        <div className="absolute inset-0" style={{ perspective: '1000px' }}>
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            return (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: '20px',
                  height: '20px',
                  left: `${50 + Math.cos(angle) * 30}%`,
                  top: `${50 + Math.sin(angle) * 30}%`,
                  background: `radial-gradient(circle at 30% 30%, ${['#73BDC8', '#7FCAB5', '#617AAD', '#F6B2BB'][i % 4]}, ${['#617AAD', '#73BDC8', '#F6B2BB', '#7FCAB5'][i % 4]})`,
                  opacity: 0.4,
                  boxShadow: `0 0 30px ${['#73BDC8', '#7FCAB5', '#617AAD', '#F6B2BB'][i % 4]}`,
                  animation: `orbit3D ${20 + i * 3}s linear infinite`,
                  animationDelay: `-${i * 2}s`,
                  transform: 'translateZ(0)',
                  filter: 'blur(1px)'
                }}
              />
            )
          })}
        </div>

        {/* Abu Dhabi Skyline Silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-48 opacity-15">
          <svg viewBox="0 0 1200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
              <linearGradient id="skylineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#73BDC8', stopOpacity: 0.8 }} />
                <stop offset="100%" style={{ stopColor: '#0A1628', stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            {/* Simplified Abu Dhabi skyline */}
            <path fill="url(#skylineGrad)" d="M0,200 L0,120 L80,120 L80,80 L100,80 L100,120 L180,120 L180,60 L220,60 L220,120 L280,120 L280,40 L320,40 L320,120 L400,120 L400,90 L440,90 L440,120 L520,120 L520,70 L560,70 L560,120 L640,120 L640,50 L680,50 L680,120 L760,120 L760,100 L800,100 L800,120 L880,120 L880,85 L920,85 L920,120 L1000,120 L1000,95 L1040,95 L1040,120 L1120,120 L1120,110 L1160,110 L1160,120 L1200,120 L1200,200 Z">
              <animate attributeName="opacity" values="0.12;0.18;0.12" dur="8s" repeatCount="indefinite"/>
            </path>
          </svg>
        </div>

        {/* Radial Energy Glow */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse" 
             style={{ background: 'radial-gradient(circle, #73BDC8 0%, transparent 70%)', animationDuration: '6s' }}></div>
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-15 animate-pulse" 
             style={{ background: 'radial-gradient(circle, #7FCAB5 0%, transparent 70%)', animationDuration: '8s', animationDelay: '2s' }}></div>
      </div>

      {/* Main Login Container - Glass Morphism Design */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          
          {/* Left Panel - Branding & Industry Visual */}
          <div className="relative">
            {/* Premium Glass Card */}
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-8 border border-white/20 shadow-2xl" 
                 style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(127, 202, 181, 0.1)' }}>
              
              {/* Rejlers Logo & Brand */}
              <div className="mb-8">
                {/* Professional Rejlers Logo */}
                <div className="mb-6">
                  <div className="relative inline-block">
                    {/* Official Rejlers Logo */}
                    <img 
                      src="/assets/Rejlers_Logo.png" 
                      alt="Rejlers" 
                      className="h-20 w-auto drop-shadow-2xl"
                      style={{
                        filter: 'drop-shadow(0 0 20px rgba(115, 189, 200, 0.4))'
                      }}
                    />
                    
                    {/* Animated glow effect behind logo */}
                    <div 
                      className="absolute inset-0 -z-10 blur-xl opacity-30"
                      style={{
                        background: 'radial-gradient(circle, #73BDC8 0%, #7FCAB5 50%, transparent 70%)',
                        animation: 'glowPulse 3s ease-in-out infinite'
                      }}
                    />
                  </div>
                  
                  {/* Company Name & Location */}
                  <div className="mt-4">
                    <h1 className="text-4xl font-black text-white tracking-tight leading-none mb-2">
                      Rejlers
                    </h1>
                    <p className="text-lg font-bold" style={{ 
                      background: 'linear-gradient(to right, #73BDC8, #7FCAB5)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}>
                      Abu Dhabi
                    </p>
                  </div>
                </div>

                {/* Oil & Gas Excellence Badge */}
                <div className="inline-flex items-center px-4 py-2 rounded-full border border-cyan-400/30 backdrop-blur-sm" 
                     style={{ backgroundColor: 'rgba(115, 189, 200, 0.15)' }}>
                  <svg className="w-5 h-5 mr-2 text-cyan-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                  </svg>
                  <span className="text-sm font-bold text-cyan-100">Oil & Gas Engineering Excellence</span>
                </div>
              </div>

              {/* RAD AI Platform */}
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-white leading-tight">
                  RAD AI Platform
                </h2>
                <p className="text-cyan-100 text-lg leading-relaxed">
                  Next-generation AI-powered engineering workspace for the Oil & Gas industry
                </p>

                {/* Live Industry Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/20">
                  <div className="text-center">
                    <div className="text-3xl font-black mb-1" style={{ color: '#73BDC8' }}>
                      <span className="tabular-nums">99.9</span>
                      <span className="text-2xl">%</span>
                    </div>
                    <div className="text-xs text-cyan-200 font-semibold">Platform Uptime</div>
                  </div>
                  <div className="text-center border-x border-white/20">
                    <div className="text-3xl font-black mb-1" style={{ color: '#7FCAB5' }}>
                      <span className="tabular-nums">24</span>
                      <span className="text-xl">/7</span>
                    </div>
                    <div className="text-xs text-cyan-200 font-semibold">AI Support</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black mb-1" style={{ color: '#F6B2BB' }}>
                      <svg className="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                      </svg>
                    </div>
                    <div className="text-xs text-cyan-200 font-semibold">Powered</div>
                  </div>
                </div>

                {/* Feature Highlights */}
                <div className="space-y-2 pt-4">
                  {[
                    { icon: '⚡', text: 'Real-time Process Automation' },
                    { icon: '🔬', text: 'Advanced Engineering Analytics' },
                    { icon: '🛡️', text: 'Enterprise-grade Security' }
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center space-x-3 text-cyan-100">
                      <span className="text-2xl">{feature.icon}</span>
                      <span className="font-semibold text-sm">{feature.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Abu Dhabi Location Badge */}
              <div className="mt-8 pt-6 border-t border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <svg className="w-6 h-6 text-cyan-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <div className="text-white font-bold text-sm">Abu Dhabi, UAE</div>
                      <div className="text-cyan-200 text-xs">Global Engineering Hub</div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <div className="text-xs text-green-300 font-semibold">Online</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <LoginForm 
            loginSchema={loginSchema}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            loginGate={loginGate}
            onDismissGate={() => setLoginGate(null)}
          />
        </div>
      </div>

      {/* Advanced Animation Keyframes & Effects */}
      <style>{`
        @keyframes floatAdvanced {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -40px) scale(1.2); }
          50% { transform: translate(-20px, -80px) scale(0.9); }
          75% { transform: translate(40px, -120px) scale(1.1); }
        }
        
        @keyframes orbit3D {
          0% { transform: rotateY(0deg) rotateX(0deg) translateZ(50px); }
          25% { transform: rotateY(90deg) rotateX(15deg) translateZ(100px); }
          50% { transform: rotateY(180deg) rotateX(0deg) translateZ(50px); }
          75% { transform: rotateY(270deg) rotateX(-15deg) translateZ(100px); }
          100% { transform: rotateY(360deg) rotateX(0deg) translateZ(50px); }
        }
        
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        @keyframes holographicShine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(115, 189, 200, 0.3), 0 0 40px rgba(127, 202, 181, 0.2); }
          50% { box-shadow: 0 0 40px rgba(115, 189, 200, 0.5), 0 0 80px rgba(127, 202, 181, 0.3); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-20px); }
        }
      `}</style>

      {/* PWA Install Prompt - Non-intrusive desktop app download */}
      <PWAInstallPrompt />
    </div>
  )
}

export default Login
