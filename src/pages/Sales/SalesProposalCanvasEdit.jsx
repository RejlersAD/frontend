import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Loader2, PencilLine } from 'lucide-react';
import salesService from '../../services/sales.service';
import SalesProposalSectionEditor from './SalesProposalSectionEditor';
import { editableSections, sectionForPage } from './proposalSectionEdit';

const POLL_MS = 4000;
const errorText = (failure, fallback) => {
  const data = failure?.response?.data;
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return first(data?.blocks) || first(data?.expected_version) || first(data?.section_key) || first(data?.reason)
    || first(data?.detail) || fallback;
};
const pageLabel = (pages) => (Array.isArray(pages) ? (pages[0] === pages[1] ? `p. ${pages[0]}` : `pp. ${pages[0]}–${pages[1]}`) : '');

/**
 * "Edit content" panel of the review canvas: edit the section shown on the current page and
 * rebuild the proposal PDF from the edited text. Shown for standard Technical Proposals only.
 */
export default function SalesProposalCanvasEdit({ proposalId, workspace, pageNumber, onGoToPage, onUpdated }) {
  const current = workspace?.current;
  const sections = editableSections(current?.content);
  const [chosen, setChosen] = useState('');
  const [dirty, setDirty] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const onPage = sectionForPage(sections, pageNumber);
  const section = sections.find((item) => item.key === chosen) || onPage || sections[0] || null;
  const running = Boolean(job && ['queued', 'running'].includes(job.status));

  // Follow the page while nothing is being edited.
  useEffect(() => { if (!dirty && onPage) setChosen(onPage.key); }, [dirty, onPage]);
  // Opened on a page that cannot be edited (cover, letter, dividers): show the first editable section.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !sections.length) return;
    opened.current = true;
    if (!onPage && sections[0].pages) onGoToPage(sections[0].pages[0]);
  }, [sections, onPage, onGoToPage]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setTimeout(async () => {
      try {
        const next = (await salesService.getStandardProposalJob(proposalId, job.id)).job;
        setJob(next);
        if (next.status === 'succeeded') {
          setNotice(`Saved as proposal version ${next.result_version}. The updated PDF is now shown.`);
          setDirty(false);
          onUpdated();
        } else if (next.status === 'failed') {
          setError(next.error_code === 'version_changed'
            ? 'Someone else changed this section meanwhile. Your edit was not applied; reopen the section and edit again.'
            : 'The PDF could not be updated. Your edit was not applied; try again.');
        }
      } catch {
        setJob((previous) => ({ ...previous }));   // keep polling after a transient failure
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [running, job, proposalId, onUpdated]);

  const save = useCallback(async (blocks, reason) => {
    if (!section || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await salesService.saveTechnicalProposalSectionContent(proposalId, section.key, {
        expected_version: current.version, blocks, reason,
      });
      setJob(result.job);
    } catch (failure) {
      setError(errorText(failure, 'The edit could not be saved. Try again.'));
    } finally {
      setSaving(false);
    }
  }, [section, saving, proposalId, current?.version]);

  if (!current) return <p className="spe-muted spe-pad">The Technical Proposal has not been generated yet.</p>;
  if (!sections.length) return <p className="spe-muted spe-pad">This proposal has no sections that can be edited here.</p>;

  return (
    <div className="spe-panel">
      <div className="spe-section-pick">
        <label htmlFor="spe-section">Section</label>
        <select id="spe-section" value={section?.key || ''} disabled={dirty || running || saving}
          onChange={(event) => {
            setChosen(event.target.value); setError(''); setNotice('');
            const target = sections.find((item) => item.key === event.target.value);
            if (target?.pages) onGoToPage(target.pages[0]);
          }}>
          {sections.map((item) => <option key={item.key} value={item.key}>{item.title} {pageLabel(item.pages) && `(${pageLabel(item.pages)})`}</option>)}
        </select>
        {dirty && <p className="spe-muted">Save or discard your changes to switch section.</p>}
      </div>
      {running && (
        <p className="spe-progress" role="status"><Loader2 size={15} className="ssp-spin" aria-hidden="true" />
          Updating the PDF in the Rejlers template… this usually takes one to three minutes.</p>
      )}
      {error && <p className="spr-inline-error" role="alert">{error}</p>}
      {notice && <p className="spr-inline-success" role="status"><PencilLine size={14} aria-hidden="true" /> {notice}</p>}
      {section && (
        <SalesProposalSectionEditor
          key={`${current.version}:${section.key}`}
          section={section}
          disabled={running || saving}
          onSave={save}
          onDirtyChange={setDirty}
        />
      )}
    </div>
  );
}

SalesProposalCanvasEdit.propTypes = {
  proposalId: PropTypes.string.isRequired,
  workspace: PropTypes.shape({ current: PropTypes.object }),
  pageNumber: PropTypes.number.isRequired,
  onGoToPage: PropTypes.func.isRequired,
  onUpdated: PropTypes.func.isRequired,
};
