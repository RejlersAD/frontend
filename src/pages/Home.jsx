import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { REJLERS_COLORS, BRAND_TEXT } from '../config/theme.config'
import { LOGO_CONFIG, getLogoPath } from '../config/logo.config'
import { FOOTER_CONFIG } from '../config/footer.config'
import { getNavItems, getMobileNavItems, NAV_STYLES, getActiveNavItem } from '../config/navigation.config'
import {
  HERO_CONFIG,
  PLATFORM_STATS,
  MODULES_CONFIG,
  KEY_FEATURES,
  AI_CAPABILITIES,
  CTA_CONFIG,
  SOCIAL_PROOF
} from '../config/homeContent.config'
import PWAInstallPrompt from '../components/PWAInstallPrompt'
import PWAInstallModal from '../components/PWAInstallModal'

// ─── PWA Install Button Component (Navigation Version) ───────────────────────
const PWAInstallButton = ({ mobile, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showButton, setShowButton] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowButton(true)
    }

    const handleAppInstalled = () => {
      setShowButton(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = () => {
    if (!deferredPrompt) return
    // Show our custom modal first
    setShowModal(true)
  }

  const handleModalInstall = async () => {
    if (!deferredPrompt) return

    // Close modal
    setShowModal(false)
    if (onClose) onClose()

    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300))

    // Show browser prompt
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      console.log('✅ PWA installed from nav button')
    }
    setDeferredPrompt(null)
    setShowButton(false)
  }

  if (!showButton) return null

  // Mobile version
  if (mobile) {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-bold transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(8,145,178,0.4)'
          }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download Desktop App</span>
          </div>
        </button>
        <PWAInstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onInstall={handleModalInstall}
        />
      </>
    )
  }

  // Desktop version
  return (
    <>
      <button
        onClick={handleInstallClick}
        className="group flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300 hover:scale-105"
        style={{
          background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
          color: '#fff',
          boxShadow: '0 4px 14px rgba(8,145,178,0.3)'
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Download</span>
      </button>
      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onInstall={handleModalInstall}
      />
    </>
  )
}

// - SOFT-CODED animation + marketing config (edit here, no deeper change needed) -
const LANDING_CONFIG = {
  typewriterStrings: [
    'P&ID Quality Checking',
    'PFD Verification',
    'ADNOC Standards Compliance',
    'Engineering Intelligence',
    'Safety-Critical Review',
    'ISO 10628 Validation',
  ],
  typewriterSpeed: 80,   // ms per character
  typewriterPause: 2200, // ms pause at full string
  particleCount: 22,
  counterDuration: 2200, // ms for number counter animation
  showProductModules: false, // set true to re-enable the Product Suite section
  // Floating AI keyword chips in the hero - edit labels freely
  heroTokens: ['LLM', 'SLM', 'ML', 'ADNOC', 'ISA-5.1', 'Quantum', 'P&ID', 'RAG', 'API-520', 'IEC-61511', 'ASME', 'NLP'],
  // AI Engine section - soft-coded, edit freely
  aiEngine: {
    sectionLabel: 'AI ENGINE',
    headline:     'Multi-Model Intelligence for',
    headlineGrad: 'Engineering Precision',
    body: 'RADAI orchestrates a layered AI stack — Large Language Models for contextual understanding, Small Language Models for rapid clause-matching, Classical ML for anomaly detection, and Quantum-inspired optimisation for complex constraint solving — all converging on a single verified P&ID finding.',
    layers: [
      { label:'LLM Layer',     desc:'Contextual P&ID understanding + standard interpretation', color:'#7FCAB5', width:'100%' },
      { label:'SLM Layer',     desc:'High-speed clause extraction + ADNOC rule matching',      color:'#0ea5e9', width:'82%'  },
      { label:'ML / Vision',   desc:'Symbol detection, valve classification, anomaly flags',   color:'#a78bfa', width:'91%'  },
      { label:'Quantum Optim.',desc:'Multi-constraint compliance solving + risk scoring',       color:'#f59e0b', width:'74%'  },
    ],
    // Radar axes - change labels/values (0-1) freely
    radar: [
      { axis:'LLM Context',    value: 0.97 },
      { axis:'SLM Speed',      value: 0.91 },
      { axis:'ML Accuracy',    value: 0.94 },
      { axis:'Quantum Optim.', value: 0.78 },
      { axis:'NLP Extraction', value: 0.89 },
      { axis:'RAG Retrieval',  value: 0.93 },
    ],
  },
  stats: [],
  whyRadai: {
    sectionLabel: 'WHY RADAI',
    headline:     'Engineered for',
    headlineGrad: 'Abu Dhabi',
    sub: "Every feature of RADAI was designed around the standards, workflows, and expectations of Abu Dhabi's leading oil & gas companies.",
  },
  abuDhabiFeatures: [
    {
      icon: 'AD',
      title: 'ADNOC Standards',
      desc: 'Built-in compliance rules for ADNOC GSPs, ADNOC-DIST, ADNOC-L&S, and all Abu Dhabi upstream/downstream specifications.',
      color: '#0ea5e9',
      tags: ['ADNOC GSP','ADNOC-DIST','Upstream','Downstream'],
      highlight: '40+ GSP rules',
    },
    {
      icon: 'SA',
      title: 'ISA / API / ASME',
      desc: 'Automated checks against ISA-5.1, API 520/521/610, ASME B31.3, IEC 61511 and 40+ international engineering standards.',
      color: '#7FCAB5',
      tags: ['ISA-5.1','API 520','ASME B31.3','IEC 61511'],
      highlight: '40+ standards',
    },
    {
      icon: 'AI',
      title: 'Multi-Model AI Stack',
      desc: 'LLM, SLM, ML Vision and Quantum-inspired optimisation run in parallel — every P&ID finding is consensus-verified before reaching your engineers.',
      color: '#a78bfa',
      tags: ['LLM','SLM','ML Vision','Quantum','RAG'],
      highlight: '99% accuracy',
    },
    {
      icon: 'SC',
      title: 'Enterprise Security',
      desc: 'ISO 27001-aligned data handling. Role-based access control. Your drawings never leave your secure environment.',
      color: '#f59e0b',
      tags: ['ISO 27001','RBAC','Encrypted','On-Prem Ready'],
      highlight: 'Zero data leak',
    },
    {
      icon: 'QH',
      title: 'QHSE & Compliance',
      desc: 'Integrated quality, health, safety and environment modules with real-time dashboards and incident-zero tracking.',
      color: '#10b981',
      tags: ['QHSE','HSE','Incident Tracking','Real-time'],
      highlight: 'Incident-zero',
    },
    {
      icon: 'GL',
      title: 'Abu Dhabi Market Focus',
      desc: "Developed by Rejlers Engineering Solutions, operating in Abu Dhabi since the 1980s. We understand the region's unique standards.",
      color: '#f43f5e',
      tags: ['Abu Dhabi','Since 1980s','Local Expertise','Oil & Gas'],
      highlight: '40+ yrs local',
    },
  ],
  // -- CTA section -- edit labels/buttons/steps freely
  cta: {
    sectionLabel: 'GET STARTED TODAY',
    headline:     'Ready to Transform Your',
    headlineGrad: 'Engineering Workflow?',
    body: "Join Abu Dhabi's engineering teams already using RADAI to review P&IDs faster, catch compliance issues earlier, and deliver better drawings to their clients.",
    secondaryBtn: { label: 'Request a Demo', to: '/enquiry' },
    trustPills:   ['Free to start', 'Abu Dhabi support', 'ADNOC compliant', 'ISO 27001', 'No lock-in'],
    steps: [
      { num: '01', icon: '↑', label: 'Upload Drawing',   desc: 'Upload any P&ID PDF or image — ADNOC, ISA-5.1 or custom format', color: '#7FCAB5' },
      { num: '02', icon: '✦', label: 'AI Multi-Pass',    desc: 'LLM + SLM + ML Vision run in parallel — findings in under 60 s',  color: '#0ea5e9' },
      { num: '03', icon: '✓', label: 'Certified Report', desc: 'Standards-cited findings, evidence clips and exportable PDF report', color: '#a78bfa' },
    ],
    bgWords: ['P&ID','LLM','ADNOC','ISA-5.1','SLM','Quantum','ML','RAG','API-520','NLP','ASME','IEC'],
  },
}

// - Hooks -

/** Returns true once the ref element scrolls into view */
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

// - Sub-components -

/** Typewriter that cycles through an array of strings */
function TypeWriter({ strings, speed = 80, pause = 2200 }) {
  const [display, setDisplay] = useState('')
  const [strIdx, setStrIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const current = strings[strIdx]
    let delay = deleting ? speed / 2 : speed

    if (!deleting && charIdx === current.length) {
      delay = pause
      const t = setTimeout(() => setDeleting(true), delay)
      return () => clearTimeout(t)
    }
    if (deleting && charIdx === 0) {
      setDeleting(false)
      setStrIdx(i => (i + 1) % strings.length)
      return
    }
    const t = setTimeout(() => {
      setDisplay(current.slice(0, charIdx + (deleting ? -1 : 1)))
      setCharIdx(i => i + (deleting ? -1 : 1))
    }, delay)
    return () => clearTimeout(t)
  }, [charIdx, deleting, strIdx, strings, speed, pause])

  return (
    <span className="relative">
      <span style={{ color: '#7FCAB5' }}>{display}</span>
      <span className="animate-pulse" style={{ color: '#2AA784', marginLeft: 1 }}>|</span>
    </span>
  )
}

/** Animated number counter */
function AnimatedCounter({ end, suffix = '', duration = 2200 }) {
  const [ref, visible] = useInView()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!visible) return
    const steps = 60
    const step = end / steps
    let current = 0
    const interval = setInterval(() => {
      current = Math.min(current + step, end)
      setCount(Math.round(current))
      if (current >= end) clearInterval(interval)
    }, duration / steps)
    return () => clearInterval(interval)
  }, [visible, end, duration])
  return <span ref={ref}>{count}{suffix}</span>
}

/** Section that fades + slides in when scrolled into view */
function RevealSection({ children, className = '', delay = 0, direction = 'up' }) {
  const [ref, visible] = useInView()
  const transforms = { up: 'translateY(40px)', down: 'translateY(-40px)', left: 'translateX(-40px)', right: 'translateX(40px)' }
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : (transforms[direction] || transforms.up),
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}

/** Floating particle dot */
function Particle({ style }) {
  return <div className="absolute rounded-full pointer-events-none" style={style} />
}

/**
 * Home Page - RADAI Landing Page
 * Cinematic Oil & Gas AI marketing design for Abu Dhabi market
 * Soft-coded: edit LANDING_CONFIG above to change content, timings, and stats
 */


const Home = () => {
  const location = useLocation();
  
  // - Particles (generated once on mount) -
  const particles = useRef(
    Array.from({ length: LANDING_CONFIG.particleCount }, (_, i) => ({
      id: i,
      width:  Math.random() * 6 + 2,
      top:    Math.random() * 100,
      left:   Math.random() * 100,
      opacity: Math.random() * 0.4 + 0.1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 4,
      color: ['#7FCAB5','#2AA784','#73bdc8','#a78bfa','#0ea5e9'][i % 5],
    }))
  ).current

  // - Soft-coded navigation items -
  const navItems = getNavItems('public').filter(item => item.id !== 'home'); // Hide 'Home' from nav
  const mobileNavItems = getMobileNavItems('public').filter(item => item.id !== 'home');
  const activeItem = getActiveNavItem(location.pathname, 'public');

  // - Nav scroll state -
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* - Global keyframe styles - */}
      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0px) scale(1);   opacity: 0.15; }
          50%  { transform: translateY(-28px) scale(1.1); opacity: 0.35; }
          100% { transform: translateY(0px) scale(1);   opacity: 0.15; }
        }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes heroFade {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pipeFlow {
          0%   { stroke-dashoffset: 600; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes scanLine {
          0%   { top: 0%; opacity: 0.6; }
          50%  { opacity: 0.3; }
          100% { top: 100%; opacity: 0.6; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(127,202,181,0.3); }
          50%       { box-shadow: 0 0 45px rgba(127,202,181,0.7), 0 0 80px rgba(42,167,132,0.3); }
        }
        @keyframes orbRotate {
          from { transform: rotate(0deg) translateX(120px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(120px) rotate(-360deg); }
        }
        .hero-animate { animation: heroFade 0.9s ease forwards; }
        .hero-animate-d1 { animation: heroFade 0.9s ease 0.2s both; }
        .hero-animate-d2 { animation: heroFade 0.9s ease 0.4s both; }
        .hero-animate-d3 { animation: heroFade 0.9s ease 0.6s both; }
        .hero-animate-d4 { animation: heroFade 0.9s ease 0.8s both; }
        .gradient-text-animated {
          background: linear-gradient(270deg, #7FCAB5, #2AA784, #73BDC8, #617AAD, #7FCAB5);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 4s ease infinite;
        }
        .glow-btn { animation: glowPulse 2.5s ease-in-out infinite; }
        .module-card:hover .module-icon { transform: scale(1.18) rotate(-4deg); }
        .module-icon { transition: transform 0.35s cubic-bezier(.34,1.56,.64,1); }
        .pipeline-svg { animation: pipeFlow 3s ease forwards; stroke-dasharray: 600; stroke-dashoffset: 600; }
        .scan-line { animation: scanLine 3.5s linear infinite; }

        /* -- AI Neural-Net (right panel) -- */
        @keyframes hexRing  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes innerRing{ from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
        @keyframes aiNode   { 0%,100%{ opacity:.45; } 50%{ opacity:1; } }
        @keyframes aiRipple { from { r:7; opacity:.7; stroke-width:1.5; } to { r:30; opacity:0; stroke-width:.2; } }
        @keyframes aiEdge   {
          0%   { stroke-dashoffset: 400; opacity: 0; }
          15%  { opacity: .45; }
          85%  { opacity: .45; }
          100% { stroke-dashoffset: -400; opacity: 0; }
        }
        @keyframes dataStreamFall {
          0%   { transform: translateY(-14px); opacity: 0; }
          15%  { opacity: .18; }
          85%  { opacity: .18; }
          100% { transform: translateY(14px); opacity: 0; }
        }

        /* -- Headline glitch -- */
        @keyframes glitchShiftA {
          0%,73%,100% { transform: translate(0); opacity: 0; clip-path: none; }
          75%  { transform: translate(-5px,1px);  opacity: .55; clip-path: inset(14% 0 66% 0); }
          77%  { transform: translate(5px,-1px);  opacity: .55; clip-path: inset(57% 0 12% 0); }
          79%  { transform: translate(-2px,0);    opacity: .3;  clip-path: inset(33% 0 48% 0); }
          81%  { transform: translate(0);         opacity: 0;   clip-path: none; }
        }
        @keyframes glitchShiftB {
          0%,73%,100% { transform: translate(0); opacity: 0; clip-path: none; }
          75%  { transform: translate(5px,-1px);  opacity: .5; clip-path: inset(63% 0 10% 0); }
          77%  { transform: translate(-5px,1px);  opacity: .5; clip-path: inset(8% 0 62% 0); }
          79%  { transform: translate(2px,0);     opacity: .25; clip-path: inset(44% 0 30% 0); }
          81%  { transform: translate(0);         opacity: 0;   clip-path: none; }
        }

        /* -- Scan beam across headline -- */
        @keyframes scanBeam {
          0%   { left: -55%; opacity: 0; }
          8%   { opacity: .9; }
          92%  { opacity: .9; }
          100% { left: 115%; opacity: 0; }
        }

        /* -- Floating token chips -- */
        @keyframes tokenRise {
          0%   { transform: translateY(0) scale(1);    opacity: 0; }
          10%  { opacity: .65; }
          88%  { opacity: .65; }
          100% { transform: translateY(-130px) scale(.5); opacity: 0; }
        }

        /* -- "Abu Dhabi" glow pulse -- */
        @keyframes abGlow {
          0%,100% { opacity: 1; }
          50%     { opacity: .88; filter: drop-shadow(0 0 14px rgba(127,202,181,.7)); }
        }

        /* -- AI layer progress bar fill -- */
        @keyframes barFill {
          from { width: 0%; opacity: 0; }
          to   { opacity: 1; }
        }

        /* -- Floating quantum particles -- */
        @keyframes qDrift {
          0%   { transform: translate(0,0) scale(1);     opacity: 0; }
          15%  { opacity: .55; }
          85%  { opacity: .55; }
          100% { transform: translate(var(--qx),var(--qy)) scale(0.4); opacity: 0; }
        }

        /* -- Radar-chart polygon stroke -- */
        @keyframes radarDraw {
          from { stroke-dashoffset: 1000; opacity: 0; }
          to   { stroke-dashoffset: 0;    opacity: 1; }
        }

        /* -- Radar label pulse -- */
        @keyframes axPulse {
          0%,100% { opacity: .6; }
          50%      { opacity: 1; }
        }

        /* -- Processing status ticker -- */
        @keyframes tickerSlide {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* -- Stack layer card enter -- */
        @keyframes layerEnter {
          from { opacity: 0; transform: translateX(-28px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* -- Central AI core pulse -- */
        @keyframes corePulse {
          0%,100% { box-shadow: 0 0 25px rgba(127,202,181,0.25), 0 0 60px rgba(42,167,132,0.1); }
          50%      { box-shadow: 0 0 55px rgba(127,202,181,0.55), 0 0 110px rgba(42,167,132,0.25); }
        }

        /* -- Quantum ring rotation -- */
        @keyframes qRing1 { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes qRing2 { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes qRing3 { from { transform: rotate(20deg);  } to { transform: rotate(380deg);  } }
        /* -- CTA section -- */
        @keyframes ctaRingPulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.8); opacity: 0;   }
        }
        @keyframes wordDrift {
          0%   { transform: translateY(0)   rotate(0deg);   opacity: 0;    }
          10%  { opacity: 0.07; }
          90%  { opacity: 0.05; }
          100% { transform: translateY(-80px) rotate(8deg); opacity: 0;   }
        }
        @keyframes stepReveal {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes connectorGrow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes badgePop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes meshPan {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        /* -- Stats section -- */
        @keyframes statCardIn {
          from { opacity:0; transform: translateY(32px) scale(0.95); }
          to   { opacity:1; transform: translateY(0)    scale(1);    }
        }
        @keyframes statGlow {
          0%,100% { box-shadow: 0 0 18px var(--sg,#7FCAB5)22; }
          50%     { box-shadow: 0 0 42px var(--sg,#7FCAB5)55, 0 0 80px var(--sg,#7FCAB5)18; }
        }
        @keyframes statScanLine {
          0%   { top: -4px;   opacity:0; }
          10%  { opacity:0.7; }
          90%  { opacity:0.4; }
          100% { top: 100%;   opacity:0; }
        }
        @keyframes statBadgePulse {
          0%,100% { opacity:0.7; transform:scale(1);   }
          50%     { opacity:1;   transform:scale(1.06); }
        }
        @keyframes statDotBlink {
          0%,100% { opacity:1;   }
          50%     { opacity:0.2; }
        }
        /* -- WHY RADAI section -- */
        @keyframes featCardIn {
          from { opacity:0; transform: translateY(36px) scale(0.96); }
          to   { opacity:1; transform: translateY(0)    scale(1);    }
        }
        @keyframes featLineGrow {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        @keyframes featIconSpin {
          0%   { transform: rotate(0deg)   scale(1);    }
          50%  { transform: rotate(8deg)   scale(1.08); }
          100% { transform: rotate(0deg)   scale(1);    }
        }
        @keyframes tagSlide {
          from { opacity:0; transform: translateX(-8px); }
          to   { opacity:1; transform: translateX(0);    }
        }
        @keyframes highlightPulse {
          0%,100% { box-shadow: 0 0 0 0 transparent; }
          50%     { box-shadow: 0 0 12px 2px var(--hc,#7FCAB5)44; }
        }
        /* -- Abu Dhabi Market section -- */
        @keyframes mktCardIn {
          from { opacity:0; transform: translateX(-24px); }
          to   { opacity:1; transform: translateX(0);     }
        }
        @keyframes dashIn {
          from { opacity:0; transform: translateX(24px); }
          to   { opacity:1; transform: translateX(0);    }
        }
        @keyframes barrelCount {
          0%   { opacity:0; transform: scale(0.8); }
          100% { opacity:1; transform: scale(1);   }
        }
        @keyframes pipelineFlow {
          0%   { transform: translateX(-100%); opacity:0.6; }
          100% { transform: translateX(400%);  opacity:0;   }
        }
      `}</style>

      <div className="min-h-screen overflow-x-hidden" style={{ background: '#f9fafb' }}>

        {/* NAVIGATION */}
        <nav className="fixed w-full top-0 z-50 transition-all duration-500"
          style={{
            background: scrolled ? 'rgba(43,58,85,0.97)' : 'rgba(43,58,85,0.8)',
            backdropFilter: 'blur(16px)',
            borderBottom: scrolled ? '1px solid rgba(127,202,181,0.2)' : '1px solid transparent',
          }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16 lg:h-20">
              {/* Logo */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-xl blur-sm opacity-60" style={{ background: 'linear-gradient(135deg,#7FCAB5,#2AA784)' }} />
                  <div className="relative bg-white rounded-xl p-1.5 shadow-lg">
                    <img src={getLogoPath()} alt={LOGO_CONFIG.primary.alt}
                      className="h-8 lg:h-10 w-auto" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
                      onError={e => { e.target.style.display='none' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl lg:text-2xl font-black gradient-text-animated">RADAI</span>
                    <span className="hidden sm:inline text-[9px] font-bold text-white px-2 py-0.5 rounded-full"
                      style={{ background: 'linear-gradient(135deg,#7FCAB5,#2AA784)' }}>AI-POWERED</span>
                  </div>
                  <div className="text-[9px] lg:text-[10px] text-gray-400 font-medium">by Rejlers Engineering Solutions</div>
                </div>
              </div>

              {/* Desktop nav links */}
              <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
                <PWAInstallButton />
                {navItems.map(item => (
                  <Link 
                    key={item.id} 
                    to={item.path}
                    className={`${NAV_STYLES.desktop.linkBase} ${NAV_STYLES.desktop.linkHover} ${activeItem?.id === item.id ? NAV_STYLES.desktop.linkActive : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link to="/login"
                  className="px-5 py-2 rounded-full text-sm font-bold text-white transition-all duration-300 hover:scale-105 glow-btn"
                  style={{ background: 'linear-gradient(135deg,#2AA784,#7FCAB5)' }}>
                  Sign In &rarr;
                </Link>
              </div>

              {/* Mobile menu toggle */}
              <button className="md:hidden text-gray-300 hover:text-white p-2" onClick={() => setMobileOpen(o => !o)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
                </svg>
              </button>
            </div>

            {/* Mobile drawer */}
            {mobileOpen && (
              <div className="md:hidden pb-4 border-t border-gray-700/50 pt-3 space-y-2">
                <PWAInstallButton mobile onClose={() => setMobileOpen(false)} />
                {mobileNavItems.map(item => (
                  <Link 
                    key={item.id} 
                    to={item.path} 
                    onClick={() => setMobileOpen(false)}
                    className={`${NAV_STYLES.mobile.linkBase} ${activeItem?.id === item.id ? NAV_STYLES.mobile.linkActive : ''}`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link to="/login" onClick={() => setMobileOpen(false)}
                  className="block text-center mt-2 px-5 py-2 rounded-full text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#2AA784,#7FCAB5)' }}>
                  Sign In &rarr;
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* HERO SECTION */}
        <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
          {/* Deep space gradient background */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(127,202,181,0.2) 0%, rgba(43,58,85,0) 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(97,122,173,0.15) 0%, rgba(43,58,85,0) 70%), #2B3A55'
          }}/>

          {/* Animated grid */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(rgba(127,202,181,1) 1px, transparent 1px), linear-gradient(90deg, rgba(127,202,181,1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}/>

          {/* Floating particles */}
          {particles.map(p => (
            <Particle key={p.id} style={{
              width: p.width, height: p.width,
              top: `${p.top}%`, left: `${p.left}%`,
              opacity: p.opacity, backgroundColor: p.color,
              animation: `floatUp ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}/>
          ))}

          {/* Scan-line effect overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="scan-line absolute w-full h-0.5 opacity-20"
              style={{ background: 'linear-gradient(90deg,transparent,#7FCAB5,transparent)', top: 0 }}/>
          </div>

      {/* SVG pipeline decoration - right side */}
          <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none hidden lg:block">
            {/* -- AI Neural Network visualisation -- */}
            <svg viewBox="0 0 500 700" className="absolute right-0 top-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="cGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#2AA784" stopOpacity="0.35"/>
                  <stop offset="100%" stopColor="#2AA784" stopOpacity="0"/>
                </radialGradient>
                <filter id="nGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* Orbit rings */}
              <circle cx="250" cy="270" r="168" fill="none" stroke="#7FCAB5" strokeWidth="0.5"
                strokeDasharray="6 9" opacity="0.15"
                style={{transformBox:'fill-box',transformOrigin:'center',animation:'hexRing 32s linear infinite'}}/>
              <circle cx="250" cy="270" r="112" fill="none" stroke="#2AA784" strokeWidth="0.5"
                strokeDasharray="4 7" opacity="0.1"
                style={{transformBox:'fill-box',transformOrigin:'center',animation:'innerRing 22s linear infinite'}}/>
              <circle cx="250" cy="270" r="55"  fill="none" stroke="#73BDC8" strokeWidth="0.4"
                strokeDasharray="3 5" opacity="0.08"
                style={{transformBox:'fill-box',transformOrigin:'center',animation:'hexRing 14s linear infinite'}}/>

              {/* Edges: center ? each node */}
              {[
                ['M250,270 L390,270','#7FCAB5','0s'],
                ['M250,270 L320,153','#0ea5e9','0.7s'],
                ['M250,270 L180,153','#f59e0b','1.4s'],
                ['M250,270 L110,270','#a78bfa','2.1s'],
                ['M250,270 L180,387','#2AA784','2.8s'],
                ['M250,270 L320,387','#73BDC8','3.5s'],
              ].map(([d,col,del],i) => (
                <path key={i} d={d} fill="none" stroke={col} strokeWidth="1"
                  strokeDasharray="180" opacity="0.42"
                  style={{animation:`aiEdge 5s ease-in-out ${del} infinite`}}/>
              ))}

              {/* Ring edges between nodes */}
              {[
                ['M390,270 L320,153','#7FCAB5','0.4s'],
                ['M320,153 L180,153','#0ea5e9','1.1s'],
                ['M180,153 L110,270','#f59e0b','1.8s'],
                ['M110,270 L180,387','#a78bfa','2.5s'],
                ['M180,387 L320,387','#2AA784','3.2s'],
                ['M320,387 L390,270','#73BDC8','3.9s'],
              ].map(([d,col,del],i) => (
                <path key={i+10} d={d} fill="none" stroke={col} strokeWidth="0.5"
                  strokeDasharray="180" opacity="0.2"
                  style={{animation:`aiEdge 7s ease-in-out ${del} infinite`}}/>
              ))}

              {/* Data-flow particles (animateMotion along edges) */}
              {[
                {path:'M250,270 L390,270',col:'#7FCAB5',dur:'2.4s',begin:'0s'},
                {path:'M250,270 L320,153',col:'#0ea5e9',dur:'2.8s',begin:'0.6s'},
                {path:'M250,270 L180,153',col:'#f59e0b',dur:'3.1s',begin:'1.2s'},
                {path:'M250,270 L110,270',col:'#a78bfa',dur:'2.6s',begin:'1.8s'},
                {path:'M250,270 L180,387',col:'#2AA784',dur:'3.3s',begin:'2.4s'},
                {path:'M250,270 L320,387',col:'#73BDC8',dur:'2.9s',begin:'3s'},
              ].map((e,i) => (
                <circle key={i+20} r="2.5" fill={e.col} opacity="0.9" filter="url(#nGlow)">
                  <animateMotion dur={e.dur} repeatCount="indefinite" begin={e.begin} path={e.path}/>
                </circle>
              ))}

              {/* Center glow + RADAI orb */}
              <circle cx="250" cy="270" r="52" fill="url(#cGlow)"/>
              <circle cx="250" cy="270" r="30" fill="rgba(42,167,132,0.1)" stroke="#2AA784"
                strokeWidth="1.5" filter="url(#nGlow)"
                style={{animation:'aiNode 2.8s ease-in-out infinite'}}/>
              <text x="250" y="266" textAnchor="middle" fill="#7FCAB5"
                fontSize="10" fontWeight="900" fontFamily="monospace">RADAI</text>
              <text x="250" y="279" textAnchor="middle" fill="#2AA784"
                fontSize="6.5" fontFamily="monospace" opacity="0.65">AI ENGINE</text>

              {/* Main nodes */}
              {[
                {x:390,y:270,label:'Gemini',  col:'#7FCAB5',nd:'0s',  rd:'0s'  },
                {x:320,y:153,label:'GPT-4o',  col:'#0ea5e9',nd:'0.5s',rd:'1.2s'},
                {x:180,y:153,label:'ADNOC',   col:'#f59e0b',nd:'1s',  rd:'2.4s'},
                {x:110,y:270,label:'ISA-5.1', col:'#a78bfa',nd:'1.5s',rd:'3.6s'},
                {x:180,y:387,label:'API-520', col:'#2AA784',nd:'2s',  rd:'4.8s'},
                {x:320,y:387,label:'QHSE',    col:'#73BDC8',nd:'2.5s',rd:'6s'  },
              ].map((n,i) => (
                <g key={i+30} filter="url(#nGlow)">
                  <circle cx={n.x} cy={n.y} r="7" fill="none" stroke={n.col} strokeWidth="1"
                    style={{animation:`aiRipple 3.5s ease-out ${n.rd} infinite`}}/>
                  <circle cx={n.x} cy={n.y} r="7" fill={n.col} fillOpacity="0.1"
                    stroke={n.col} strokeWidth="1.5"
                    style={{animation:`aiNode 3s ease-in-out ${n.nd} infinite`}}/>
                  <text x={n.x} y={n.y-13} textAnchor="middle" fill={n.col}
                    fontSize="8.5" fontWeight="700" fontFamily="monospace" opacity="0.85">{n.label}</text>
                </g>
              ))}

              {/* P&ID schematic fragment */}
              <g transform="translate(95,478)" opacity="0.14">
                <line x1="0"   y1="38" x2="310" y2="38" stroke="#7FCAB5" strokeWidth="2"/>
                <line x1="55"  y1="18" x2="55"  y2="58" stroke="#7FCAB5" strokeWidth="1.5"/>
                <polygon points="40,18 70,18 55,38"  fill="none" stroke="#7FCAB5" strokeWidth="1"/>
                <polygon points="40,58 70,58 55,38"  fill="none" stroke="#7FCAB5" strokeWidth="1"/>
                <circle cx="160" cy="38" r="13" fill="none" stroke="#2AA784" strokeWidth="1.5"/>
                <text x="160" y="42" textAnchor="middle" fill="#2AA784" fontSize="8" fontFamily="monospace">PT</text>
                <line x1="160" y1="25" x2="160" y2="5"  stroke="#2AA784" strokeWidth="1" strokeDasharray="3 2"/>
                <rect x="133"  y="-14" width="54" height="18" fill="none" stroke="#2AA784" strokeWidth="1" rx="2"/>
                <text x="160" y="-2" textAnchor="middle" fill="#2AA784" fontSize="7" fontFamily="monospace">PIC-101</text>
                <line x1="250" y1="18" x2="250" y2="58" stroke="#73BDC8" strokeWidth="1.5"/>
                <polygon points="235,18 265,18 250,38" fill="none" stroke="#73BDC8" strokeWidth="1"/>
                <polygon points="235,58 265,58 250,38" fill="none" stroke="#73BDC8" strokeWidth="1"/>
                <text x="28"  y="68" fill="#7FCAB5" fontSize="6.5" fontFamily="monospace" opacity="0.6">6-P-1001-A3B</text>
                <text x="220" y="68" fill="#73BDC8" fontSize="6.5" fontFamily="monospace" opacity="0.6">FV-2001</text>
              </g>

              {/* Scrolling data labels on right edge */}
              {['GPT-4o','99.2%','ADNOC','P&ID','ISA-5','0xA3B2','QHSE','AI'].map((t,i) => (
                <text key={i+40} x="492" y={55+i*58} textAnchor="end"
                  fill={['#7FCAB5','#0ea5e9','#f59e0b','#a78bfa'][i%4]}
                  fontSize="6.5" fontFamily="monospace" opacity="0"
                  style={{animation:`dataStreamFall ${7+i}s ease-in-out ${i*0.9}s infinite`}}>
                  {t}
                </text>
              ))}
            </svg>
          </div>

          {/* Floating AI keyword tokens drifting upward */}
          {LANDING_CONFIG.heroTokens.map((tok, i) => (
            <span key={tok} className="absolute hidden lg:block text-[9px] font-mono font-bold px-2 py-0.5 rounded-full pointer-events-none z-10"
              style={{
                left: `${5 + i * 8}%`,
                bottom: `${10 + (i % 4) * 7}%`,
                color: ['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#73BDC8','#2AA784'][i % 6],
                border: '1px solid currentColor',
                background: 'rgba(43,58,85,0.55)',
                backdropFilter: 'blur(4px)',
                opacity: 0,
                animation: `tokenRise ${5 + (i % 4)}s ease-out ${i * 0.65}s infinite`,
              }}
            >{tok}</span>
          ))}

          {/* Hero content */}
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-4xl">
              {/* Badge */}
              <div className="hero-animate inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6 lg:mb-8"
                style={{ borderColor: 'rgba(127,202,181,0.4)', background: 'rgba(127,202,181,0.06)', backdropFilter: 'blur(8px)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7FCAB5' }}/>
                <span className="text-xs lg:text-sm font-semibold text-gray-300">
                  Built for Abu Dhabi's Oil &amp; Gas Industry - Powered by GPT-4o + Gemini 2.0
                </span>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#2AA784', animationDelay: '0.5s' }}/>
              </div>

              {/* Main headline - glitch + scan beam + Abu Dhabi glow */}
              <div className="hero-animate-d1 relative">
                {/* Scan beam sweeping across headline */}
                <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
                  <div style={{
                    position:'absolute', top:0, bottom:0, width:'40%',
                    background:'linear-gradient(90deg,transparent,rgba(127,202,181,0.07),rgba(42,167,132,0.12),rgba(127,202,181,0.07),transparent)',
                    animation:'scanBeam 5.5s ease-in-out 2s infinite',
                  }}/>
                </div>
                <h1 className="font-black leading-[1.1] mb-6 relative" style={{zIndex:1}}>
                  <span className="block text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-2">
                    The Future of
                  </span>
                  {/* "Engineering AI" with RGB glitch layers */}
                  <span className="block relative text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-2" style={{fontWeight:900}}>
                    <span className="gradient-text-animated">Engineering AI</span>
                    {/* Glitch layer A - cyan offset */}
                    <span aria-hidden="true" style={{
                      position:'absolute', inset:0, display:'block', fontWeight:900,
                      background:'linear-gradient(90deg,#73BDC8,#7FCAB5,#0ea5e9)',
                      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                      animation:'glitchShiftA 9s ease-in-out 1s infinite',
                      userSelect:'none', pointerEvents:'none',
                    }}>Engineering AI</span>
                    {/* Glitch layer B - green offset */}
                    <span aria-hidden="true" style={{
                      position:'absolute', inset:0, display:'block', fontWeight:900,
                      background:'linear-gradient(90deg,#2AA784,#617AAD,#7FCAB5)',
                      WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
                      animation:'glitchShiftB 9s ease-in-out 1.08s infinite',
                      userSelect:'none', pointerEvents:'none',
                    }}>Engineering AI</span>
                  </span>
                  <span className="block text-gray-300 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-semibold">
                    is here - in{' '}
                    <span style={{color:'#7FCAB5', display:'inline-block', animation:'abGlow 3.5s ease-in-out 3s infinite'}}>
                      Abu Dhabi
                    </span>
                  </span>
                </h1>
              </div>

              {/* Typewriter */}
              <div className="hero-animate-d2 text-lg sm:text-xl lg:text-2xl font-semibold text-gray-400 mb-6 h-8">
                AI-Powered:&nbsp;
                <TypeWriter
                  strings={LANDING_CONFIG.typewriterStrings}
                  speed={LANDING_CONFIG.typewriterSpeed}
                  pause={LANDING_CONFIG.typewriterPause}
                />
              </div>

              {/* Description */}
              <p className="hero-animate-d3 text-base lg:text-lg text-gray-400 leading-relaxed mb-8 max-w-2xl">
                RADAI is Rejlers' flagship AI engineering platform - purpose-built for Abu Dhabi's
                upstream &amp; downstream oil and gas sector. Real-time P&amp;ID verification,
                ADNOC-aligned compliance, and intelligent automation that makes senior engineers
                faster without replacing their judgment.
              </p>

              {/* CTA buttons */}
              <div className="hero-animate-d4 flex flex-col sm:flex-row gap-4">
                <Link to="/register"
                  className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-bold text-base transition-all duration-300 hover:scale-105 glow-btn"
                  style={{ background: 'linear-gradient(135deg,#2AA784,#7FCAB5,#0ea5e9)', backgroundSize: '200%' }}>
                  <span>Start Free Trial</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12"/>
                  </svg>
                </Link>
                <Link to="/engineering/process/pid-verification"
                  className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(127,202,181,0.35)', color: '#7FCAB5', backdropFilter: 'blur(8px)' }}>
                  <span>Analyse a P&amp;ID</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </Link>
              </div>

              {/* Trust strip */}
              <div className="hero-animate-d4 mt-10 flex flex-wrap gap-3">
                {['ISO 27001','ADNOC Standards','API / ISA / ASME','IEC 61511','Abu Dhabi Based'].map(tag => (
                  <span key={tag} className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5"
                    style={{ background: 'rgba(127,202,181,0.1)', border: '1px solid rgba(127,202,181,0.25)', color: '#7FCAB5' }}>
                    <span aria-hidden="true">✓</span>{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
            <span className="text-gray-400 text-xs font-medium tracking-widest uppercase">Scroll</span>
            <div className="w-5 h-8 rounded-full border border-gray-600 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 bg-gray-400 rounded-full animate-bounce"/>
            </div>
          </div>
        </section>

        {/* WHY RADAI */}
        <section className="py-20 lg:py-28 relative overflow-hidden" style={{ background: '#ffffff' }}>

          {/* Subtle dot-grid texture (white bg preserved) */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(43,58,85,0.06) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}/>

          {/* Soft colour blobs */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(127,202,181,0.10) 0%, transparent 70%)' }}/>
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(43,58,85,0.07) 0%, transparent 70%)' }}/>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

            {/* Header */}
            <RevealSection className="text-center mb-16">
              <span className="inline-block text-[10px] font-bold tracking-[0.22em] uppercase px-4 py-1.5 rounded-full mb-5"
                style={{ color:'#2AA784', background:'rgba(42,167,132,0.08)', border:'1px solid rgba(42,167,132,0.22)' }}>
                {LANDING_CONFIG.whyRadai.sectionLabel}
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#2B3A55] mb-4 leading-tight">
                {LANDING_CONFIG.whyRadai.headline}{' '}
                <span className="gradient-text-animated">{LANDING_CONFIG.whyRadai.headlineGrad}</span>
              </h2>
              <p className="text-gray-500 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
                {LANDING_CONFIG.whyRadai.sub}
              </p>
            </RevealSection>

            {/* Feature cards grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {LANDING_CONFIG.abuDhabiFeatures.map((feat, i) => (
                <RevealSection key={feat.title} delay={i * 0.09}>
                  <div
                    className="group relative h-full rounded-2xl cursor-default overflow-hidden"
                    style={{
                      background: '#ffffff',
                      border: `1px solid rgba(43,58,85,0.08)`,
                      boxShadow: '0 2px 16px rgba(43,58,85,0.06)',
                      animation: `featCardIn 0.55s cubic-bezier(.4,0,.2,1) ${0.12 + i * 0.1}s both`,
                      transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.3s',
                      '--hc': feat.color,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${feat.color}55`
                      e.currentTarget.style.boxShadow = `0 8px 40px ${feat.color}22, 0 2px 16px rgba(43,58,85,0.08)`
                      e.currentTarget.style.transform = 'translateY(-4px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(43,58,85,0.08)'
                      e.currentTarget.style.boxShadow = '0 2px 16px rgba(43,58,85,0.06)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}>

                    {/* Coloured top accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
                      style={{ background: `linear-gradient(90deg,${feat.color},${feat.color}44)` }}/>

                    {/* Left accent line */}
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl origin-top"
                      style={{
                        background: `linear-gradient(180deg,${feat.color},${feat.color}22)`,
                        animation: `featLineGrow 0.7s cubic-bezier(.4,0,.2,1) ${0.3 + i * 0.1}s both`,
                      }}/>

                    <div className="p-6 pl-7">

                      {/* Icon + highlight badge row */}
                      <div className="flex items-start justify-between mb-5">
                        <div
                          className="w-13 h-13 w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm"
                          style={{
                            background: `${feat.color}14`,
                            border: `1.5px solid ${feat.color}44`,
                            color: feat.color,
                            animation: `featIconSpin 4s ease-in-out ${i * 0.6}s infinite`,
                          }}>
                          {feat.icon}
                        </div>
                        {feat.highlight && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              color: feat.color,
                              background: `${feat.color}12`,
                              border: `1px solid ${feat.color}33`,
                              animation: `highlightPulse 3s ease-in-out ${i * 0.5}s infinite`,
                            }}>
                            {feat.highlight}
                          </span>
                        )}
                      </div>

                      {/* Title + desc */}
                      <h3 className="text-[#2B3A55] font-black text-base mb-2 leading-snug">{feat.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed mb-4">{feat.desc}</p>

                      {/* Tag chips */}
                      {feat.tags && (
                        <div className="flex flex-wrap gap-1.5">
                          {feat.tags.map((tag, ti) => (
                            <span key={tag}
                              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                color: feat.color,
                                background: `${feat.color}0e`,
                                border: `1px solid ${feat.color}28`,
                                animation: `tagSlide 0.4s ease ${0.5 + i * 0.08 + ti * 0.06}s both`,
                              }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </RevealSection>
              ))}
            </div>

          </div>
        </section>

        {/* PRODUCT MODULES */}
        {LANDING_CONFIG.showProductModules && (
        <section className="py-20 lg:py-28" style={{ background: '#f3f7fa' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <RevealSection className="text-center mb-14">
              <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: '#2AA784' }}>
                PRODUCT SUITE
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#2B3A55] mb-4">
                Everything Your{' '}
                <span className="gradient-text-animated">Engineering Team</span> Needs
              </h2>
              <p className="text-gray-600 text-base lg:text-lg max-w-2xl mx-auto">
                One unified platform covering P&amp;ID, PFD, QHSE, Finance, Sales, and Project
                Management - all connected, all AI-powered.
              </p>
            </RevealSection>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {(MODULES_CONFIG.modules || []).map((mod, i) => {
                const gradients = [
                  'linear-gradient(135deg,#2AA784,#7FCAB5)',
                  'linear-gradient(135deg,#0ea5e9,#38bdf8)',
                  'linear-gradient(135deg,#8b5cf6,#a78bfa)',
                  'linear-gradient(135deg,#f59e0b,#fbbf24)',
                  'linear-gradient(135deg,#10b981,#34d399)',
                  'linear-gradient(135deg,#f43f5e,#fb7185)',
                  'linear-gradient(135deg,#6366f1,#818cf8)',
                  'linear-gradient(135deg,#14b8a6,#2dd4bf)',
                  'linear-gradient(135deg,#f97316,#fb923c)',
                ]
                return (
                  <RevealSection key={mod.title || i} delay={i * 0.06} className="module-card">
                    <Link to={mod.route || '#'}
                      className="group flex flex-col h-full p-5 rounded-2xl transition-all duration-350 hover:-translate-y-2 hover:shadow-lg shadow-sm"
                      style={{ background: '#ffffff', border: '1px solid rgba(43,58,85,0.1)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(127,202,181,0.5)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(43,58,85,0.1)'}>
                      <div className="module-icon w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 flex-shrink-0"
                        style={{ background: gradients[i % gradients.length] }}>
                        {mod.icon || '+'}
                      </div>
                      <h3 className="text-[#2B3A55] font-bold text-base mb-2 group-hover:text-[#2AA784] transition-colors">
                        {mod.title}
                      </h3>
                      <p className="text-gray-600 text-xs leading-relaxed mb-3 flex-1">{mod.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-auto">
                        {Object.entries(mod.stats || {}).map(([k, v]) => (
                          <span key={k} className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(127,202,181,0.1)', color: '#7FCAB5', border: '1px solid rgba(127,202,181,0.45)', backdropFilter: 'blur(8px)' }}>
                            {v}
                          </span>
                        ))}
                      </div>
                    </Link>
                  </RevealSection>
                )
              })}
            </div>
          </div>
        </section>
        )}

        {/* AI CAPABILITIES */}
        <section className="py-20 lg:py-28 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#0d1c2e,#1a2f45,#0d2a1e)' }}>

          {/* -- Background: animated quantum-grid -- */}
          <div className="absolute inset-0 opacity-[0.035]" style={{
            backgroundImage: 'linear-gradient(rgba(127,202,181,1) 1px, transparent 1px), linear-gradient(90deg,rgba(127,202,181,1) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}/>

          {/* -- Floating quantum particles -- */}
          {[...Array(18)].map((_,i) => {
            const cols = ['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#2AA784','#73BDC8']
            const qx = `${(Math.sin(i*1.7)*90).toFixed(0)}px`
            const qy = `${-(40+i*8)}px`
            return (
              <span key={i} style={{
                position:'absolute',
                left: `${5+i*5}%`,
                bottom: `${8+(i%5)*12}%`,
                width: 4+i%3, height: 4+i%3,
                borderRadius:'50%',
                background: cols[i%6],
                opacity: 0,
                '--qx': qx,
                '--qy': qy,
                animation: `qDrift ${6+i%5}s ease-out ${i*0.55}s infinite`,
                pointerEvents:'none',
              }}/>
            )
          })}

          {/* -- Processing status ticker -- */}
          <div className="absolute top-0 left-0 right-0 overflow-hidden h-7 z-20"
            style={{ background:'rgba(0,0,0,0.35)', borderBottom:'1px solid rgba(127,202,181,0.12)' }}>
            <div className="flex items-center gap-0 whitespace-nowrap text-[9px] font-mono h-full"
              style={{ animation:'tickerSlide 22s linear infinite' }}>
              {[...Array(2)].flatMap((_, groupIdx) =>
                ['? LLM inference active','? SLM clause scan','? ML anomaly check','? Quantum constraint solve','? RAG retrieval','? Evidence linking','? P&ID pass complete','? Standards updated','? ADNOC GSP verified','? NLP extraction done']
                .map((t,i) => (
                  <span key={`ticker-${groupIdx}-${i}`} className="px-6" style={{ color: ['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#2AA784','#73BDC8'][i%6] }}>{t}</span>
                ))
              )}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-8">
            <div className="grid lg:grid-cols-2 gap-14 items-start">

              {/* -- LEFT: label + headline + body + layer stack -- */}
              <RevealSection direction="left">
                <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: '#7FCAB5' }}>
                  {LANDING_CONFIG.aiEngine.sectionLabel}
                </span>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 leading-tight">
                  {LANDING_CONFIG.aiEngine.headline}{' '}
                  <span className="gradient-text-animated">{LANDING_CONFIG.aiEngine.headlineGrad}</span>
                </h2>
                <p className="text-gray-400 text-sm lg:text-base leading-relaxed mb-8" style={{maxWidth:'48ch'}}>
                  {LANDING_CONFIG.aiEngine.body}
                </p>

                {/* Layer progress stack */}
                <div className="space-y-4">
                  {LANDING_CONFIG.aiEngine.layers.map((layer, i) => (
                    <div key={layer.label} style={{ animation:`layerEnter 0.6s ease ${0.2+i*0.15}s both` }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white tracking-wide">{layer.label}</span>
                        <span className="text-[10px] font-mono" style={{ color: layer.color }}>{layer.desc}</span>
                      </div>
                      <div className="relative h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,0.06)' }}>
                        <div className="absolute left-0 top-0 h-full rounded-full"
                          style={{
                            width: layer.width,
                            background: `linear-gradient(90deg,${layer.color}99,${layer.color})`,
                            boxShadow: `0 0 10px ${layer.color}60`,
                            animation: `barFill 1.4s cubic-bezier(.4,0,.2,1) ${0.5+i*0.2}s both`,
                          }}
                        />
                        {/* Animated shimmer on bar */}
                        <div className="absolute top-0 h-full w-1/3 rounded-full pointer-events-none"
                          style={{
                            background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)',
                            animation:`scanBeam ${3+i}s ease-in-out ${i*0.7}s infinite`,
                          }}/>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mini legend chips */}
                <div className="flex flex-wrap gap-2 mt-7">
                  {['LLM','SLM','ML','Quantum','RAG','NLP','Computer Vision','ADNOC Rules'].map((c,i) => (
                    <span key={c} className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                      style={{
                        color:   ['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#73BDC8','#2AA784','#7FCAB5','#f59e0b'][i],
                        border:  '1px solid currentColor',
                        background: 'rgba(255,255,255,0.04)',
                      }}>{c}</span>
                  ))}
                </div>
              </RevealSection>

              {/* -- RIGHT: Radar chart + Quantum orb -- */}
              <RevealSection direction="right" className="flex flex-col items-center gap-8">

                {/* Quantum orb */}
                <div className="relative flex items-center justify-center" style={{ width:240, height:240 }}>
                  {/* Three orbital rings */}
                  {[
                    { w:230, h:60,  col:'#7FCAB5', dur:'7s',  anim:'qRing1', op:0.35 },
                    { w:200, h:200, col:'#0ea5e9',  dur:'11s', anim:'qRing2', op:0.25 },
                    { w:60,  h:220, col:'#a78bfa',  dur:'9s',  anim:'qRing3', op:0.3  },
                  ].map((r,i) => (
                    <div key={i} className="absolute rounded-full border pointer-events-none"
                      style={{
                        width:r.w, height:r.h,
                        borderColor: r.col,
                        borderWidth: 1,
                        opacity: r.op,
                        animation: `${r.anim} ${r.dur} linear infinite`,
                        borderStyle: i===1 ? 'dashed' : 'solid',
                      }}/>
                  ))}
                  {/* Core */}
                  <div className="relative z-10 flex flex-col items-center justify-center rounded-full text-center"
                    style={{
                      width:110, height:110,
                      background:'linear-gradient(135deg,#1a3a2e,#0d2a1e)',
                      border:'2px solid rgba(127,202,181,0.45)',
                      animation:'corePulse 3s ease-in-out infinite',
                    }}>
                    <span className="text-[10px] font-mono text-gray-400 tracking-widest">RADAI</span>
                    <span className="gradient-text-animated font-black text-lg">AI Core</span>
                    <span className="text-[9px] font-mono mt-0.5" style={{ color:'#7FCAB5' }}>ACTIVE</span>
                  </div>
                  {/* Orbital dots (model nodes) */}
                  {[
                    { label:'LLM',     col:'#7FCAB5', angle:0   },
                    { label:'SLM',     col:'#0ea5e9',  angle:60  },
                    { label:'ML',      col:'#a78bfa',  angle:120 },
                    { label:'Quantum', col:'#f59e0b',  angle:180 },
                    { label:'RAG',     col:'#73BDC8',  angle:240 },
                    { label:'NLP',     col:'#2AA784',  angle:300 },
                  ].map((node,i) => {
                    const rad = node.angle * Math.PI / 180
                    const r   = 108
                    const x   = Math.round(120 + r * Math.cos(rad))
                    const y   = Math.round(120 + r * Math.sin(rad))
                    return (
                      <div key={node.label}
                        className="absolute flex flex-col items-center"
                        style={{ left:x-20, top:y-16, width:40, pointerEvents:'none' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[7px] text-white mb-0.5"
                          style={{
                            background: `${node.col}22`,
                            border: `1.5px solid ${node.col}`,
                            boxShadow: `0 0 8px ${node.col}55`,
                            animation: `aiNode ${2+i*0.4}s ease-in-out ${i*0.3}s infinite`,
                          }}>{node.label[0]}</div>
                        <span className="text-[8px] font-mono" style={{ color:node.col }}>{node.label}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Radar / spider chart */}
                <div style={{ width:'100%', maxWidth:340 }}>
                  <p className="text-center text-[9px] font-mono tracking-widest mb-3" style={{ color:'#7FCAB5', opacity:.7 }}>
                    MODEL PERFORMANCE RADAR
                  </p>
                  {(() => {
                    const cfg = LANDING_CONFIG.aiEngine.radar
                    const N   = cfg.length
                    const CX  = 170, CY = 150, R = 120
                    const axPts = cfg.map((_,i) => {
                      const a = (i / N) * 2 * Math.PI - Math.PI/2
                      return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
                    })
                    const valPts = cfg.map((d,i) => {
                      const a = (i / N) * 2 * Math.PI - Math.PI/2
                      return { x: CX + R * d.value * Math.cos(a), y: CY + R * d.value * Math.sin(a) }
                    })
                    const gridPoly = (frac) =>
                      cfg.map((_,i) => {
                        const a = (i/N)*2*Math.PI - Math.PI/2
                        return `${CX+R*frac*Math.cos(a)},${CY+R*frac*Math.sin(a)}`
                      }).join(' ')
                    const valPoly  = valPts.map(p => `${p.x},${p.y}`).join(' ')
                    const perimLen = 900
                    return (
                      <svg viewBox="0 0 340 300" className="w-full" xmlns="http://www.w3.org/2000/svg">
                        {/* Background grid rings */}
                        {[0.25,0.5,0.75,1].map((f,i) => (
                          <polygon key={i} points={gridPoly(f)} fill="none"
                            stroke="rgba(127,202,181,0.12)" strokeWidth="0.8"/>
                        ))}
                        {/* Spokes */}
                        {axPts.map((p,i) => (
                          <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y}
                            stroke="rgba(127,202,181,0.18)" strokeWidth="0.8"/>
                        ))}
                        {/* Value polygon - animated draw */}
                        <polygon points={valPoly}
                          fill="rgba(127,202,181,0.1)"
                          stroke="#7FCAB5" strokeWidth="1.8"
                          strokeDasharray={perimLen}
                          style={{ animation:`radarDraw 2.2s cubic-bezier(.4,0,.2,1) 0.8s both` }}/>
                        {/* Vertex dots */}
                        {valPts.map((p,i) => (
                          <circle key={i} cx={p.x} cy={p.y} r="4"
                            fill={['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#73BDC8','#2AA784'][i]}
                            style={{ animation:`aiNode ${2+i*0.35}s ease-in-out ${i*0.25}s infinite` }}/>
                        ))}
                        {/* Axis labels */}
                        {axPts.map((p,i) => {
                          const lx = CX + (R+22)*Math.cos((i/N)*2*Math.PI - Math.PI/2)
                          const ly = CY + (R+22)*Math.sin((i/N)*2*Math.PI - Math.PI/2)
                          return (
                            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                              fill={['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#73BDC8','#2AA784'][i]}
                              fontSize="8" fontFamily="monospace" fontWeight="700"
                              style={{ animation:`axPulse ${2.5+i*0.3}s ease-in-out ${i*0.2}s infinite` }}>
                              {cfg[i].axis}
                            </text>
                          )
                        })}
                        {/* Centre label */}
                        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
                          fill="rgba(127,202,181,0.35)" fontSize="7" fontFamily="monospace">RADAI</text>
                      </svg>
                    )
                  })()}
                </div>
              </RevealSection>

            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 lg:py-32 relative overflow-hidden"
          style={{ background: 'linear-gradient(160deg,#0a1628 0%,#0d2a1e 50%,#0a1628 100%)' }}>

          {/* -- Animated mesh grid background -- */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(127,202,181,1) 1px,transparent 1px),linear-gradient(90deg,rgba(127,202,181,1) 1px,transparent 1px)',
              backgroundSize: '40px 40px',
              animation: 'meshPan 8s linear infinite',
            }}/>

          {/* -- Deep radial glow -- */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(42,167,132,0.14) 0%, rgba(43,58,85,0.08) 50%, transparent 80%)' }}/>

          {/* -- Floating background words -- */}
          {LANDING_CONFIG.cta.bgWords.map((word, i) => (
            <span key={word} className="absolute font-black select-none pointer-events-none"
              style={{
                left:   `${4 + (i * 8.1) % 90}%`,
                top:    `${5 + (i * 13.7) % 85}%`,
                fontSize: `${13 + i % 3 * 5}px`,
                color:  ['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#73BDC8','#2AA784'][i % 6],
                opacity: 0,
                letterSpacing: '0.08em',
                animation: `wordDrift ${9 + i % 5}s ease-in-out ${i * 0.7}s infinite`,
              }}>{word}</span>
          ))}

          {/* -- Pulse rings behind main button (rendered as absolute overlay, z under content) -- */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 1 }}>
            {[0, 0.9, 1.8].map((delay, i) => (
              <div key={i} className="absolute rounded-full border"
                style={{
                  width: 260, height: 260,
                  marginLeft: -130, marginTop: -130,
                  borderColor: 'rgba(127,202,181,0.25)',
                  borderWidth: 1,
                  animation: `ctaRingPulse 3s ease-out ${delay}s infinite`,
                }}/>
            ))}
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative" style={{ zIndex: 10 }}>
            <RevealSection>

              {/* Section badge */}
              <div className="inline-block mb-6" style={{ animation: 'badgePop 0.7s cubic-bezier(.4,0,.2,1) 0.2s both' }}>
                <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full"
                  style={{
                    color: '#7FCAB5',
                    background: 'rgba(127,202,181,0.08)',
                    border: '1px solid rgba(127,202,181,0.3)',
                    letterSpacing: '0.18em',
                  }}>
                  {LANDING_CONFIG.cta.sectionLabel}
                </span>
              </div>

              {/* Headline */}
              <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-6 leading-tight">
                {LANDING_CONFIG.cta.headline}<br/>
                <span className="gradient-text-animated">{LANDING_CONFIG.cta.headlineGrad}</span>
              </h2>

              {/* Sub-copy */}
              <p className="text-gray-400 text-base lg:text-lg mb-12 max-w-2xl mx-auto leading-relaxed">
                {LANDING_CONFIG.cta.body}
              </p>

              {/* 3-step onboarding flow */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 mb-14 relative max-w-3xl mx-auto">

                {/* Connector lines (desktop only) */}
                <div className="hidden sm:block absolute top-8 left-1/3 right-1/3 h-px pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, rgba(127,202,181,0.4), rgba(14,165,233,0.4))',
                    animation: 'connectorGrow 1.2s cubic-bezier(.4,0,.2,1) 0.6s both',
                    transformOrigin: 'left',
                  }}/>

                {LANDING_CONFIG.cta.steps.map((step, i) => (
                  <div key={step.num} className="flex flex-col items-center px-4"
                    style={{ animation: `stepReveal 0.6s cubic-bezier(.4,0,.2,1) ${0.3 + i * 0.18}s both` }}>

                    {/* Number orb */}
                    <div className="relative mb-4">
                      <div className="w-16 h-16 rounded-full flex flex-col items-center justify-center font-black"
                        style={{
                          background: `${step.color}14`,
                          border: `2px solid ${step.color}55`,
                          boxShadow: `0 0 20px ${step.color}25`,
                        }}>
                        <span className="text-[10px] font-mono" style={{ color: `${step.color}99` }}>{step.num}</span>
                        <span className="text-lg leading-none" style={{ color: step.color }}>{step.icon}</span>
                      </div>
                      {/* Inner dot pulse */}
                      <div className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          border: `1px solid ${step.color}30`,
                          animation: `ctaRingPulse ${3 + i * 0.5}s ease-out ${i * 1.1}s infinite`,
                        }}/>
                    </div>

                    <div className="text-white font-bold text-sm mb-1">{step.label}</div>
                    <div className="text-gray-500 text-xs leading-relaxed text-center">{step.desc}</div>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex justify-center mb-10">
                <Link to={LANDING_CONFIG.cta.secondaryBtn.to}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105"
                  style={{ background: 'rgba(127,202,181,0.07)', border: '1px solid rgba(127,202,181,0.3)', color: '#7FCAB5' }}>
                  {LANDING_CONFIG.cta.secondaryBtn.label}
                </Link>
              </div>

              {/* Trust pills */}
              <div className="flex flex-wrap justify-center gap-3">
                {LANDING_CONFIG.cta.trustPills.map((pill, i) => (
                  <span key={pill}
                    className="text-[11px] font-medium px-3 py-1 rounded-full flex items-center gap-1.5"
                    style={{
                      color:       ['#7FCAB5','#0ea5e9','#a78bfa','#f59e0b','#73BDC8'][i % 5],
                      background:  'rgba(255,255,255,0.04)',
                      border:      '1px solid rgba(255,255,255,0.08)',
                      animation:   `badgePop 0.5s cubic-bezier(.4,0,.2,1) ${0.8 + i * 0.1}s both`,
                    }}>
                    <span style={{ color: '#7FCAB5' }}>&#10003;</span> {pill}
                  </span>
                ))}
              </div>

            </RevealSection>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: '#243351', borderTop: '1px solid rgba(127,202,181,0.1)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 mb-10">
              {/* Brand */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-xl blur-sm opacity-50" style={{ background: 'linear-gradient(135deg,#7FCAB5,#2AA784)' }}/>
                    <div className="relative bg-white rounded-xl p-1.5">
                      <img src={getLogoPath()} alt="Rejlers Logo" className="h-8 w-auto"
                        onError={e => { e.target.style.display='none' }} />
                    </div>
                  </div>
                  <span className="text-xl font-black gradient-text-animated">RADAI</span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed mb-4 max-w-sm">
                  AI-powered engineering intelligence for Abu Dhabi's oil &amp; gas industry.
                  Built by Rejlers Engineering Solutions.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {['P&ID AI','PFD Verify','QHSE','Finance AI'].map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-1 rounded-full"
                      style={{ background: 'rgba(127,202,181,0.08)', border: '1px solid rgba(127,202,181,0.45)', backdropFilter: 'blur(8px)', color: '#7FCAB5' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="text-white font-bold mb-4">Platform</h4>
                <ul className="space-y-2">
                  {[
                    { label:'P&ID Quality Checker', to:'/engineering/process/pid-verification' },
                    // SOFT-CODED: PFD Verification disabled
                    // { label:'PFD Verification',     to:'/designiq/pfd-verification' },
                    { label:'QHSE Management',      to:'/qhse' },
                    { label:'Sales Intelligence',   to:'/sales' },
                    { label:'Finance Dashboard',    to:'/finance' },
                  ].map(link => (
                    <li key={link.label}>
                      <Link to={link.to} className="text-gray-400 hover:text-[#7FCAB5] text-sm transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Services */}
              <div>
                <h4 className="text-white font-bold mb-4">{FOOTER_CONFIG.services?.title || 'Services'}</h4>
                <ul className="space-y-2">
                  {(FOOTER_CONFIG.services?.items || []).slice(0, 5).map((service, i) => (
                    <li key={i}>
                      <Link to={service.url} className="text-gray-400 hover:text-[#7FCAB5] text-sm transition-colors">
                        {service.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-gray-500 text-xs text-center md:text-left">
                {FOOTER_CONFIG.bottomBar?.copyright || `© ${new Date().getFullYear()} Rejlers Engineering Solutions. All rights reserved.`}
              </p>
              <div className="flex flex-wrap gap-4">
                {(FOOTER_CONFIG.bottomBar?.links || []).map((link, i) => (
                  <React.Fragment key={i}>
                    {link.external
                      ? <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-[#7FCAB5] text-xs transition-colors">{link.label}</a>
                      : <Link to={link.url} className="text-gray-500 hover:text-[#7FCAB5] text-xs transition-colors">{link.label}</Link>
                    }
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* PWA Install Prompt - Floating button for non-nav users */}
      <PWAInstallPrompt />
    </>
  )
}

export default Home

