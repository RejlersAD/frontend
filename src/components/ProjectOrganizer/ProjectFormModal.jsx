/**
 * ProjectFormModal — generic create/edit form (generalized from
 * SpecProjectsPage.jsx's ProjectFormModal). Any tool adopting the Project
 * Organizer reuses this instead of building its own modal.
 */
import { useState } from 'react';
import { FolderPlusIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { PROJECT_ORGANIZER_CONFIG } from '../../config/projectOrganizer.config';

const Field = ({ label, value, onChange, theme, required }) => (
  <div>
    <label style={{ fontSize: 12, fontWeight: 600, color: theme.muted }}>{label}</label>
    <input
      type="text"
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 6,
        border: `1px solid ${theme.accentBorder}`, fontSize: 13, marginTop: 4,
      }}
    />
  </div>
);

const ProjectFormModal = ({ initial, onClose, onSubmit, busy, theme }) => {
  const [form, setForm] = useState(() => ({
    name:        initial?.name        || '',
    code:        initial?.code        || '',
    client:      initial?.client      || '',
    plant:       initial?.plant       || '',
    discipline:  initial?.discipline  || '',
    description: initial?.description || '',
    status:      initial?.status      || 'active',
  }));
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initial && (initial.code || initial.client || initial.plant || initial.discipline))
  );
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name.trim().length > 0 && !busy;
  const handleSubmit = (e) => { e?.preventDefault?.(); if (canSubmit) onSubmit(form); };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', borderRadius: 14, padding: 0, width: 'min(520px, 92vw)',
        maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px',
          background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(8,145,178,0.05))`,
          borderBottom: `1px solid ${theme.accentBorder}`,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: theme.cardBg, border: `1px solid ${theme.accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderPlusIcon width={18} style={{ color: theme.accent }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
              {initial ? 'Edit project' : 'Create new project'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.muted }}>
              {initial ? 'Update the project details.' : 'Create a project to organise your work.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <XMarkIcon width={20} style={{ color: theme.muted }} />
          </button>
        </div>

        <div style={{ padding: '20px 22px', overflow: 'auto', display: 'grid', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.text,
                            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Project Name *
            </label>
            <input
              type="text"
              value={form.name}
              autoFocus
              required
              maxLength={PROJECT_ORGANIZER_CONFIG.nameMaxLen}
              onChange={(e) => update('name', e.target.value)}
              placeholder="e.g., ADNOC LNG Train-3"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${theme.accentBorder}`, fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: theme.text,
                            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              Description <span style={{ color: theme.muted, fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <textarea
              value={form.description}
              maxLength={PROJECT_ORGANIZER_CONFIG.descMaxLen}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="Brief project description…"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1px solid ${theme.accentBorder}`, fontSize: 13,
                resize: 'vertical', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            style={{ background: 'transparent', border: 'none', color: theme.accent,
                     fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left', padding: 0 }}
          >
            {showAdvanced ? '− Hide advanced fields' : '+ Add code, client, plant, discipline, status'}
          </button>

          {showAdvanced && (
            <div style={{ display: 'grid', gap: 12, padding: 14, background: theme.accentSoft, borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Code"       value={form.code}       onChange={(v) => update('code', v)} theme={theme} />
                <Field label="Client"     value={form.client}     onChange={(v) => update('client', v)} theme={theme} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Plant"      value={form.plant}      onChange={(v) => update('plant', v)} theme={theme} />
                <Field label="Discipline" value={form.discipline} onChange={(v) => update('discipline', v)} theme={theme} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: theme.muted,
                                textTransform: 'uppercase', letterSpacing: 0.4 }}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => update('status', e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    border: `1px solid ${theme.accentBorder}`, fontSize: 13, marginTop: 4, background: '#fff',
                  }}
                >
                  {PROJECT_ORGANIZER_CONFIG.statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px', borderTop: `1px solid ${theme.accentBorder}`, background: '#fafafa',
        }}>
          <button type="button" onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${theme.accentBorder}`,
            color: theme.muted, padding: '9px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>Cancel</button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              background: canSubmit ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})` : '#cbd5e1',
              color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <CheckIcon width={14} /> {busy ? 'Saving…' : (initial ? 'Save changes' : 'Create project')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectFormModal;
