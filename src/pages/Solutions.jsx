import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  SOLUTION_CATEGORIES,
  SOLUTIONS,
  SOLUTION_STATS,
  SOLUTIONS_CTA,
  REDIRECT_AFTER_LOGIN_KEY,
  getCategoriesWithSolutions,
} from '../config/solutions.config'
import {
  SparklesIcon,
  ArrowRightIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'

/* ─── Brand palette ─────────────────────────────────────────────────────────── */
const B = {
  navy:   '#2B3A55',
  navyDk: '#1c2e48',
  accent: '#617AAD',
  green:  '#2AA784',
  teal:   '#0093A3',
  amber:  '#f59e0b',
  orange: '#f97316',
}

/* ─── Keyframe CSS (injected once) ──────────────────────────────────────────── */
const CSS = `
@keyframes solFadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes solSlideIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
@keyframes solGlow    { 0%,100%{opacity:.25} 50%{opacity:.65} }
@keyframes solScan    { 0%{top:-2px} 100%{top:102%} }
@keyframes solFlow    { 0%{background-position:-200% center} 100%{background-position:200% center} }
@keyframes solPulse   { 0%,100%{opacity:.6} 50%{opacity:1} }
`
function InjectCSS() {
  useEffect(() => {
    const id = 'radai-solutions-css'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = CSS
      document.head.appendChild(s)
    }
    return () => document.getElementById(id)?.remove()
  }, [])
  return null
}

/* ─── Animated number counter ───────────────────────────────────────────────── */
function StatNum({ value }) {
  const [display, setDisplay] = useState('0')
  const ref  = useRef(null)
  const done = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || done.current) return
      done.current = true
      const num = parseFloat(String(value).replace(/[^0-9.]/g, ''))
      const suf = String(value).replace(/[0-9.]/g, '')
      const t0  = performance.now()
      const tick = now => {
        const p    = Math.min((now - t0) / 1400, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        setDisplay(Math.round(num * ease) + suf)
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])
  return <span ref={ref}>{display || value}</span>
}

/* ─── Badge component ───────────────────────────────────────────────────────── */
const BADGE_STYLES = {
  AI:   { bg: 'rgba(97,122,173,.22)',  border: 'rgba(97,122,173,.55)', color: '#8fa8d0', text: '🤖 AI'       },
  NEW:  { bg: 'rgba(42,167,132,.22)',  border: 'rgba(42,167,132,.55)', color: '#4fcfab', text: '✦ NEW'       },
  FULL: { bg: 'rgba(245,158,11,.22)',  border: 'rgba(245,158,11,.55)', color: '#f9c33a', text: '⚡ FULL'      },
  New:  { bg: 'rgba(42,167,132,.15)',  border: 'rgba(42,167,132,.40)', color: '#3db89a', text: 'New'         },
  Beta: { bg: 'rgba(167,139,250,.22)', border: 'rgba(167,139,250,.5)', color: '#b89ef9', text: '🧪 Beta'      },
}
function Bdg({ badge }) {
  const s = BADGE_STYLES[badge]
  if (!s) return null
  return (
    <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.text}
    </span>
  )
}

/* ─── Per-discipline colour palette ────────────────────────────────────────── */
const CAT_COLORS = {
  process:      { from: '#617AAD', to: '#0093A3', glow: 'rgba(97,122,173,.25)'  },
  piping:       { from: '#f97316', to: '#f59e0b', glow: 'rgba(249,115,22,.25)'  },
  instrument:   { from: '#a78bfa', to: '#617AAD', glow: 'rgba(167,139,250,.22)' },
  electrical:   { from: '#f59e0b', to: '#f97316', glow: 'rgba(245,158,11,.22)'  },
  civil:        { from: '#2AA784', to: '#0093A3', glow: 'rgba(42,167,132,.22)'  },
  mechanical:   { from: '#0093A3', to: '#617AAD', glow: 'rgba(0,147,163,.22)'   },
  digitization: { from: '#a78bfa', to: '#f97316', glow: 'rgba(167,139,250,.2)'  },
  documents:    { from: '#2AA784', to: '#14b8a6', glow: 'rgba(42,167,132,.2)'   },
  finance:      { from: '#f59e0b', to: '#2AA784', glow: 'rgba(245,158,11,.18)'  },
  qhse:         { from: '#ef4444', to: '#f97316', glow: 'rgba(239,68,68,.2)'    },
  _default:     { from: '#617AAD', to: '#0093A3', glow: 'rgba(97,122,173,.2)'   },
}
const gc = cat => CAT_COLORS[cat] || CAT_COLORS._default

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
const Solutions = () => {
  const { isAuthenticated } = useSelector(s => s.auth)
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [expanded, setExpanded]           = useState(null)

  /* post-login redirect — stores destination before sending to login page */
  const handleGetStarted = path => {
    sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, path)
    navigate('/login')
  }

  const categories     = useMemo(() => getCategoriesWithSolutions(), [])
  const engineeringCats = useMemo(() => categories.filter(c => c.group === 'engineering'), [categories])

  const filteredSolutions = useMemo(() => {
    return selectedCategory === 'all' ? SOLUTIONS : SOLUTIONS.filter(s => s.category === selectedCategory)
  }, [selectedCategory])

  /* AI spotlight — top 4 AI tools shown above card grid */
  const aiSpotlight = useMemo(() => SOLUTIONS.filter(s => s.isAI).slice(0, 4), [])

  const showSpotlight = selectedCategory === 'all'

  /* ─── render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen text-white"
      style={{ background: `linear-gradient(160deg,${B.navyDk} 0%,${B.navy} 55%,#243550 100%)` }}>
      <InjectCSS />

      {/* ════════════════ HERO ════════════════ */}
      <section className="relative overflow-hidden flex items-center"
        style={{ minHeight: 460, paddingTop: 88, paddingBottom: 64 }}>

        {/* blueprint grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `linear-gradient(rgba(97,122,173,.06) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(97,122,173,.06) 1px,transparent 1px)`,
          backgroundSize: '56px 56px',
        }} />

        {/* ambient glows */}
        <div className="absolute top-0 left-1/4 w-[520px] h-[520px] rounded-full blur-[130px] pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(97,122,173,.18),transparent)', animation: 'solGlow 5s ease-in-out infinite' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(0,147,163,.14),transparent)', animation: 'solGlow 5s ease-in-out infinite 2.5s' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 w-full">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">

            {/* left: headline + live counters */}
            <div style={{ animation: 'solFadeUp .8s ease-out' }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-bold tracking-widest uppercase"
                style={{ background: 'rgba(97,122,173,.12)', border: '1px solid rgba(97,122,173,.3)', color: B.accent }}>
                <SparklesIcon className="w-4 h-4" />
                AI-Powered Engineering Intelligence
              </div>

              <h1 className="font-black leading-tight mb-4"
                style={{ fontSize: 'clamp(2.2rem,5.5vw,4.2rem)' }}>
                <span style={{
                  background: `linear-gradient(135deg,#fff 0%,#d3daea 50%,${B.accent} 100%)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  RADAI Platform
                </span>
                <br />
                <span style={{
                  background: `linear-gradient(135deg,${B.accent},${B.teal})`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>
                  Solutions
                </span>
              </h1>

              <p className="text-base max-w-xl mb-6"
                style={{ color: 'rgba(255,255,255,.5)', lineHeight: 1.75 }}>
                The complete AI-powered engineering platform for Oil & Gas — from P&ID quality
                checks and electrical datasheets to invoice automation and QHSE compliance,
                all in one place. Every feature you add here updates this page automatically.
              </p>

              {/* live mini-counters */}
              <div className="flex flex-wrap gap-6">
                {[
                  { v: SOLUTIONS.length,                                      l: 'Features'    },
                  { v: Object.keys(_getCatsByGroup('engineering')).length,    l: 'Disciplines' },
                  { v: SOLUTIONS.filter(s => s.isAI).length,                 l: 'AI Tools'    },
                ].map(({ v, l }) => (
                  <div key={l} className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black" style={{
                      background: `linear-gradient(135deg,${B.accent},${B.teal})`,
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                    }}>{v}+</span>
                    <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,.45)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════ STATS STRIP ════════════════ */}
      <section className="px-6 pb-10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
          {SOLUTION_STATS.map((st, i) => (
            <div key={st.id} className="text-center"
              style={{
                borderRadius: 16, border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.04)', padding: '20px 16px',
                animation: `solFadeUp .6s ${i * .1}s ease-out both`,
              }}>
              <div className="text-2xl mb-1">{st.icon}</div>
              <div className="text-3xl font-black mb-0.5" style={{
                background: `linear-gradient(135deg,${B.accent},${B.teal})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                <StatNum value={st.value} />
              </div>
              <div className="text-xs font-bold uppercase tracking-wider mb-0.5"
                style={{ color: 'rgba(255,255,255,.7)' }}>{st.label}</div>
              <div className="text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>{st.description}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════ AI SPOTLIGHT ════════════════ */}
      {showSpotlight && (
        <section className="px-6 pb-10">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <CpuChipIcon className="w-4 h-4" style={{ color: B.accent }} />
              <span className="text-xs font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,.5)' }}>
                AI-Powered Highlights
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {aiSpotlight.map((sol, i) => {
                const cs   = gc(sol.category)
                const Icon = sol.icon
                return (
                  <div key={sol.id}
                    className="relative overflow-hidden cursor-pointer group"
                    onClick={() => isAuthenticated ? navigate(sol.link) : handleGetStarted(sol.link)}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${cs.from}33`,
                      background: `linear-gradient(135deg,${cs.from}18,${cs.to}08)`,
                      padding: 16,
                      animation: `solSlideIn .5s ${i * .08}s ease-out both`,
                      transition: 'all .3s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = cs.from + '66'
                      e.currentTarget.style.transform = 'translateY(-3px)'
                      e.currentTarget.style.boxShadow = `0 12px 32px ${cs.glow}`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = cs.from + '33'
                      e.currentTarget.style.transform = ''
                      e.currentTarget.style.boxShadow = ''
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                      style={{ background: `linear-gradient(135deg,${cs.from},${cs.to})` }}>
                      {Icon && <Icon className="w-4 h-4 text-white" />}
                    </div>
                    <p className="text-xs font-black text-white mb-0.5 leading-tight">{sol.title}</p>
                    <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,.42)', lineHeight: 1.4 }}>
                      {sol.disciplineLabel ? `${sol.disciplineLabel} Engineering` : sol.shortDescription.slice(0, 55) + '…'}
                    </p>
                    <div className="flex items-center justify-between">
                      <Bdg badge={sol.badge} />
                      <ArrowRightIcon className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity"
                        style={{ color: cs.from }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════ CATEGORY FILTER TABS ════════════════ */}
      <section className="px-6 pb-8">
        <div className="max-w-6xl mx-auto space-y-3">

          {/* Engineering discipline tabs */}
          {engineeringCats.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: 'rgba(255,255,255,.28)' }}>Engineering</p>
              <div className="flex flex-wrap gap-2">
                {engineeringCats.map(cat => {
                  const active = selectedCategory === cat.id
                  const cs     = gc(cat.id)
                  const Icon   = cat.icon
                  const count  = SOLUTIONS.filter(s => s.category === cat.id).length
                  return (
                    <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-200"
                      style={active
                        ? { background: `linear-gradient(135deg,${cs.from},${cs.to})`, color: '#fff', border: '1px solid transparent', boxShadow: `0 4px 16px ${cs.glow}` }
                        : { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.55)' }}>
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {cat.title}
                      <span className="opacity-55">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ════════════════ CTA BANNER ════════════════ */}
      <section className="relative px-6 py-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg,${B.navyDk},${B.navy},${B.navyDk})` }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px,rgba(97,122,173,.12) 1px,transparent 0)`,
            backgroundSize: '32px 32px',
          }} />
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
          style={{ background: `radial-gradient(circle,${B.accent}28,transparent)`, animation: 'solPulse 3s ease-in-out infinite' }} />
        <div className="absolute top-1/2 right-1/3 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
          style={{ background: `radial-gradient(circle,${B.teal}20,transparent)`, animation: 'solPulse 3s ease-in-out infinite 1.5s' }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(97,122,173,.12)', border: '1px solid rgba(97,122,173,.3)', color: B.accent }}>
            <RocketLaunchIcon className="w-4 h-4" />
            Start Today
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 leading-tight">
            Ready to Transform Your<br />
            <span style={{
              background: `linear-gradient(135deg,${B.accent},${B.teal})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Engineering Workflow?
            </span>
          </h2>
          <p className="text-sm mb-8 max-w-xl mx-auto"
            style={{ color: 'rgba(255,255,255,.42)', lineHeight: 1.75 }}>
            Join engineering teams using RADAI to accelerate projects, eliminate manual errors,
            and deliver consistent, compliant results — across every discipline.
          </p>
          <div className="flex justify-center">
            <Link to={SOLUTIONS_CTA.secondary.link}
              className="font-bold text-sm px-7 py-3.5 rounded-xl transition-all duration-300"
              style={{
                border: '1px solid rgba(97,122,173,.4)',
                color: 'rgba(255,255,255,.72)',
                backdropFilter: 'blur(8px)',
              }}>
              {SOLUTIONS_CTA.secondary.text}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

/* internal helper — get categories by group without re-importing internals */
function _getCatsByGroup(group) {
  return Object.fromEntries(
    Object.entries(SOLUTION_CATEGORIES).filter(([, v]) => v.group === group)
  )
}

export default Solutions
