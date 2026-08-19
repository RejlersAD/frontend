/**
 * Layout primitives shared by the four service pages:
 * ServicePage (dark shell) · LightBand (light middle) · Section · SectionHeader
 * Structure: dark hero → light middle sections → dark CTA.
 */
import React from 'react'
import { B, LT, InjectServiceCSS } from './serviceTheme'

/** Page shell: navy gradient behind hero + CTA, blueprint dot grid */
export const ServicePage = ({ children }) => (
  <div className="min-h-screen text-white relative overflow-hidden"
    style={{ background: `linear-gradient(160deg,${B.navyDk} 0%,${B.navy} 55%,#243550 100%)` }}>
    <InjectServiceCSS />
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: 'radial-gradient(circle, rgba(127,202,181,0.06) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }} />
    <div className="relative z-10">{children}</div>
  </div>
)

/** Light band wrapping all the middle sections between dark hero and dark CTA */
export const LightBand = ({ children }) => (
  <div className="relative" style={{ background: '#ffffff' }}>
    {/* subtle navy dot grid so the band still reads as blueprint material */}
    <div className="absolute inset-0 pointer-events-none" style={{
      backgroundImage: 'radial-gradient(circle, rgba(43,58,85,0.05) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }} />
    <div className="relative">{children}</div>
  </div>
)

export const Section = ({ children, className = '' }) => (
  <section className={`py-16 lg:py-20 px-4 sm:px-6 lg:px-8 ${className}`}>
    <div className="max-w-7xl mx-auto">{children}</div>
  </section>
)

export const SectionHeader = ({ title, subtitle, tone = 'light' }) => (
  <div className="text-center mb-14">
    <h2 className="text-4xl lg:text-5xl font-black mb-4 leading-tight"
      style={{ color: tone === 'light' ? LT.heading : '#fff' }}>
      {title}
    </h2>
    {subtitle && (
      <p className="text-xl max-w-3xl mx-auto"
        style={{ color: tone === 'light' ? LT.body : 'rgba(255,255,255,.5)' }}>
        {subtitle}
      </p>
    )}
  </div>
)
