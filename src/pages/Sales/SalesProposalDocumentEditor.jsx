import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BookOpen, ChevronDown, ChevronUp, Columns, Download, FileText,
  Highlighter, Image, Outdent, Indent, Italic, Link, List, ListOrdered, Loader2, Maximize,
  MessageSquarePlus, PanelTop, Redo2, RemoveFormatting, RotateCcw, Rows, Ruler, Save, Search, Strikethrough, Table,
  Trash2, Underline, Undo2, X, ZoomIn, ZoomOut,
} from 'lucide-react';
import salesService from '../../services/sales.service';
import { proposalExtensions, commentKey, searchKey } from './proposalDocumentExtensions';
import { FONTS, FONT_SIZES, blocksProblem, blocksToDoc, docToBlocks, sameBlocks, wordCount } from './proposalDocumentModel';
import { DOCUMENT_KINDS, editableSections, sectionForPage } from './proposalSectionEdit';
import SalesProposalDocumentRuler, { SHEET_WIDTH } from './SalesProposalDocumentRuler';
import { PAGE, Pagination, paginate } from './proposalDocumentPagination';
import './SalesProposalDocumentEditor.css';

const POLL_MS = 4000;
const TABS = ['File', 'Home', 'Insert', 'Layout', 'References', 'Review', 'View'];
const GENERATED = { cover: 'cover page', letter: 'covering letter', compliance: 'compliance matrix' };
const INDENT_STEP = 18;
const plainTitle = (section) => section.custom_title || String(section.title || '').replace(/^\d+(\.\d+)*\s+/, '');
const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ZOOMS = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5];
const pageLabel = (pages) => (Array.isArray(pages) ? (pages[0] === pages[1] ? `Page ${pages[0]}` : `Pages ${pages[0]}–${pages[1]}`) : 'Not yet paginated');
const failureText = (failure, fallback) => {
  const data = failure?.response?.data;
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return first(data?.blocks) || first(data?.layout) || first(data?.reset) || first(data?.expected_version) || first(data?.reason)
    || first(data?.detail) || fallback;
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
  onSave, onSaveLayout, onDirtyChange, onDownload, onShowPdf, downloading, onQuote, layout }) {
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
  const [title, setTitle] = useState(() => plainTitle(section));
  const [saveMode, setSaveMode] = useState('section');
  const [headerMode, setHeaderMode] = useState(false);
  const [layoutDraft, setLayoutDraft] = useState(layout);
  const [showRuler, setShowRuler] = useState(true);
  const [, setTick] = useState(0);
  const stageRef = useRef(null);
  const sheetRef = useRef(null);
  const [pages, setPages] = useState(1);
  const findRef = useRef(null);
  const reasonRef = useRef(null);
  const selectThread = useRef(onThreadSelect);
  selectThread.current = onThreadSelect;
  const extensions = useMemo(() => [...proposalExtensions({ onCommentSelect: (id) => selectThread.current?.(id) }), Pagination], []);

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

  const blocksDirty = useMemo(() => !sameBlocks(section.blocks, blocks), [section.blocks, blocks]);
  const titleDirty = title.trim() !== plainTitle(section);
  const layoutDirty = Boolean(layout && layoutDraft && !sameLayout(layout, layoutDraft));
  const dirty = blocksDirty || titleDirty || layoutDirty;
  const generated = GENERATED[section.kind];
  const problem = blocksDirty ? blocksProblem(blocks) : titleDirty && !title.trim() ? 'The section title cannot be empty.' : '';
  const words = useMemo(() => wordCount(blocks), [blocks]);
  const sourced = blocks.filter((block) => block.type !== 'part' && Number.isInteger(block.ref)
    && (section.blocks[block.ref]?.citations || []).length > 0).length;
  const sectionThreads = useMemo(() => threads.filter((thread) => thread.anchor?.quote && Array.isArray(section.pages)
    && thread.page_number >= section.pages[0] && thread.page_number <= section.pages[1]), [threads, section.pages]);

  useEffect(() => { editor?.setEditable(editable && !busy && !saving && !headerMode); }, [editor, editable, busy, saving, headerMode]);
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
  const openSave = (mode) => {
    setSaveMode(mode); setSaving(true); requestAnimationFrame(() => reasonRef.current?.focus());
  };
  const startSave = () => {
    if (layoutDirty && headerMode) { openSave('layout'); return; }
    if (!(blocksDirty || titleDirty) || problem) return;
    openSave('section');
  };
  const discard = () => {
    editor.commands.setContent(blocksToDoc(section.blocks), true);
    setTitle(plainTitle(section)); setLayoutDraft(layout); setHeaderMode(false);
    setSaving(false); setReason('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!reason.trim() || (saveMode === 'section' && problem)) return;
    const saved = saveMode === 'layout' ? await onSaveLayout(layoutDraft, reason.trim())
      : await onSave(saveMode === 'reset' ? { reset: true } : {
        ...(blocksDirty ? { blocks } : {}), ...(titleDirty ? { title: title.trim() } : {}),
      }, reason.trim());
    if (saved) { setSaving(false); setReason(''); }
  };
  const textType = editor?.isActive('heading') ? 'heading' : 'paragraph';
  const changeIndent = (delta) => {
    if (editor.isActive('listItem')) {
      editor.chain().focus()[delta > 0 ? 'sinkListItem' : 'liftListItem']('listItem').run();
      return;
    }
    const left = Number(editor.getAttributes(textType).indentLeft) || 0;
    editor.chain().focus().updateAttributes(textType, { indentLeft: Math.max(0, Math.min(288, left + delta)) || null }).run();
  };
  const setIndent = (left, first) => {
    editor.chain().focus().updateAttributes(textType, { indentLeft: left || null, indentFirst: first || null }).run();
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
    setZoom(Math.min(1.5, Math.max(0.5, Math.floor(((width - 48) / SHEET_WIDTH) * 20) / 20)));
  };

  // Open at "fit page width" when the A4 page is wider than the canvas.
  const ready = Boolean(editor);
  // Lay the content out on A4 pages after every change (and when zoom or fonts change).
  useEffect(() => {
    if (!editor) return undefined;
    let frame = 0;
    let rounds = 0;
    const run = () => {
      frame = 0;
      const result = paginate(editor, sheetRef.current, zoom, rounds < 4);
      if (!result) return;
      setPages(result.pages);
      if (result.changed) rounds += 1;
    };
    const schedule = ({ transaction } = {}) => {
      if (transaction?.docChanged) rounds = 0;
      if (!frame) frame = requestAnimationFrame(run);
    };
    editor.on('transaction', schedule);
    schedule();
    document.fonts?.ready?.then(() => schedule());
    return () => { editor.off('transaction', schedule); if (frame) cancelAnimationFrame(frame); };
  }, [editor, zoom]);
  useEffect(() => {
    const width = stageRef.current?.clientWidth || 0;
    if (ready && width && width - 48 < SHEET_WIDTH) setZoom(Math.max(0.5, Math.floor(((width - 48) / SHEET_WIDTH) * 20) / 20));
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
  const heading = [1, 2, 3].find((level) => editor.isActive('heading', { level })) || 0;
  const style = editor.getAttributes('textStyle');
  const inList = editor.isActive('listItem');
  const align = ['left', 'center', 'right', 'justify'].find((value) => editor.isActive({ textAlign: value })) || '';
  const indent = editor.getAttributes(textType);
  const sizeValue = /^(\d+(?:\.\d+)?)pt$/.exec(style.fontSize || '')?.[1] || '';
  const fontValue = String(style.fontFamily || '').replace(/["']/g, '').split(',')[0].trim();
  const savable = (blocksDirty || titleDirty) && !problem && !busy && editable && !headerMode;

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
              <RibbonButton wide icon={Save} label="Save & update PDF" disabled={!(savable || (headerMode && layoutDirty && !busy))} onClick={startSave} />
              <RibbonButton wide icon={Undo2} label="Discard changes" disabled={!dirty || busy} onClick={discard} />
              {generated && section.override && (
                <RibbonButton wide icon={RotateCcw} label="Reset to generated page" disabled={busy || !editable || dirty} onClick={() => openSave('reset')} />
              )}
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
            <Group label="Font">
              <select className="spde-select spde-font" aria-label="Font" disabled={!can} value={fontValue}
                onChange={(event) => (event.target.value ? editor.chain().focus().setFontFamily(event.target.value).run() : editor.chain().focus().unsetFontFamily().run())}>
                <option value="">Template font</option>
                {[...new Set([...FONTS, ...(fontValue ? [fontValue] : [])])].map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="spde-select spde-size" aria-label="Font size" disabled={!can} value={sizeValue}
                onChange={(event) => (event.target.value ? editor.chain().focus().setFontSize(`${event.target.value}pt`).run() : editor.chain().focus().unsetFontSize().run())}>
                <option value="">Auto</option>
                {[...new Set([...FONT_SIZES.map(String), ...(sizeValue ? [sizeValue] : [])])].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <RibbonButton icon={Bold} label="Bold" active={editor.isActive('bold')} disabled={!can} onClick={() => editor.chain().focus().toggleBold().run()} />
              <RibbonButton icon={Italic} label="Italic" active={editor.isActive('italic')} disabled={!can} onClick={() => editor.chain().focus().toggleItalic().run()} />
              <RibbonButton icon={Underline} label="Underline" active={editor.isActive('underline')} disabled={!can} onClick={() => editor.chain().focus().toggleUnderline().run()} />
              <RibbonButton icon={Strikethrough} label="Strikethrough" active={editor.isActive('strike')} disabled={!can} onClick={() => editor.chain().focus().toggleStrike().run()} />
              <label className={`spde-color${can ? '' : ' is-disabled'}`} title="Text colour">
                <span className="spde-color-mark" style={{ borderBottomColor: style.color || '#1B1B1B' }} aria-hidden="true">A</span>
                <input type="color" aria-label="Text colour" disabled={!can} value={/^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : '#1b1b1b'}
                  onChange={(event) => editor.chain().focus().setColor(event.target.value).run()} />
              </label>
              <label className={`spde-color${can ? '' : ' is-disabled'}`} title="Highlight colour">
                <Highlighter aria-hidden="true" />
                <input type="color" aria-label="Highlight colour" disabled={!can} value={editor.getAttributes('highlight').color || '#ffff00'}
                  onChange={(event) => editor.chain().focus().setHighlight({ color: event.target.value }).run()} />
              </label>
              <RibbonButton icon={RemoveFormatting} label="Clear formatting" disabled={!can} onClick={() => editor.chain().focus().unsetAllMarks().run()} />
            </Group>
            <Group label="Paragraph">
              <RibbonButton icon={List} label="Bulleted list" active={editor.isActive('bulletList')} disabled={!can || inTable} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <RibbonButton icon={ListOrdered} label="Numbered list" active={editor.isActive('orderedList')} disabled={!can || inTable} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
              <RibbonButton icon={Outdent} label="Decrease indent" disabled={!can || inTable} onClick={() => changeIndent(-INDENT_STEP)} />
              <RibbonButton icon={Indent} label="Increase indent" disabled={!can || inTable} onClick={() => changeIndent(INDENT_STEP)} />
              {[['left', AlignLeft, 'Align left'], ['center', AlignCenter, 'Centre'], ['right', AlignRight, 'Align right'], ['justify', AlignJustify, 'Justify']].map(([value, Icon, label]) => (
                <RibbonButton key={value} icon={Icon} label={label} active={align === value} disabled={!can || inList}
                  onClick={() => editor.chain().focus().setTextAlign(value).run()} />
              ))}
            </Group>
            <Group label="Styles">
              {[[0, 'Normal'], [1, 'Heading 1'], [2, 'Heading 2'], [3, 'Heading 3']].map(([level, name]) => (
                <button key={level} type="button" className={`spde-style spde-style-h${level}${heading === level ? ' is-active' : ''}`} aria-pressed={heading === level}
                  disabled={!can || inTable || inList} onMouseDown={(event) => event.preventDefault()}
                  onClick={() => (level ? editor.chain().focus().setHeading({ level }).run() : editor.chain().focus().setParagraph().run())}>{name}</button>
              ))}
            </Group>
            <Group label="Editing">
              <RibbonButton wide icon={Search} label="Find" onClick={openFind} />
              <RibbonButton wide icon={Save} label="Save" disabled={!(savable || (headerMode && layoutDirty && !busy))} onClick={startSave} />
            </Group>
          </>}
          {tab === 'Insert' && <>
            <Group label="Content">
              <RibbonButton wide icon={Table} label="Table" disabled={!can || inTable} onClick={() => editor.chain().focus().insertTable({ rows: 2, cols: 3, withHeaderRow: true }).run()} />
              <RibbonButton wide icon={List} label="Bulleted list" disabled={!can || inTable} onClick={() => editor.chain().focus().toggleBulletList().run()} />
              <RibbonButton wide icon={ListOrdered} label="Numbered list" disabled={!can || inTable} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
            </Group>
            <Group label="Table">
              <RibbonButton icon={Rows} label="Insert row below" disabled={!can || !inTable} onClick={() => editor.chain().focus().addRowAfter().run()} />
              <RibbonButton icon={Columns} label="Insert column right" disabled={!can || !inTable || columnCount >= 8} title={columnCount >= 8 ? 'A table has at most 8 columns.' : 'Insert column right'} onClick={() => editor.chain().focus().addColumnAfter().run()} />
              <RibbonButton wide label="Delete row" disabled={!can || !inTable} onClick={() => editor.chain().focus().deleteRow().run()} />
              <RibbonButton wide label="Delete column" disabled={!can || !inTable || columnCount <= 1} onClick={() => editor.chain().focus().deleteColumn().run()} />
              <RibbonButton wide label="Header row" active={inTable && editor.isActive('tableHeader')} disabled={!can || !inTable} onClick={() => editor.chain().focus().toggleHeaderRow().run()} />
              <RibbonButton icon={Trash2} label="Delete table" disabled={!can || !inTable} onClick={() => editor.chain().focus().deleteTable().run()} />
            </Group>
            <Group label="Not in template">
              <RibbonButton icon={Link} label="Link" disabled title="Links are not supported by the Rejlers proposal renderer." />
              <RibbonButton icon={Image} label="Image" disabled title="Images are not placed in the text. Attach evidence documents to a section in Evidence review instead." />
            </Group>
          </>}
          {tab === 'Layout' && <>
            <Group label="Indent">
              <RibbonButton icon={Outdent} label="Decrease indent" disabled={!can || inTable} onClick={() => changeIndent(-INDENT_STEP)} />
              <RibbonButton icon={Indent} label="Increase indent" disabled={!can || inTable} onClick={() => changeIndent(INDENT_STEP)} />
              <RibbonButton wide icon={Ruler} label={showRuler ? 'Hide ruler' : 'Show ruler'} active={showRuler} onClick={() => setShowRuler((value) => !value)} />
            </Group>
            <Group label="Header & footer">
              <RibbonButton wide icon={PanelTop} label={headerMode ? 'Close header & footer' : 'Edit header & footer'} active={headerMode}
                disabled={!layout || !editable || busy || (!headerMode && (blocksDirty || titleDirty))}
                title={!layout ? 'Available once this proposal has been saved or regenerated with the current template.'
                  : (blocksDirty || titleDirty) && !headerMode ? 'Save or discard the section changes first.' : undefined}
                onClick={() => { if (headerMode) { setLayoutDraft(layout); } setHeaderMode((value) => !value); }} />
            </Group>
            <Group label="Page">
              <span className="spde-info">A4 · margins set by the Rejlers template</span>
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
              <RibbonButton wide icon={Ruler} label="Ruler" active={showRuler} onClick={() => setShowRuler((value) => !value)} />
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
            <label htmlFor={`spde-reason-${section.key}`}>{saveMode === 'layout' ? 'Reason for the header and footer change'
              : saveMode === 'reset' ? `Reason for restoring the generated ${generated}` : 'Reason for the edit'}</label>
            <input id={`spde-reason-${section.key}`} ref={reasonRef} maxLength={500} value={reason} disabled={busy}
              placeholder="For example: clarify the review responsibility requested by the client" onChange={(event) => setReason(event.target.value)} />
            <button type="submit" className="spr-button spr-button-primary" disabled={busy || !reason.trim()}><Save aria-hidden="true" />{saveMode === 'reset' ? 'Reset & update PDF' : 'Save & update PDF'}</button>
            <button type="button" className="spr-button" disabled={busy} onClick={() => setSaving(false)}>Cancel</button>
          </form>
        )}
        {problem && <p className="spde-problem" role="alert">{problem}</p>}
      </div>

      <div className="spde-stage" ref={stageRef}>
        {showRuler && (
          <SalesProposalDocumentRuler zoom={zoom} left={Number(indent.indentLeft) || 0} first={Number(indent.indentFirst) || 0}
            disabled={!can || inList || inTable} onChange={setIndent} />
        )}
        <article ref={sheetRef} className={`spde-sheet${showSources ? ' show-sources' : ''}${headerMode ? ' is-header-mode' : ''}`}
          style={{ zoom, height: pages * (PAGE.height + PAGE.gap) - PAGE.gap }} aria-label={`Editable pages: ${title || section.title}`}>
          {Array.from({ length: pages }, (_, index) => {
            const top = index * (PAGE.height + PAGE.gap);
            const editingBands = headerMode && index === 0;
            return (
              <div key={index} className="spde-page-frame" aria-hidden={editingBands ? undefined : 'true'}>
                <div className="spde-page" style={{ top }} />
                <header className={`spde-band spde-band-header${editingBands ? ' is-editing' : ''}`} style={{ top }}>
                  {editingBands ? (
                    <div className="spde-hf-fields">
                      {layoutDraft.header_lines.map((line, lineIndex) => (
                        <input key={lineIndex} aria-label={`Header line ${lineIndex + 1}`} maxLength={200} value={line}
                          onChange={(event) => setLayoutDraft((draft) => ({ ...draft, header_lines: draft.header_lines.map((value, i) => (i === lineIndex ? event.target.value : value)) }))} />
                      ))}
                      <span className="spde-hf-auto">{quoteNumber} (automatic)</span>
                    </div>
                  ) : (
                    <span>{(layout?.header_lines?.[0] || 'Technical Proposal')} · {quoteNumber}{layout?.header_lines?.[1] ? ` · ${layout.header_lines[1]}` : ''}</span>
                  )}
                  <img src="/rejlers-logo.svg" alt={index === 0 ? 'Rejlers' : ''} />
                </header>
                <footer className={`spde-band spde-band-footer${editingBands ? ' is-editing' : ''}`} style={{ top: top + PAGE.height - PAGE.bottom }}>
                  {editingBands ? (
                    <div className="spde-hf-fields spde-hf-footer">
                      {layoutDraft.footer_lines.map((line, lineIndex) => (
                        <input key={lineIndex} aria-label={`Footer line ${lineIndex + 1}`} maxLength={200} value={line}
                          onChange={(event) => setLayoutDraft((draft) => ({ ...draft, footer_lines: draft.footer_lines.map((value, i) => (i === lineIndex ? event.target.value : value)) }))} />
                      ))}
                    </div>
                  ) : (
                    <>
                      <span className="spde-footer-lines">{(layout?.footer_lines || []).map((line, lineIndex) => <span key={lineIndex}>{line}</span>)}</span>
                      <span className="spde-page-number">{quoteNumber} | {versionLabel} · Page {index + 1} of {pages}</span>
                    </>
                  )}
                </footer>
                {index < pages - 1 && <div className="spde-page-gap" style={{ top: top + PAGE.height }} />}
              </div>
            );
          })}
          <div className="spde-flow" style={{ padding: `${PAGE.top}px ${PAGE.side}px 0` }}>
            {generated && (
              <p className="spde-generated-note">
                {section.override ? `Your edited version of the ${generated}. It is used in every rebuild until you reset it (File › Reset to generated page).`
                  : `Generated ${generated}: edit it directly. Saving keeps your version in the PDF and Word file${section.kind === 'cover' ? ' (as a text cover page without the designed background)' : ''}.`}
              </p>
            )}
            <input className="spde-section-title" aria-label="Section title" value={title} maxLength={200} disabled={!can}
              title="The contents page and divider page use this title" onChange={(event) => setTitle(event.target.value)} />
            <EditorContent editor={editor} />
          </div>
        </article>
      </div>

      <footer className="spde-status" aria-label="Document status">
        <span>{title || section.title}</span>
        <span>{pages} {pages === 1 ? 'page' : 'pages'} · {pageLabel(section.pages)} of the PDF</span>
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
  section: PropTypes.shape({
    key: PropTypes.string.isRequired, title: PropTypes.string.isRequired, blocks: PropTypes.array, pages: PropTypes.array,
    kind: PropTypes.string, override: PropTypes.bool, custom_title: PropTypes.string,
  }).isRequired,
  quoteNumber: PropTypes.string, versionLabel: PropTypes.string, editable: PropTypes.bool, busy: PropTypes.bool,
  threads: PropTypes.array.isRequired, selectedThreadId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onThreadSelect: PropTypes.func.isRequired, onComment: PropTypes.func.isRequired, onSave: PropTypes.func.isRequired,
  onDirtyChange: PropTypes.func.isRequired, onDownload: PropTypes.func.isRequired, onShowPdf: PropTypes.func.isRequired, downloading: PropTypes.string,
  onQuote: PropTypes.func.isRequired,
  onSaveLayout: PropTypes.func.isRequired,
  layout: PropTypes.shape({ header_lines: PropTypes.array, footer_lines: PropTypes.array }),
};

/**
 * Word-style editing of the generated Technical Proposal inside the review canvas. Structured
 * section content stays the source of truth: saving re-renders the PDF and Word file in the
 * Rejlers template (no AI) as the next proposal version.
 */
export default function SalesProposalDocumentEditor({ proposalId, workspace, quoteNumber, pageNumber, onGoToPage, onUpdated, editable,
  threads, selectedThreadId, onThreadSelect, onComment, onStatus, onShowPdf, commandRef }) {
  const current = workspace?.current;
  const sections = useMemo(() => editableSections(current?.content, DOCUMENT_KINDS), [current?.content]);
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

  const queue = useCallback(async (request) => {
    setError('');
    try {
      setJob((await request()).job);
      return true;
    } catch (failure) {
      setError(failureText(failure, 'The edit could not be saved. Try again.'));
      return false;
    }
  }, []);
  const save = useCallback((change, reason) => queue(() => salesService.saveTechnicalProposalSectionContent(proposalId, section.key, {
    expected_version: current.version, reason, ...change,
  })), [queue, proposalId, section?.key, current?.version]);
  const saveLayout = useCallback((layout, reason) => queue(() => salesService.saveTechnicalProposalLayout(proposalId, {
    expected_version: current.version, reason, layout,
  })), [queue, proposalId, current?.version]);

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
          onComment={comment} onSave={save} onSaveLayout={saveLayout} layout={current.content?.layout || null}
          onDirtyChange={setDirty} onDownload={download} onShowPdf={onShowPdf} downloading={downloading} onQuote={setQuote} />
      ) : (
        <div className="spde-empty">
          <FileText aria-hidden="true" />
          <h2>Page {pageNumber} is generated</h2>
          <p>The contents and divider pages are built from the section titles: change a title at the top of its section to update them. Enclosed evidence documents are shown as uploaded.</p>
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
