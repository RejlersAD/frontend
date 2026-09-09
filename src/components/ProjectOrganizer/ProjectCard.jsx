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

const ProjectCard = ({ project, theme, onOpen, onEdit, onDelete }) => {
  const meta = statusMeta(project.status);
  const activityCount = project.activity_count || 0;
  return (
    <div
      style={{
        background: theme.cardBg, border: `1px solid ${theme.accentBorder}`,
        borderRadius: 12, padding: 16, position: 'relative',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 18px rgba(15,118,110,0.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)';    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: theme.text,
                       whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {project.name}
          </h3>
          {project.code && (
            <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{project.code}</div>
          )}
        </div>
        <span style={{
          background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
        }}>{meta.label}</span>
      </div>

      <div style={{ fontSize: 12, color: theme.muted, marginBottom: 12, minHeight: 30, lineHeight: 1.5 }}>
        {project.description?.slice(0, 110) || <em>No description.</em>}
        {project.description?.length > 110 && '…'}
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: theme.muted, marginBottom: 12, flexWrap: 'wrap' }}>
        {project.plant      && <Tag label="Plant"      value={project.plant}      theme={theme} />}
        {project.client     && <Tag label="Client"     value={project.client}     theme={theme} />}
        {project.discipline && <Tag label="Discipline" value={project.discipline} theme={theme} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderTop: `1px solid ${theme.accentBorder}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: theme.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChartBarIcon width={13} />
          {activityCount} activit{activityCount === 1 ? 'y' : 'ies'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onEdit && <IconBtn title="Edit" onClick={onEdit} theme={theme}><PencilSquareIcon width={14} /></IconBtn>}
          {onDelete && <IconBtn title="Delete" onClick={onDelete} theme={theme} danger><TrashIcon width={14} /></IconBtn>}
          {onOpen && (
            <button onClick={onOpen} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: theme.accent, color: '#fff', border: 'none',
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              Open <ArrowRightIcon width={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
