/**
 * Shared closing CTA banner for the service pages — dark with glow buttons.
 */
import React from 'react'
import { Link } from 'react-router-dom'
import { B } from './serviceTheme'

const ServiceCTA = ({ title, subtitle, buttons = [], note }) => (
  <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden"
    style={{ background: `linear-gradient(135deg,${B.navyDk},${B.navy},${B.navyDk})` }}>
    {/* Pulsing glow orbs */}
    <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
      style={{ background: `radial-gradient(circle,${B.green}30,transparent)`, animation: 'svcGlow 4s ease-in-out infinite' }} />
    <div className="absolute top-1/2 right-1/3 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
      style={{ background: `radial-gradient(circle,${B.cyan}28,transparent)`, animation: 'svcGlow 4s ease-in-out infinite 2s' }} />

    <div className="relative max-w-5xl mx-auto text-center">
      <h2 className="text-4xl lg:text-5xl font-black mb-6 text-white">{title}</h2>
      <p className="text-xl mb-10 max-w-3xl mx-auto" style={{ color: 'rgba(255,255,255,.55)' }}>
        {subtitle}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        {buttons.map(({ to, text, icon: Icon, primary }) => (
          <Link key={text} to={to}
            className="svc-btn3d px-8 py-4 font-bold rounded-xl flex items-center gap-2 text-white"
            style={primary
              ? { background: `linear-gradient(135deg,${B.green},${B.cyan})` }
              : { background: 'rgba(255,255,255,.06)', border: '1px solid rgba(127,202,181,.35)' }}>
            {Icon && <Icon className="w-5 h-5" />}
            {text}
          </Link>
        ))}
      </div>

      {note && <p className="mt-6 text-sm" style={{ color: 'rgba(255,255,255,.4)' }}>{note}</p>}
    </div>
  </section>
)

export default ServiceCTA
