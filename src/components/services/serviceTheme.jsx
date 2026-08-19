/**
 * Shared theme for the four public service pages.
 * Palette + injected keyframes/3D-lighting classes + tiny primitives.
 * Matches the site-wide navy/teal brand (Home / Solutions / About / Enquiry).
 */
import React, { useEffect } from 'react'

export const B = {
  navy:   '#2B3A55',
  navyDk: '#1c2e48',
  teal:   '#7FCAB5',
  green:  '#2AA784',
  cyan:   '#0093A3',
  steel:  '#617AAD',
}

/** Text colors for the light (white) middle band — section headings etc. */
export const LT = {
  heading: '#2B3A55',
  body:    'rgba(43,58,85,.65)',
  muted:   'rgba(43,58,85,.45)',
}

/** Text colors inside the dark navy cards (which sit on the white band) */
export const CT = {
  heading: '#ffffff',
  body:    'rgba(255,255,255,.6)',
  muted:   'rgba(255,255,255,.4)',
}

const CSS = `
@keyframes svcFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
@keyframes svcGlow   { 0%,100%{opacity:.25} 50%{opacity:.6} }
.svc-card3d {
  background: linear-gradient(145deg,#2B3A55,#1c2e48);
  border: 1px solid rgba(127,202,181,.25);
  box-shadow: 0 8px 24px rgba(43,58,85,.25), inset 0 1px 0 rgba(255,255,255,.08);
  transition: transform .25s ease-out, box-shadow .25s ease-out, border-color .25s ease-out;
  will-change: transform;
}
.svc-card3d:hover {
  transform: perspective(800px) rotateX(2deg) translateY(-6px);
  border-color: rgba(127,202,181,.6) !important;
  box-shadow:
    0 24px 48px -14px rgba(0,147,163,.45),
    0 0 28px rgba(42,167,132,.25),
    inset 0 1px 0 rgba(255,255,255,.14),
    inset 0 0 28px rgba(0,147,163,.08) !important;
}
.svc-btn3d {
  box-shadow: 0 8px 22px -8px rgba(0,147,163,.35), inset 0 1px 0 rgba(255,255,255,.12);
  transition: transform .2s ease-out, box-shadow .2s ease-out;
}
.svc-btn3d:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 16px 36px -10px rgba(0,147,163,.55), 0 0 24px rgba(42,167,132,.3), inset 0 1px 0 rgba(255,255,255,.18);
}
.svc-btn3d:active { transform: translateY(0) scale(.98); }
.svc-card3d-light {
  background: #ffffff;
  border: 1px solid rgba(43,58,85,.08);
  box-shadow: 0 2px 16px rgba(43,58,85,.07), inset 0 1px 0 #fff;
  transition: transform .25s ease-out, box-shadow .25s ease-out, border-color .25s ease-out;
  will-change: transform;
}
.svc-card3d-light:hover {
  transform: perspective(800px) rotateX(2deg) translateY(-6px);
  border-color: rgba(0,147,163,.4);
  box-shadow:
    0 22px 44px -14px rgba(0,147,163,.25),
    0 0 22px rgba(42,167,132,.12),
    inset 0 1px 0 #fff;
}
.svc-grad-text {
  /* Static gradient — animating background-position on background-clip:text
     triggers a Chromium bug that clips glyph tops and leaves stray artifact
     lines on large font-black headings. Not worth the defect for a decorative flourish. */
  background: linear-gradient(90deg,#fff,#d3daea,${B.teal});
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
@media (prefers-reduced-motion: reduce) {
  .svc-card3d, .svc-card3d-light, .svc-btn3d { transition: none !important }
  .svc-grad-text { animation: none !important }
}
`

export function InjectServiceCSS() {
  useEffect(() => {
    const id = 'radai-service-css'
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent = CSS
      document.head.appendChild(s)
    }
    // Shared across the 4 service pages — leave installed on unmount so
    // client-side navigation between them never flashes unstyled.
  }, [])
  return null
}

/**
 * Dark navy card with the shared 3D tilt/teal-glow hover.
 * Sits on the white middle band (and works on dark bands too).
 * Visuals live in the .svc-card3d class so the hover lighting always applies;
 * pass style only for per-card accents (e.g. highlighted border).
 */
export const GlassCard = ({ children, className = '', style = {}, ...rest }) => (
  <div className={`svc-card3d rounded-2xl ${className}`} style={style} {...rest}>
    {children}
  </div>
)

/** Small teal chip (time estimates, categories, compliance levels…) */
export const Chip = ({ children, color = B.teal }) => (
  <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full"
    style={{ color, background: `${color}1a`, border: `1px solid ${color}44` }}>
    {children}
  </span>
)
