import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  COMPANY_INFO,
  CORE_VALUES,
  MILESTONES,
  COMPANY_STATS,
  EXPERTISE_AREAS,
  TEAM_DEPARTMENTS,
  CERTIFICATIONS,
  ABOUT_CTA,
  getCompanyAge,
} from '../config/about.config'

/* ─── keyframe CSS injected once ─── */
const GLOBAL_CSS = `
@keyframes flowRight {
  0%   { transform: translateX(-100%); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(200%); opacity: 0; }
}
@keyframes riseBubble {
  0%   { transform: translateY(0) scale(1);   opacity: 0.7; }
  100% { transform: translateY(-120px) scale(0.4); opacity: 0; }
}
@keyframes flamePulse {
  0%, 100% { transform: scaleY(1)   scaleX(1);   opacity: 0.9; }
  33%       { transform: scaleY(1.2) scaleX(0.9); opacity: 1;   }
  66%       { transform: scaleY(0.9) scaleX(1.1); opacity: 0.8; }
}
@keyframes rotateGauge {
  from { transform: rotate(-120deg); }
  to   { transform: rotate(60deg);  }
}
@keyframes drift {
  0%,100% { transform: translateY(0px) translateX(0px); }
  25%     { transform: translateY(-18px) translateX(8px); }
  50%     { transform: translateY(-8px)  translateX(-12px); }
  75%     { transform: translateY(-22px) translateX(4px); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes pipePulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
  50%     { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
}
@keyframes scanLine {
  0%   { top: -4px; }
  100% { top: 100%; }
}
@keyframes fadeSlideUp {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
}
`

function InjectCSS() {
  useEffect(() => {
    const id = 'about-keyframes'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = GLOBAL_CSS
      document.head.appendChild(s)
    }
    return () => { const el = document.getElementById(id); el?.remove() }
  }, [])
  return null
}

/* ─── Animated pipeline background particles ─── */
function PipelineCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf, W, H
    const particles = []
    function resize() {
      W = canvas.width  = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)
    // Create flowing molecule dots
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.3) * 0.6 + 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        hue: Math.random() > 0.6 ? 38 : 195, // amber or teal
        alpha: Math.random() * 0.5 + 0.1
      })
    }
    function draw() {
      ctx.clearRect(0, 0, W, H)
      // Draw connection lines (pipeline network)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d < 100) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(245,158,11,${0.08 * (1 - d/100)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      // Draw dots
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x > W + 10) p.x = -10
        if (p.x < -10)    p.x = W + 10
        if (p.y > H + 10) p.y = -10
        if (p.y < -10)    p.y = H + 10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue},90%,60%,${p.alpha})`
        ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}

/* ─── Pressure gauge stat card ─── */
function GaugeCard({ stat }) {
  const [animated, setAnimated] = useState(false)
  const [display, setDisplay] = useState('0')
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !animated) {
        setAnimated(true)
        const num = parseFloat(String(stat.value).replace(/[^0-9.]/g, ''))
        const suffix = String(stat.value).replace(/[0-9.]/g, '')
        const t0 = performance.now()
        const tick = (now) => {
          const p = Math.min((now - t0) / 1600, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          setDisplay(Math.round(num * ease) + suffix)
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    }, { threshold: 0.4 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [stat.value, animated])

  return (
    <div ref={ref} className="relative group overflow-hidden rounded-2xl p-6 text-center cursor-default"
      style={{ background: 'linear-gradient(135deg,rgba(15,30,55,0.95),rgba(10,40,60,0.95))', border: '1px solid rgba(245,158,11,0.25)', transition: 'border-color .4s, transform .4s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(245,158,11,0.7)'; e.currentTarget.style.transform='translateY(-4px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(245,158,11,0.25)'; e.currentTarget.style.transform='translateY(0)' }}>
      {/* scan line */}
      <div className="absolute left-0 right-0 h-px opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{ background:'linear-gradient(90deg,transparent,rgba(245,158,11,0.6),transparent)', animation:'scanLine 1.5s linear infinite' }} />
      <div className="text-3xl mb-2">{stat.icon}</div>
      <div className="text-4xl font-black tabular-nums mb-1"
        style={{ background:'linear-gradient(135deg,#fbbf24,#f97316)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
        {display || stat.value}
      </div>
      <div className="text-xs font-bold tracking-widest uppercase mb-0.5" style={{ color:'rgba(251,191,36,0.9)' }}>{stat.label}</div>
      <div className="text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>{stat.description}</div>
      {/* amber glow on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-500"
        style={{ background:'radial-gradient(ellipse at center,rgba(245,158,11,0.06),transparent 70%)' }} />
    </div>
  )
}

/* ─── Animated flame decoration ─── */
function Flame({ size = 32, delay = 0 }) {
  return (
    <div style={{ display:'inline-block', animation:`flamePulse 1.8s ease-in-out ${delay}s infinite`, transformOrigin:'bottom center', fontSize: size }}>
      🔥
    </div>
  )
}

/* ─── Section label pill ─── */
function SectionLabel({ children, color = 'amber' }) {
  const styles = {
    amber: { bg:'rgba(245,158,11,0.1)', border:'rgba(245,158,11,0.3)', text:'#fbbf24' },
    teal:  { bg:'rgba(20,184,166,0.1)', border:'rgba(20,184,166,0.3)', text:'#2dd4bf' },
    steel: { bg:'rgba(148,163,184,0.1)', border:'rgba(148,163,184,0.3)', text:'#94a3b8' },
  }
  const s = styles[color] || styles.amber
  return (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-4"
      style={{ background:s.bg, border:`1px solid ${s.border}`, color:s.text }}>
      {children}
    </span>
  )
}


const About = () => {
  const companyAge = getCompanyAge()

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: 'linear-gradient(160deg,#1c2e48 0%,#2B3A55 40%,#243550 70%,#1a2a42 100%)' }}>
      <InjectCSS />

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section className="relative flex items-center justify-center overflow-hidden" style={{ minHeight:'480px', paddingTop:'80px', paddingBottom:'80px' }}>
        {/* Blueprint grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(245,158,11,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.04) 1px,transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        {/* Molecule pipeline canvas */}
        <div className="absolute inset-0"><PipelineCanvas /></div>
        {/* Diagonal amber accent beam */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div style={{ position:'absolute', top:'-10%', left:'-5%', width:'2px', height:'120%', background:'linear-gradient(180deg,transparent,rgba(245,158,11,0.25),transparent)', transform:'rotate(25deg)', transformOrigin:'top left', animation:'shimmer 4s ease-in-out infinite' }} />
        </div>
        {/* Aurora orbs */}
        <div className="absolute top-1/4 -left-32 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ background:'radial-gradient(circle,rgba(13,148,136,0.18),transparent)' }} />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full blur-[100px] pointer-events-none" style={{ background:'radial-gradient(circle,rgba(245,158,11,0.12),transparent)' }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center" style={{ animation:'fadeSlideUp 1s ease-out' }}>
          {/* Amber status badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-500/30 backdrop-blur-sm mb-5" style={{ background:'rgba(245,158,11,0.07)' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400" style={{ animation:'flamePulse 1.5s ease-in-out infinite' }} />
            <span className="text-amber-400 text-sm font-semibold tracking-wide">{companyAge}+ Years Engineering Excellence · Est. {COMPANY_INFO.foundedYear}</span>
          </div>

          <h1 className="font-black tracking-tight mb-3 leading-none" style={{ fontSize:'clamp(2.8rem,7vw,5.5rem)' }}>
            <span style={{ background:'linear-gradient(135deg,#ffffff 0%,#fbbf24 40%,#f59e0b 60%,#ffffff 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
              {COMPANY_INFO.name}
            </span>
          </h1>

          <p className="text-lg font-light max-w-2xl mx-auto mb-2 tracking-wide" style={{ color:'rgba(255,255,255,0.65)' }}>
            {COMPANY_INFO.tagline}
          </p>
          <p className="text-sm max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color:'rgba(255,255,255,0.4)' }}>
            {COMPANY_INFO.description}
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/solutions" className="group flex items-center gap-2 font-bold text-sm" style={{ padding:'14px 28px', borderRadius:'12px', background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#fff', boxShadow:'0 0 30px rgba(245,158,11,0.3)', transition:'all 0.3s' }}>
              Explore Solutions
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link to="/enquiry" className="font-bold text-sm transition-all duration-300" style={{ padding:'14px 28px', borderRadius:'12px', border:'1px solid rgba(245,158,11,0.3)', color:'rgba(255,255,255,0.8)', backdropFilter:'blur(8px)' }}>
              Get in Touch
            </Link>
          </div>
        </div>

        {/* Scroll hint removed for compact banner */}
      </section>

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <section className="py-12 px-6 relative">
        <div className="absolute top-12 left-0 right-0 h-px pointer-events-none" style={{ background:'linear-gradient(90deg,transparent 0%,rgba(245,158,11,0.4) 30%,rgba(13,148,136,0.4) 70%,transparent 100%)', animation:'flowRight 3s linear infinite' }} />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <SectionLabel>By the Numbers</SectionLabel>
            <h2 className="text-4xl lg:text-5xl font-black text-white">Field-Proven Impact</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COMPANY_STATS.map(stat => <GaugeCard key={stat.id} stat={stat} />)}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          VISION / MISSION
      ══════════════════════════════════════ */}
      <section className="py-10 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">
          {/* Vision — teal */}
          <div className="relative overflow-hidden" style={{ borderRadius:'24px', border:'1px solid rgba(13,148,136,0.25)', background:'linear-gradient(135deg,rgba(13,148,136,0.08),rgba(10,26,46,0.9))', padding:'40px', transition:'all 0.5s' }}>
            <svg className="absolute top-4 left-4 w-8 h-8" viewBox="0 0 32 32" fill="none"><path d="M4 16 V4 H16" stroke="rgba(13,148,136,0.5)" strokeWidth="2"/></svg>
            <svg className="absolute bottom-4 right-4 w-8 h-8" viewBox="0 0 32 32" fill="none"><path d="M28 16 V28 H16" stroke="rgba(13,148,136,0.5)" strokeWidth="2"/></svg>
            <div className="absolute top-0 right-0 w-64 h-64 blur-3xl pointer-events-none" style={{ background:'radial-gradient(circle,rgba(13,148,136,0.15),transparent)' }} />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background:'rgba(13,148,136,0.15)', border:'1px solid rgba(13,148,136,0.35)' }}>
                <svg className="w-6 h-6" style={{ color:'#0d9488' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
              </div>
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#0d9488' }}>Our Vision</p>
              <p className="text-xl font-semibold leading-relaxed" style={{ color:'rgba(255,255,255,0.9)' }}>{COMPANY_INFO.vision}</p>
            </div>
          </div>
          {/* Mission — amber */}
          <div className="relative overflow-hidden" style={{ borderRadius:'24px', border:'1px solid rgba(245,158,11,0.25)', background:'linear-gradient(135deg,rgba(245,158,11,0.07),rgba(10,26,46,0.9))', padding:'40px', transition:'all 0.5s' }}>
            <svg className="absolute top-4 left-4 w-8 h-8" viewBox="0 0 32 32" fill="none"><path d="M4 16 V4 H16" stroke="rgba(245,158,11,0.5)" strokeWidth="2"/></svg>
            <svg className="absolute bottom-4 right-4 w-8 h-8" viewBox="0 0 32 32" fill="none"><path d="M28 16 V28 H16" stroke="rgba(245,158,11,0.5)" strokeWidth="2"/></svg>
            <div className="absolute top-0 right-0 w-64 h-64 blur-3xl pointer-events-none" style={{ background:'radial-gradient(circle,rgba(245,158,11,0.12),transparent)' }} />
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)' }}>
                <svg className="w-6 h-6" style={{ color:'#f59e0b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color:'#f59e0b' }}>Our Mission</p>
              <p className="text-xl font-semibold leading-relaxed" style={{ color:'rgba(255,255,255,0.9)' }}>{COMPANY_INFO.mission}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CORE VALUES
      ══════════════════════════════════════ */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <SectionLabel>What We Stand For</SectionLabel>
            <h2 className="text-4xl lg:text-5xl font-black text-white">Core Values</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {CORE_VALUES.map((value, i) => {
              const Icon = value.icon
              const palettes = [
                { from:'#f59e0b', to:'#f97316', glow:'rgba(245,158,11,0.12)' },
                { from:'#0d9488', to:'#0891b2', glow:'rgba(13,148,136,0.12)' },
                { from:'#f97316', to:'#ef4444', glow:'rgba(249,115,22,0.12)' },
                { from:'#0891b2', to:'#6366f1', glow:'rgba(8,145,178,0.12)' },
                { from:'#d97706', to:'#f59e0b', glow:'rgba(217,119,6,0.12)' },
                { from:'#14b8a6', to:'#0d9488', glow:'rgba(20,184,166,0.12)' },
              ]
              const p = palettes[i % 6]
              return (
                <div key={value.id} className="group relative overflow-hidden" style={{ borderRadius:'20px', border:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.03)', padding:'32px', transition:'all 0.5s' }}>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background:`linear-gradient(90deg,transparent,${p.from},${p.to},transparent)` }} />
                  <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" style={{ background:p.glow }} />
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 shadow-lg" style={{ background:`linear-gradient(135deg,${p.from},${p.to})` }}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{value.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color:'rgba(255,255,255,0.5)' }}>{value.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          TIMELINE — horizontal valve-chain
      ══════════════════════════════════════ */}
      <section className="py-10 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-6">
            <div>
              <SectionLabel color="amber">Our Story</SectionLabel>
              <h2 className="text-3xl lg:text-4xl font-black text-white">Pipeline of Progress</h2>
            </div>
            <p className="text-sm" style={{ color:'rgba(255,255,255,0.35)' }}>{companyAge} years of continuous evolution</p>
          </div>

          {/* Scrollable pipeline strip */}
          <div className="overflow-x-auto" style={{ scrollbarWidth:'none', msOverflowStyle:'none' }}>
            <div className="relative flex items-center" style={{ minWidth:'860px', paddingTop:'106px', paddingBottom:'106px' }}>

              {/* Pipe track */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none" style={{ height:'6px', borderRadius:'3px', background:'linear-gradient(90deg,rgba(43,58,85,0.2) 0%,#f59e0b 12%,#0d9488 38%,#617aad 62%,#f97316 88%,rgba(43,58,85,0.2) 100%)', boxShadow:'0 0 18px rgba(245,158,11,0.3)' }}>
                {/* Animated flow shimmer */}
                <div style={{ position:'absolute', inset:'0', borderRadius:'3px', background:'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.55) 50%,transparent 100%)', backgroundSize:'200% 100%', animation:'flowRight 2.2s linear infinite' }} />
              </div>

              {MILESTONES.map((ms, i) => {
                const Icon = ms.icon
                const above = i % 2 === 0
                const accentList = ['#f59e0b','#0d9488','#617aad','#f97316','#2AA784','#73BDC8','#fbbf24']
                const ac = accentList[i % accentList.length]
                return (
                  <div key={ms.year} className="group relative flex-1 flex flex-col items-center" style={{ zIndex:1 }}>

                    {/* ABOVE pipe: content if above===true, else spacer */}
                    <div style={{ height:'96px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent: above ? 'flex-end' : 'flex-start', gap:'3px', paddingBottom: above ? '14px' : 0, paddingTop: above ? 0 : '14px' }}>
                      {above && (
                        <>
                          <span className="font-black text-base leading-none" style={{ color:ac }}>{ms.year}</span>
                          <span className="font-bold text-center leading-snug" style={{ color:'#fff', fontSize:'11px', maxWidth:'108px', textAlign:'center' }}>{ms.title}</span>
                          <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.42)', maxWidth:'108px', textAlign:'center', lineHeight:'1.35', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ms.description}</span>
                        </>
                      )}
                    </div>

                    {/* Valve node */}
                    <div className="flex-shrink-0" style={{ position:'relative', zIndex:2, width:'28px', height:'28px', borderRadius:'50%', border:`2.5px solid ${ac}`, background:'#2B3A55', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 16px ${ac}80`, animation:'pipePulse 2.5s ease-in-out infinite', animationDelay:`${i * 0.3}s` }}>
                      <Icon style={{ width:'11px', height:'11px', color:ac }} />
                    </div>

                    {/* BELOW pipe: content if above===false, else spacer */}
                    <div style={{ height:'96px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent: above ? 'flex-start' : 'flex-end', gap:'3px', paddingTop: above ? '14px' : 0, paddingBottom: above ? 0 : '14px' }}>
                      {!above && (
                        <>
                          <span className="font-black text-base leading-none" style={{ color:ac }}>{ms.year}</span>
                          <span className="font-bold text-center leading-snug" style={{ color:'#fff', fontSize:'11px', maxWidth:'108px', textAlign:'center' }}>{ms.title}</span>
                          <span style={{ fontSize:'10px', color:'rgba(255,255,255,0.42)', maxWidth:'108px', textAlign:'center', lineHeight:'1.35', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ms.description}</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CERTIFICATIONS
      ══════════════════════════════════════ */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <SectionLabel color="teal">Standards & Compliance</SectionLabel>
            <h2 className="text-4xl lg:text-5xl font-black text-white">Certifications</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {CERTIFICATIONS.map(cert => (
              <div key={cert.id} className="group relative overflow-hidden text-center" style={{ borderRadius:'20px', border:'1px solid rgba(13,148,136,0.2)', background:'rgba(13,148,136,0.06)', padding:'24px', transition:'all 0.4s' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background:'rgba(13,148,136,0.15)', border:'1px solid rgba(13,148,136,0.3)' }}>
                  <svg className="w-6 h-6" style={{ color:'#0d9488' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{cert.name}</h3>
                <p className="text-xs mb-3" style={{ color:'rgba(255,255,255,0.45)' }}>{cert.description}</p>
                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold" style={{ borderRadius:'999px', background:'rgba(13,148,136,0.15)', border:'1px solid rgba(13,148,136,0.25)', color:'#0d9488' }}>{cert.category}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CTA — cinematic banner
      ══════════════════════════════════════ */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0"><PipelineCanvas /></div>
        <div className="absolute inset-0" style={{ background:'linear-gradient(160deg,rgba(10,26,46,0.92),rgba(13,36,64,0.88),rgba(15,45,74,0.92))' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:'radial-gradient(circle at 1px 1px,rgba(245,158,11,0.15) 1px,transparent 0)', backgroundSize:'32px 32px' }} />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <SectionLabel color="amber">Join the Revolution</SectionLabel>
          <h2 className="text-5xl lg:text-6xl font-black text-white mb-5 leading-tight">
            Ready for the Future<br />
            <span style={{ background:'linear-gradient(135deg,#f59e0b,#f97316,#fbbf24)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>of Engineering?</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto mb-4" style={{ color:'rgba(255,255,255,0.5)' }}>
            Experience AI-driven engineering solutions backed by {companyAge} years of expertise — trusted by teams in {COMPANY_INFO.countries} countries.
          </p>
          <div className="flex gap-1 justify-center mb-10">
            <Flame size={28} delay={0} /><Flame size={28} delay={0.3} /><Flame size={28} delay={0.6} />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={ABOUT_CTA.primary.link} className="group flex items-center justify-center gap-2 font-bold" style={{ padding:'16px 32px', borderRadius:'12px', background:'linear-gradient(135deg,#f59e0b,#f97316)', color:'#fff', boxShadow:'0 0 40px rgba(245,158,11,0.3)', transition:'all 0.3s' }}>
              {ABOUT_CTA.primary.text}
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
            <Link to={ABOUT_CTA.secondary.link} className="font-bold transition-all duration-300" style={{ padding:'16px 32px', borderRadius:'12px', border:'1px solid rgba(245,158,11,0.3)', color:'rgba(255,255,255,0.8)', backdropFilter:'blur(8px)' }}>
              {ABOUT_CTA.secondary.text}
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

export default About
