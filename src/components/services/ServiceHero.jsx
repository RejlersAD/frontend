/**
 * Shared hero for the four service pages.
 * Dark navy, ambient glows, animated gradient headline, staggered entrance.
 * Content is passed in — nothing hardcoded per service.
 */
import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { B } from './serviceTheme'
import { REJLERS_GROUP_FACTS } from '../../config/about.config'

const ServiceHero = ({ badgeIcon: BadgeIcon, badgeText, title, tagline, description, buttons = [], note }) => {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden min-h-[60vh] flex items-center">
    {/* Ambient glows */}
    <div className="absolute top-0 left-1/4 w-[520px] h-[520px] rounded-full blur-[130px] pointer-events-none"
      style={{ background: 'radial-gradient(circle,rgba(127,202,181,.18),transparent)', animation: 'svcGlow 5s ease-in-out infinite' }} />
    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] pointer-events-none"
      style={{ background: 'radial-gradient(circle,rgba(0,147,163,.15),transparent)', animation: 'svcGlow 5s ease-in-out infinite 2.5s' }} />

    <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 text-center">
      {/* Back — returns to wherever the visitor came from (Solutions catalog, Home, etc.) */}
      <button onClick={() => navigate(-1)}
        className="svc-btn3d absolute top-6 left-4 sm:left-6 lg:left-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white"
        style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(127,202,181,.3)', animation: 'svcFadeUp .5s ease-out both' }}>
        <ArrowLeftIcon className="w-4 h-4" style={{ color: B.teal }} />
        Back
      </button>

      <div className="inline-flex items-center px-4 py-2 rounded-full mb-6"
        style={{ background: 'rgba(127,202,181,.1)', border: '1px solid rgba(127,202,181,.3)', animation: 'svcFadeUp .6s ease-out both' }}>
        {BadgeIcon && <BadgeIcon className="w-5 h-5 mr-2" style={{ color: B.teal }} />}
        <span className="text-sm font-semibold" style={{ color: B.teal }}>{badgeText}</span>
      </div>

      {/* Entrance animation lives on this wrapper, not the heading itself —
          animating `transform` directly on a background-clip:text element
          is a known Chromium bug that clips the tops of tall/capital glyphs. */}
      <div style={{ animation: 'svcFadeUp .7s .1s ease-out both' }}>
        {/* Plain solid color, not a background-clip:text gradient — that
            technique combined with the transform entrance animation was
            causing Chromium to paint only part of the heading and drop the
            rest (the "P&ID Analysis &" cutoff bug). Solid color always
            renders every character reliably. */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-6 leading-[1.35] pt-2 text-white">
          {title}
        </h1>
      </div>

      {tagline && (
        <p className="text-xl md:text-2xl mb-6 max-w-3xl mx-auto font-semibold"
          style={{ color: 'rgba(255,255,255,.7)', animation: 'svcFadeUp .7s .2s ease-out both' }}>
          {tagline}
        </p>
      )}

      <p className="text-lg lg:text-xl max-w-4xl mx-auto mb-10 leading-relaxed"
        style={{ color: 'rgba(255,255,255,.5)', animation: 'svcFadeUp .7s .25s ease-out both' }}>
        {description}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        style={{ animation: 'svcFadeUp .7s .35s ease-out both' }}>
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

      {note && (
        <p className="mt-6 text-sm" style={{ color: 'rgba(255,255,255,.4)', animation: 'svcFadeUp .7s .45s ease-out both' }}>
          {note}
        </p>
      )}

      {/* Rejlers Group at a glance — real, sourced facts about the parent
          company (rejlers.com investor relations + Wikipedia), same data
          used on the About page. Fills the hero with substance, not filler. */}
      <div className="mt-14 pt-8 max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4"
        style={{ borderTop: '1px solid rgba(127,202,181,.15)', animation: 'svcFadeUp .7s .55s ease-out both' }}>
        {REJLERS_GROUP_FACTS.map((fact) => (
          <div key={fact.label}>
            <div className="text-lg sm:text-xl font-black" style={{ color: B.teal }}>{fact.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>
              {fact.label}
            </div>
          </div>
        ))}
      </div>
    </div>
    </section>
  )
}

export default ServiceHero
