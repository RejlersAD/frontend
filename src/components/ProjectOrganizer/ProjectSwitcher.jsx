/**
 * ProjectSwitcher — dropdown pill (generalized from SpecCustomizationPage.jsx's
 * inline ProjectSwitcher). Shows the active project + a popover to switch,
 * create or clear it.
 */
import { useEffect, useRef, useState } from 'react';
import {
  FolderIcon, ChevronDownIcon, CheckIcon, PlusIcon, Squares2X2Icon, XMarkIcon,
} from '@heroicons/react/24/outline';

const ProjectSwitcher = ({
  projects, activeProject, loading, theme,
  onSwitch, onCreate, onClear, onManage,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', fontSize: 13, fontWeight: 600, color: theme.text,
          background: theme.cardBg, border: `1px solid ${theme.accentBorder}`,
          borderRadius: 8, cursor: 'pointer', opacity: loading ? 0.6 : 1,
        }}
        title="Switch project"
      >
        <FolderIcon width={16} style={{ color: theme.accent }} />
        <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : (activeProject?.name || 'No project selected')}
        </span>
        <ChevronDownIcon width={14} style={{ color: theme.muted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 30 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 320, zIndex: 40,
            background: theme.cardBg, border: `1px solid ${theme.accentBorder}`,
            borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,0.18)', overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.accentBorder}`,
                          display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderIcon width={16} style={{ color: theme.accent }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.text, textTransform: 'uppercase',
                            letterSpacing: 0.5, flex: 1 }}>Projects</div>
              <span style={{ fontSize: 10, color: theme.muted }}>{projects.length}</span>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {projects.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: theme.muted }}>
                  No projects yet.
                </div>
              ) : (
                projects.map((p) => {
                  const active = p.project_id === activeProject?.project_id;
                  return (
                    <button
                      key={p.project_id}
                      onClick={() => { onSwitch(p); setOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        display: 'flex', alignItems: 'flex-start', gap: 8, border: 'none', cursor: 'pointer',
                        background: active ? theme.accentSoft : 'transparent',
                      }}
                    >
                      <div style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0, color: active ? theme.accent : 'transparent' }}>
                        <CheckIcon width={16} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text,
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(p.activity_count || 0)} activit{(p.activity_count || 0) === 1 ? 'y' : 'ies'}
                          {p.code ? ` · ${p.code}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div style={{ padding: 8, borderTop: `1px solid ${theme.accentBorder}`,
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              <button
                onClick={() => { setOpen(false); onCreate(); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 8px', fontSize: 12, fontWeight: 600, color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`,
                }}
              ><PlusIcon width={14} /> New</button>
              <button
                onClick={() => { setOpen(false); onManage(); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 8px', fontSize: 12, fontWeight: 500, color: theme.text,
                  border: `1px solid ${theme.accentBorder}`, borderRadius: 6, cursor: 'pointer', background: 'transparent',
                }}
              ><Squares2X2Icon width={14} /> Manage</button>
              <button
                onClick={() => { setOpen(false); onClear(); }}
                disabled={!activeProject}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '7px 8px', fontSize: 12, fontWeight: 500, color: theme.text,
                  border: `1px solid ${theme.accentBorder}`, borderRadius: 6,
                  cursor: activeProject ? 'pointer' : 'not-allowed', opacity: activeProject ? 1 : 0.4, background: 'transparent',
                }}
                title="Clear active project"
              ><XMarkIcon width={14} /> Clear</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectSwitcher;
