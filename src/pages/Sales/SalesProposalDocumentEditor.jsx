import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  Bold, BookOpen, ChevronDown, ChevronUp, Columns, Download, FileText, Image, Italic, Link, List, ListOrdered, Loader2,
  Maximize, MessageSquarePlus, Redo2, Rows, Save, Search, Table, Trash2, Underline, Undo2, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import salesService from '../../services/sales.service';
import { proposalExtensions, commentKey, searchKey } from './proposalDocumentExtensions';
import { blocksProblem, blocksToDoc, docToBlocks, sameBlocks, wordCount } from './proposalDocumentModel';
import { editableSections, sectionForPage } from './proposalSectionEdit';
import './SalesProposalDocumentEditor.css';

const POLL_MS = 4000;
const TABS = ['File', 'Home', 'Insert', 'References', 'Review', 'View'];
const TEMPLATE_ONLY = 'Set by the Rejlers template. Character formatting is not saved, so it is not offered here.';
const ZOOMS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5];
const pageLabel = (pages) => (Array.isArray(pages) ? (pages[0] === pages[1] ? `Page ${pages[0]}` : `Pages ${pages[0]}–${pages[1]}`) : 'Not yet paginated');
const failureText = (failure, fallback) => {
  const data = failure?.response?.data;
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return first(data?.blocks) || first(data?.expected_version) || first(data?.reason) || first(data?.detail) || fallback;
};

function RibbonButton({ icon: Icon, label, onClick, disabled, active, title, wide }) {
  return (
    <button type="button" className={`spde-tool${wide ? ' spde-tool-wide' : ''}${active ? ' is-active' : ''}`} aria-label={wide ? undefined : label}
      aria-pressed={active === undefined ? undefined : Boolean(active)} title={title || label} disabled={disabled}
      onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {Icon && <Icon aria-hidden="true" />}{wide && <span>{label}</span>}
    </button>
  );
}
RibbonButton.propTypes = {
  icon: PropTypes.elementType, label: PropTypes.string.isRequired, onClick: PropTypes.func, disabled: PropTypes.bool,
  active: PropTypes.bool, title: PropTypes.string, wide: PropTypes.bool,
};

const Group = ({ label, children }) => (
  <div className="spde-group" role="group" aria-label={label}><div className="spde-group-tools">{children}</div><span className="spde-group-label">{label}</span></div>
);
Group.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node };

/** One section open as an editable page. Keyed by version + section, so a save reloads it. */
function SectionDocument({ section, quoteNumber, versionLabel, editable, busy, threads, selectedThreadId, onThreadSelect, onComment,
  onSave, onDirtyChange, onDownload, onShowPdf, downloading, onQuote }) {
  const [tab, setTab] = useState('Home');
  const [blocks, setBlocks] = useState(() => docToBlocks(blocksToDoc(section.blocks)));
  const [quote, setQuote] = useState('');
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [search, setSearch] = useState({ active: 0, count: 0 });
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [, setTick] = useState(0);
  const stageRef = useRef(null);
  const findRef = useRef(null);
  const reasonRef = useRef(null);
  const selectThread = useRef(onThreadSelect);
  selectThread.current = onThreadSelect;
  const extensions = useMemo(() => proposalExtensions({ onCommentSelect: (id) => selectThread.current?.(id) }), []);

  const editor = useEditor({
    extensions,
    content: blocksToDoc(section.blocks),
    editable: editable && !busy,
    editorProps: { attributes: { class: 'spde-content', 'aria-label': `${section.title} content`, spellcheck: 'true' } },
    onUpdate: ({ editor: current }) => setBlocks(docToBlocks(current.getJSON())),
    onSelectionUpdate: ({ editor: current }) => {
      const { from, to, empty } = current.state.selection;
      const value = empty ? '' : current.state.doc.textBetween(from, to, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
      setQuote(value); onQuote(value);
    },
    onTransaction: () => setTick((value) => value + 1),
  });

  const dirty = useMemo(() => !sameBlocks(section.blocks, blocks), [section.blocks, blocks]);
  const problem = dirty ? blocksProblem(blocks) : '';
  const words = useMemo(() => wordCount(blocks), [blocks]);
  const sourced = blocks.filter((block) => block.type !== 'part' && Number.isInteger(block.ref)
    && (section.blocks[block.ref]?.citations || []).length > 0).length;
  const sectionThreads = useMemo(() => threads.filter((thread) => thread.anchor?.quote && Array.isArray(section.pages)
    && thread.page_number >= section.pages[0] && thread.page_number <= section.pages[1]), [threads, section.pages]);

  useEffect(() => { editor?.setEditable(editable && !busy && !saving); }, [editor, editable, busy, saving]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(commentKey, sectionThreads.map((thread) => ({
      id: thread.id, quote: thread.anchor.quote, resolved: thread.is_resolved, selected: String(thread.id) === String(selectedThreadId),
    }))).setMeta('addToHistory', false));
  }, [editor, sectionThreads, selectedThreadId]);

  const runSearch = useCallback((value, active = 0) => {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query: value, active }).setMeta('addToHistory', false));
    const state = searchKey.getState(editor.state);
    setSearch({ active: state.active, count: state.matches.length });
    const match = state.matches[state.active];
    if (match) {
      editor.commands.setTextSelection(match);
      editor.view.domAtPos(match.from).node?.parentElement?.scrollIntoView?.({ block: 'center' });
    }
  }, [editor]);
  const stepSearch = (offset) => {
    if (!search.count) return;
    runSearch(query, (search.active + offset + search.count) % search.count);
  };
  const replaceOne = () => {
    const match = searchKey.getState(editor.state).matches[search.active];
    if (!match || !editor.isEditable) return;
    const tr = editor.state.tr;
    editor.view.dispatch(replacement ? tr.insertText(replacement, match.from, match.to) : tr.delete(match.from, match.to));
    runSearch(query, search.active);
  };
  const replaceAll = () => {
    const { matches } = searchKey.getState(editor.state);
    if (!matches.length || !editor.isEditable) return;
    const tr = editor.state.tr;
    [...matches].reverse().forEach((match) => (replacement ? tr.insertText(replacement, match.from, match.to) : tr.delete(match.from, match.to)));
    editor.view.dispatch(tr);
    runSearch(query, 0);
  };
  const openFind = () => { setFinding(true); requestAnimationFrame(() => findRef.current?.focus()); };
  const closeFind = () => { setFinding(false); setQuery(''); runSearch('', 0); editor?.commands.focus(); };
  const startSave = () => {
    if (!dirty || problem) return;
    setSaving(true); requestAnimationFrame(() => reasonRef.current?.focus());
  };
  const discard = () => {
    editor.commands.setContent(blocksToDoc(section.blocks), true);
    setSaving(false); setReason('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim() || problem) return;
    const saved = await onSave(blocks, reason.trim());
    if (saved) { setSaving(false); setReason(''); }
  };
  const comment = () => onComment(quote);
  const stepComment = (offset) => {
    if (!sectionThreads.length) return;
    const at = sectionThreads.findIndex((thread) => String(thread.id) === String(selectedThreadId));
    const next = sectionThreads[(at + offset + sectionThreads.length) % sectionThreads.length];
    onThreadSelect(next.id);
    requestAnimationFrame(() => stageRef.current?.querySelector(`[data-comment-id="${CSS.escape(String(next.id))}"]`)?.scrollIntoView({ block: 'center' }));
  };
  const fitWidth = () => {
    const width = stageRef.current?.clientWidth || 0;
    setZoom(Math.min(1.5, Math.max(0.5, Math.floor(((width - 48) / 794) * 20) / 20)));
  };

  // Open at "fit page width" when the A4 page is wider than the canvas.
  const ready = Boolean(editor);
  useEffect(() => {
    const width = stageRef.current?.clientWidth || 0;
    if (ready && width && width - 48 < 794) setZoom(Math.max(0.5, Math.floor(((width - 48) / 794) * 20) / 20));
  }, [ready]);

  const onKeyDown = (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'f' || event.key.toLowerCase() === 'h') { event.preventDefault(); openFind(); }
    if (event.key.toLowerCase() === 's') { event.preventDefault(); startSave(); }
  };

  if (!editor) return <div className="spde-loading" role="status"><Loader2 className="spde-spin" aria-hidden="true" />Opening the document…</div>;
  const can = editor.isEditable;
  const inTable = editor.isActive('table');
  const columnCount = inTable ? (editor.state.selection.$from.node(-3)?.firstChild?.childCount || 0) : 0;
  const heading = editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';

  return (
    <div className="spde" onKeyDown={onKeyDown}>
      <div className="spde-ribbon">
        <div className="spde-tabs" role="tablist" aria-label="Editor ribbon">
          {TABS.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}
          <div className="spde-track" title="Track changes is not available. Each save is kept as a new proposal version with its reason; earlier versions stay in Revision history.">
            <span>Track changes</span><span className="spde-switch" aria-hidden="true" /><span className="spde-track-state">Unavailable</span>
          </div>
        </div>
        <div className="spde-tools" role="tabpanel" aria-label={`${tab} tools`}>
          {tab === 'File' && <>
            <Group label="Save">
              <RibbonButton wide icon={Save} label="Save & update PDF" disabled={!dirty || Boolean(problem) || busy || !editable} onClick={startSave} />
              <RibbonButton wide icon={Undo2} label="Discard changes" disabled={!dirty || busy} onClick={discard} />
            </Group>
            <Group label="Export (last saved version)">
              <RibbonButton wide icon={Download} label={downloading === 'pdf' ? 'Preparing PDF…' : 'Download PDF'} disabled={Boolean(downloading)} onClick={() => onDownload('pdf')} />
              <RibbonButton wide icon={Download} label={downloading === 'docx' ? 'Preparing DOCX…' : 'Download DOCX'} disabled={Boolean(downloading)} onClick={() => onDownload('docx')} />
            </Group>
            <Group label="Source">
              <RibbonButton wide icon={FileText} label="Open source PDF" onClick={onShowPdf} />
            </Group>
          </>}
          {tab === 'Home' && <>
            <Group label="History">
              <RibbonButton icon={Undo2} label="Undo" disabled={!can || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
              <RibbonButton icon={Redo2} label="Redo" disabled={!can || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
            </Group>
            <Group label="Font (template)">
              <select className="spde-select" aria-label="Font" disabled title={TEMPLATE_ONLY} value="Arial" onChange={() => {}}><option>Arial</option></select>
              <RibbonButton icon={Bold} label="Bold" disabled title={TEMPLATE_ONLY} />
              <RibbonButton icon={Italic} label="Italic" disabled title={TEMPLATE_ONLY} />
              <RibbonButton icon={Underline} label="Underline" disabled title={TEMPLATE_ONLY} />
            </Group>
            <Group label="Paragraph">
              <RibbonButton icon={List} label="Bulleted list" active={editor.isActive('bulletList')} disabled={!can || inTable} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <RibbonButton icon={ListOrdered} label="Numbered list" disabled title="Numbered lists are not part of the Rejlers proposal template." />
            </Group>
            <Group label="Styles">
              {[['p', 'Normal'], ['h2', 'Heading 2'], ['h3', 'Heading 3']].map(([key, name]) => (
                <button key={key} type="button" className={`spde-style spde-style-${key}${heading === key ? ' is-active' : ''}`} aria-pressed={heading === key}
                  disabled={!can || inTable || editor.isActive('bulletList')} onMouseDown={(event) => event.preventDefault()}
                  onClick={() => (key === 'p' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: key === 'h2' ? 2 : 3 }).run())}>{name}</button>
              ))}
            </Group>
            <Group label="Editing">
              <RibbonButton wide icon={Search} label="Find" onClick={openFind} />
              <RibbonButton wide icon={Save} label="Save" disabled={!dirty || Boolean(problem) || busy || !editable} onClick={startSave} />
            </Group>
          </>}
          {tab === 'Insert' && <>
            <Group label="Content">
              <RibbonButton wide icon={Table} label="Table" disabled={!can || inTable} onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()} />
              <RibbonButton wide icon={List} label="Bulleted list" disabled={!can || inTable} onClick={() => editor.chain().focus().toggleBulletList().run()} />
            </Group>
            <Group label="Table">
              <RibbonButton icon={Rows} label="Insert row below" disabled={!can || !inTable} onClick={() => editor.chain().focus().addRowAfter().run()} />
              <RibbonButton icon={Columns} label="Insert column right" disabled={!can || !inTable || columnCount >= 8} title={columnCount >= 8 ? 'A table has at most 8 columns.' : 'Insert column right'} onClick={() => editor.chain().focus().addColumnAfter().run()} />
              <RibbonButton wide label="Delete row" disabled={!can || !inTable} onClick={() => editor.chain().focus().deleteRow().run()} />
              <RibbonButton wide label="Delete column" disabled={!can || !inTable || columnCount <= 1} onClick={() => editor.chain().focus().deleteColumn().run()} />
              <RibbonButton icon={Trash2} label="Delete table" disabled={!can || !inTable} onClick={() => editor.chain().focus().deleteTable().run()} />
            </Group>
            <Group label="Not in template">
              <RibbonButton icon={Link} label="Link" disabled title="Links are not supported by the Rejlers proposal renderer." />
              <RibbonButton icon={Image} label="Image" disabled title="Images are not placed in the text. Attach evidence documents to a section in Evidence review instead." />
            </Group>
          </>}
          {tab === 'References' && <>
            <Group label="Tender sources">
              <RibbonButton wide icon={BookOpen} label={showSources ? 'Hide sourced content' : 'Highlight sourced content'} active={showSources} onClick={() => setShowSources((value) => !value)} />
              <span className="spde-info">{sourced} of {blocks.filter((block) => block.type !== 'part').length} blocks keep tender citations</span>
            </Group>
          </>}
          {tab === 'Review' && <>
            <Group label="Comments">
              <RibbonButton wide icon={MessageSquarePlus} label="New comment" disabled={!quote} title={quote ? 'Comment on the selected text' : 'Select text to comment on it'} onClick={comment} />
              <RibbonButton icon={ChevronUp} label="Previous comment" disabled={!sectionThreads.length} onClick={() => stepComment(-1)} />
              <RibbonButton icon={ChevronDown} label="Next comment" disabled={!sectionThreads.length} onClick={() => stepComment(1)} />
              <span className="spde-info">{sectionThreads.length} on this section</span>
            </Group>
          </>}
          {tab === 'View' && <>
            <Group label="Zoom">
              <RibbonButton icon={ZoomOut} label="Zoom out" disabled={zoom <= ZOOMS[0]} onClick={() => setZoom((value) => ZOOMS.slice().reverse().find((step) => step < value) || ZOOMS[0])} />
              <RibbonButton wide label="100%" onClick={() => setZoom(1)} />
              <RibbonButton icon={ZoomIn} label="Zoom in" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom((value) => ZOOMS.find((step) => step > value) || ZOOMS[ZOOMS.length - 1])} />
              <RibbonButton icon={Maximize} label="Fit page width" onClick={fitWidth} />
            </Group>
            <Group label="Document">
              <RibbonButton wide icon={FileText} label="Source PDF" onClick={onShowPdf} />
              <RibbonButton wide icon={BookOpen} label="Sourced content" active={showSources} onClick={() => setShowSources((value) => !value)} />
            </Group>
          </>}
        </div>
        {finding && (
          <div className="spde-find-bar" role="search" aria-label="Find and replace">
            <input ref={findRef} aria-label="Find" placeholder="Find in section" value={query}
              onChange={(event) => { setQuery(event.target.value); runSearch(event.target.value, 0); }}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); stepSearch(event.shiftKey ? -1 : 1); } if (event.key === 'Escape') closeFind(); }} />
            <span className="spde-find-count" aria-live="polite">{query ? (search.count ? `${search.active + 1} of ${search.count}` : 'No results') : ''}</span>
            <RibbonButton icon={ChevronUp} label="Previous match" disabled={!search.count} onClick={() => stepSearch(-1)} />
            <RibbonButton icon={ChevronDown} label="Next match" disabled={!search.count} onClick={() => stepSearch(1)} />
            <input aria-label="Replace with" placeholder="Replace with" value={replacement} disabled={!can} onChange={(event) => setReplacement(event.target.value)} />
            <RibbonButton wide label="Replace" disabled={!can || !search.count} onClick={replaceOne} />
            <RibbonButton wide label="Replace all" disabled={!can || !search.count} onClick={replaceAll} />
            <RibbonButton icon={X} label="Close find" onClick={closeFind} />
          </div>
        )}
        {saving && (
          <form className="spde-save-bar" onSubmit={submit}>
            <label htmlFor={`spde-reason-${section.key}`}>Reason for the edit</label>
            <input id={`spde-reason-${section.key}`} ref={reasonRef} maxLength={500} value={reason} disabled={busy}
              placeholder="For example: clarify the review responsibility requested by the client" onChange={(event) => setReason(event.target.value)} />
            <button type="submit" className="spr-button spr-button-primary" disabled={busy || !reason.trim()}><Save aria-hidden="true" />Save &amp; update PDF</button>
            <button type="button" className="spr-button" disabled={busy} onClick={() => setSaving(false)}>Cancel</button>
          </form>
        )}
        {problem && <p className="spde-problem" role="alert">{problem}</p>}
      </div>

      <div className="spde-stage" ref={stageRef}>
        <article className={`spde-sheet${showSources ? ' show-sources' : ''}`} style={{ zoom }} aria-label={`Editable page: ${section.title}`}>
          <header className="spde-sheet-header"><span>{quoteNumber} · Technical Proposal</span><img src="/rejlers-logo.svg" alt="Rejlers" /></header>
          <h1 className="spde-section-title">{section.title}</h1>
          <EditorContent editor={editor} />
          <footer className="spde-sheet-footer"><span>{quoteNumber} | {versionLabel}</span><span>{pageLabel(section.pages)} in PDF</span></footer>
        </article>
      </div>

      <footer className="spde-status" aria-label="Document status">
        <span>{section.title}</span>
        <span>{pageLabel(section.pages)} of the PDF</span>
        <span>{words.toLocaleString()} words</span>
        <span className="spde-status-zoom">
          <button type="button" aria-label="Zoom out" disabled={zoom <= ZOOMS[0]} onClick={() => setZoom((value) => ZOOMS.slice().reverse().find((step) => step < value) || ZOOMS[0])}><ZoomOut aria-hidden="true" /></button>
          <select aria-label="Zoom" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
            {[...new Set([...ZOOMS, zoom])].sort((a, b) => a - b).map((value) => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
          </select>
          <button type="button" aria-label="Zoom in" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom((value) => ZOOMS.find((step) => step > value) || ZOOMS[ZOOMS.length - 1])}><ZoomIn aria-hidden="true" /></button>
          <button type="button" className="spde-fit" onClick={fitWidth}><Maximize aria-hidden="true" />Fit page</button>
        </span>
      </footer>
    </div>
  );
}

SectionDocument.propTypes = {
  section: PropTypes.shape({ key: PropTypes.string.isRequired, title: PropTypes.string.isRequired, blocks: PropTypes.array, pages: PropTypes.array }).isRequired,
  quoteNumber: PropTypes.string, versionLabel: PropTypes.string, editable: PropTypes.bool, busy: PropTypes.bool,
  threads: PropTypes.array.isRequired, selectedThreadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onThreadSelect: PropTypes.func.isRequired, onComment: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired,
  onDirtyChange: PropTypes.func.isRequired, onDownload: PropTypes.func.isRequired, onShowPdf: PropTypes.func.isRequired, downloading: PropTypes.string,
  onQuote: PropTypes.func.isRequired,
};

/**
 * Word-style editing of the generated Technical Proposal inside the review canvas. Structured
 * section content stays the source of truth: saving re-renders the PDF and Word file in the
 * Rejlers template (no AI) as the next proposal version.
 */
export default function SalesProposalDocumentEditor({ proposalId, workspace, quoteNumber, pageNumber, onGoToPage, onUpdated, editable,
  threads, selectedThreadId, onThreadSelect, onComment, onStatus, onShowPdf, commandRef }) {
  const current = workspace?.current;
  const sections = useMemo(() => editableSections(current?.content), [current?.content]);
  const [dirty, setDirty] = useState(false);
  const [held, setHeld] = useState('');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');
  const quoteRef = useRef('');
  const setQuote = useCallback((value) => { quoteRef.current = value; }, []);
  const onPage = sectionForPage(sections, pageNumber);
  const section = (dirty && sections.find((item) => item.key === held)) || onPage;
  const running = Boolean(job && ['queued', 'running'].includes(job.status));

  useEffect(() => { if (!dirty && onPage) setHeld(onPage.key); }, [dirty, onPage]);
  useEffect(() => {
    onStatus(running ? 'updating' : dirty ? 'unsaved' : error ? 'error' : 'saved');
  }, [running, dirty, error, onStatus]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setTimeout(async () => {
      try {
        const next = (await salesService.getStandardProposalJob(proposalId, job.id)).job;
        setJob(next);
        if (next.status === 'succeeded') {
          setDirty(false);
          onUpdated(`Saved as proposal version ${next.result_version}. The PDF and Word file were rebuilt in the Rejlers template.`);
        } else if (next.status === 'failed') {
          setError(next.error_code === 'version_changed'
            ? 'Someone else changed this section meanwhile. Your edit was not applied; reload and edit again.'
            : 'The PDF could not be updated. Your edit was not applied; try again.');
        }
      } catch {
        setJob((previous) => ({ ...previous }));
      }
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [running, job, proposalId, onUpdated]);

  const save = useCallback(async (blocks, reason) => {
    setError('');
    try {
      const result = await salesService.saveTechnicalProposalSectionContent(proposalId, section.key, {
        expected_version: current.version, blocks, reason,
      });
      setJob(result.job);
      return true;
    } catch (failure) {
      setError(failureText(failure, 'The edit could not be saved. Try again.'));
      return false;
    }
  }, [proposalId, section?.key, current?.version]);

  const download = useCallback(async (format) => {
    setDownloading(format); setError('');
    try {
      const result = await salesService.downloadTechnicalProposalWorkspace(proposalId, format, current?.version);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url; link.download = result.filename || `Technical Proposal.${format}`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failureText(failure, `The ${format.toUpperCase()} file could not be downloaded.`));
    } finally {
      setDownloading('');
    }
  }, [proposalId, current?.version]);

  const comment = useCallback((quote) => onComment({
    page_number: section?.pages?.[0] || pageNumber,
    anchor: quote ? { rects: [], quote } : null,
    context: section?.title?.slice(0, 200) || '',
  }), [onComment, section, pageNumber]);

  useEffect(() => {
    if (!commandRef) return undefined;
    commandRef.current = { comment: () => comment(section ? quoteRef.current : '') };
    return () => { commandRef.current = null; };
  }, [commandRef, comment, section]);

  if (!current) return <div className="spde-empty"><FileText aria-hidden="true" /><p>The Technical Proposal has not been generated yet.</p></div>;
  if (!sections.length) return <div className="spde-empty"><FileText aria-hidden="true" /><p>This proposal has no sections that can be edited in the canvas.</p></div>;

  return (
    <div className="spde-host">
      {running && <p className="spde-banner" role="status"><Loader2 className="spde-spin" aria-hidden="true" />Updating the PDF and Word file in the Rejlers template… this usually takes one to three minutes.</p>}
      {error && <p className="spde-banner spde-banner-error" role="alert">{error}</p>}
      {dirty && onPage?.key !== section?.key && <p className="spde-banner" role="status">You are still editing “{section.title}”. Save or discard your changes to open the section on page {pageNumber}.</p>}
      {section ? (
        <SectionDocument key={`${current.version}:${section.key}`} section={section} quoteNumber={quoteNumber} versionLabel={`Version ${current.version}`}
          editable={editable} busy={running} threads={threads} selectedThreadId={selectedThreadId} onThreadSelect={onThreadSelect}
          onComment={comment} onSave={save} onDirtyChange={setDirty} onDownload={download} onShowPdf={onShowPdf} downloading={downloading} onQuote={setQuote} />
      ) : (
        <div className="spde-empty">
          <FileText aria-hidden="true" />
          <h2>Page {pageNumber} is generated</h2>
          <p>The cover, letter, contents, dividers, compliance matrix and evidence pages are built by the template and cannot be edited here.</p>
          <div className="spde-empty-actions">
            <button type="button" className="spr-button spr-button-primary" onClick={() => onGoToPage(sections[0].pages?.[0] || 1)}>Go to the first editable section</button>
            <button type="button" className="spr-button" onClick={onShowPdf}>View this page in the source PDF</button>
          </div>
        </div>
      )}
    </div>
  );
}

SalesProposalDocumentEditor.propTypes = {
  proposalId: PropTypes.string.isRequired,
  workspace: PropTypes.shape({ current: PropTypes.object }),
  quoteNumber: PropTypes.string,
  pageNumber: PropTypes.number.isRequired,
  onGoToPage: PropTypes.func.isRequired,
  onUpdated: PropTypes.func.isRequired,
  editable: PropTypes.bool,
  threads: PropTypes.array.isRequired,
  selectedThreadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onThreadSelect: PropTypes.func.isRequired,
  onComment: PropTypes.func.isRequired,
  onStatus: PropTypes.func.isRequired,
  onShowPdf: PropTypes.func.isRequired,
  commandRef: PropTypes.shape({ current: PropTypes.any }),
};
