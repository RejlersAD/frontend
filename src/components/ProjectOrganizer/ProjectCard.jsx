/**
 * ProjectCard — generic project grid card (generalized from
 * SpecProjectsPage.jsx's ProjectCard). Shows activity_count instead of a
 * tool-specific extraction count so it applies to any adopting tool.
 */
import { PencilSquareIcon, TrashIcon, ArrowRightIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { statusMeta } from '../../config/projectOrganizer.config';

const Tag = ({ label, value, theme }) => (
  <span style={{
    background: theme.accentSoft, color: theme.accent,
    padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 11,
  }}>{label}: {value}</span>
);

const IconBtn = ({ children, theme, danger, ...rest }) => (
  <button {...rest} style={{
    background: 'transparent',
    border: `1px solid ${danger ? '#fca5a5' : theme.accentBorder}`,
    color: danger ? '#b91c1c' : theme.accent,
    padding: '5px 8px', borderRadius: 6, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
  }}>{children}</button>
);

const ProjectCard = ({ project, theme, onOpen, onEdit, onDelete, openLabel = 'Open' }) => {
  const meta = statusMeta(project.status);
  const activityCount = project.activity_count || 0;
  const initials = String(project.name || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');

  return (
    <div
      style={{
        background: 'linear-gradient(155deg, #ffffff 0%, #f8fffd 85%)',
        border: `1px solid ${theme.accentBorder}`,
        borderRadius: 16,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(2,6,23,0.05), 0 18px 34px rgba(15,118,110,0.08)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 20px rgba(2,6,23,0.10), 0 24px 44px rgba(15,118,110,0.16)';
        e.currentTarget.style.borderColor = 'rgba(8,145,178,0.34)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 10px rgba(2,6,23,0.05), 0 18px 34px rgba(15,118,110,0.08)';
        e.currentTarget.style.borderColor = theme.accentBorder;
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(circle at 90% -10%, rgba(8,145,178,0.18), transparent 42%)',
      }} />
      <div style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: 4,
        background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt || theme.accent})`,
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${theme.accentSoft}, rgba(8,145,178,0.14))`,
            border: `1px solid ${theme.accentBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.accent,
            fontSize: 12,
            fontWeight: 800,
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: theme.text,
                         whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
            </h3>
            {project.code && (
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase' }}>{project.code}</div>
            )}
          </div>
        </div>
        <span style={{
          background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700,
          padding: '4px 9px', borderRadius: 999, whiteSpace: 'nowrap', border: '1px solid rgba(148,163,184,0.22)',
        }}>{meta.label}</span>
      </div>

      <div style={{ position: 'relative', zIndex: 1, fontSize: 12, color: theme.muted, marginBottom: 12, minHeight: 36, lineHeight: 1.55 }}>
        {project.description?.slice(0, 110) || <em>No description.</em>}
        {project.description?.length > 110 && '...'}
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 8, fontSize: 11, color: theme.muted, marginBottom: 14, flexWrap: 'wrap' }}>
        {project.plant      && <Tag label="Plant"      value={project.plant}      theme={theme} />}
        {project.client     && <Tag label="Client"     value={project.client}     theme={theme} />}
        {project.discipline && <Tag label="Discipline" value={project.discipline} theme={theme} />}
      </div>

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: `1px solid ${theme.accentBorder}`,
        paddingTop: 11,
      }}>
        <div style={{
          fontSize: 11,
          color: theme.muted,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.85)',
          border: `1px solid ${theme.accentBorder}`,
          padding: '4px 8px',
          borderRadius: 999,
        }}>
          <ChartBarIcon width={13} />
          {activityCount} activit{activityCount === 1 ? 'y' : 'ies'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onEdit && <IconBtn title="Edit" onClick={onEdit} theme={theme}><PencilSquareIcon width={14} /></IconBtn>}
          {onDelete && <IconBtn title="Delete" onClick={onDelete} theme={theme} danger><TrashIcon width={14} /></IconBtn>}
          {onOpen && (
            <button onClick={onOpen} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt || theme.accent})`,
              color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(8,145,178,0.32)',
            }}>
              {openLabel} <ArrowRightIcon width={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
