/**
 * AIDashboardStyles — injects scoped keyframes for the AI-style animations used
 * by the personal dashboard (glow ring, neural gradient background, widget
 * entry fade, customize-mode aura). Kept as a JSX component so it hot-reloads
 * with the dashboard and stays close to the widgets that use it.
 *
 * Nothing here targets global elements — every rule is scoped to `.ai-*` classes.
 */
import React from 'react'

export default function AIDashboardStyles() {
  return (
    <style>{`
      /* ── Widget entry fade + rise ───────────────────────────────────── */
      @keyframes aiWidgetIn {
        0%   { opacity: 0; transform: translateY(8px) scale(0.985); }
        100% { opacity: 1; transform: translateY(0)   scale(1);     }
      }
      .ai-widget-shell {
        animation: aiWidgetIn 340ms cubic-bezier(0.2, 0, 0, 1) both;
      }

      /* ── AI neon border pulse (edit mode) ───────────────────────────── */
      @keyframes aiGlowPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35), 0 0 22px rgba(99, 102, 241, 0.20); }
        50%      { box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.28), 0 0 34px rgba(168, 85, 247, 0.35); }
      }
      .ai-widget-glow {
        border: 1.5px solid transparent;
        background:
          linear-gradient(#ffffff00, #ffffff00) padding-box,
          linear-gradient(135deg, rgba(99,102,241,0.55), rgba(168,85,247,0.55), rgba(6,182,212,0.55)) border-box;
        animation: aiGlowPulse 2.4s ease-in-out infinite;
      }
      .ai-widget-shell--editing {
        transition: transform 220ms ease;
      }
      .ai-widget-shell--editing:hover {
        transform: translateY(-2px);
      }
      .ai-widget-shell--dragging {
        transform: scale(1.015);
        filter: drop-shadow(0 18px 32px rgba(79, 70, 229, 0.25));
      }

      /* ── Neural gradient background (dashboard-wide aurora) ─────────── */
      @keyframes aiAuroraDrift {
        0%   { transform: translate3d(0,   0,   0) rotate(0deg);   }
        50%  { transform: translate3d(3%, -2%,  0) rotate(6deg);   }
        100% { transform: translate3d(0,   0,   0) rotate(0deg);   }
      }
      .ai-aurora {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: -10;
        overflow: hidden;
      }
      .ai-aurora__blob {
        position: absolute;
        border-radius: 9999px;
        filter: blur(80px);
        opacity: 0.35;
        will-change: transform;
      }
      .ai-aurora__blob--a { top: -15%;  left: -10%; width: 44rem; height: 44rem; background: radial-gradient(circle, rgba(99,102,241,0.55), transparent 60%); animation: aiAuroraDrift 18s ease-in-out infinite; }
      .ai-aurora__blob--b { top:  30%;  right: -15%; width: 40rem; height: 40rem; background: radial-gradient(circle, rgba(168,85,247,0.45), transparent 60%); animation: aiAuroraDrift 22s ease-in-out infinite reverse; }
      .ai-aurora__blob--c { bottom: -20%; left: 30%; width: 38rem; height: 38rem; background: radial-gradient(circle, rgba(6,182,212,0.4), transparent 60%); animation: aiAuroraDrift 26s ease-in-out infinite; }

      /* Subtle grid overlay — evokes a neural / circuit board texture */
      .ai-grid-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: -9;
        background-image:
          linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
        background-size: 48px 48px;
        mask-image: radial-gradient(ellipse at center, black 20%, transparent 75%);
      }

      /* ── Customize toolbar shimmer ──────────────────────────────────── */
      @keyframes aiShimmer {
        0%   { background-position: -200% 0; }
        100% { background-position:  200% 0; }
      }
      .ai-shimmer-text {
        background: linear-gradient(90deg, #6366f1, #a855f7, #06b6d4, #6366f1);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: aiShimmer 4s linear infinite;
      }

      /* Reduced motion — respect user preference */
      @media (prefers-reduced-motion: reduce) {
        .ai-widget-shell,
        .ai-widget-glow,
        .ai-aurora__blob,
        .ai-shimmer-text {
          animation: none !important;
        }
      }
    `}</style>
  )
}
